import { expect, test, type Page } from "@playwright/test";
import { createJiti } from "jiti";

const { storeLocations } = await createJiti(import.meta.url).import(
  "../shared/content/stores.ts",
);
const markersExpected = storeLocations.filter(
  (store) => store.coordinates,
).length;

async function openContacts(page: Page) {
  await page.goto("/contacts");
  // Ждём гидрации: до неё клики по списку не обрабатываются Vue.
  await page.waitForFunction(
    () =>
      (
        document.querySelector("#__nuxt") as Element & {
          __vue_app__?: { $nuxt?: { isHydrating: boolean } };
        }
      )?.__vue_app__?.$nuxt?.isHydrating === false,
  );
}

test.describe("Контакты: блок «Наши магазины»", () => {
  test("на странице 30 магазинов, сгруппированных по городам", async ({
    page,
  }) => {
    await openContacts(page);
    await expect(
      page.getByRole("heading", { name: "Наши магазины" }),
    ).toBeVisible();
    await expect(page.locator(".store-map-option")).toHaveCount(30);
    await expect(page.getByRole("heading", { name: /Саратов/ })).toContainText(
      "27 магазинов",
    );
    await expect(page.getByRole("heading", { name: /Москва/ })).toContainText(
      "3 магазина",
    );
  });

  test("адреса доступны в DOM без карты (SEO и доступность)", async ({
    page,
  }) => {
    await openContacts(page);
    const list = page.locator(".stores-map-list");
    await expect(list).toContainText("ул. Антонова, 33");
    await expect(list).toContainText("Варшавское шоссе, 152а");
    await expect(list).toContainText("Москва");
    await expect(list).toContainText("Саратов");
  });

  test("карта инициализируется и показывает маркеры", async ({ page }) => {
    await openContacts(page);
    // SDK Яндекс.Карт грузится с сети — даём больше времени на первый пуск.
    await expect(
      page.locator(".stores-map-view .store-pin").first(),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".store-pin")).toHaveCount(markersExpected);
  });

  test("выбор магазина в списке: подсветка, попап, выделение маркера", async ({
    page,
  }) => {
    await openContacts(page);
    const option = page
      .locator(".store-map-option")
      .filter({ hasText: "ул. Антонова, 33" });
    await option.click();
    await expect(option).toHaveClass(/store-map-option--selected/);
    await expect(option).toHaveAttribute("aria-pressed", "true");
    // Первый запрос к карте ждёт инициализации SDK — под нагрузкой полного
    // прогона это дольше дефолтных 5 секунд.
    await expect(page.locator(".store-pin--selected")).toHaveCount(1, {
      timeout: 20000,
    });

    const popup = page.locator(".store-popup-card");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Саратов, ул. Антонова, 33");
    await expect(popup).toContainText("Режим:");
  });

  test("клик по маркеру выделяет магазин в списке", async ({ page }) => {
    await openContacts(page);
    await expect(page.locator(".store-pin")).toHaveCount(markersExpected, {
      timeout: 20000,
    });
    // На обзорном зуме маркеры Саратова перекрывают друг друга — сначала
    // центрируемся выбором из списка, затем жмём сам маркер.
    await page
      .locator(".store-map-option")
      .filter({ hasText: "ул. Азина, 39" })
      .click();
    await expect(page.locator(".store-pin--selected")).toHaveCount(1);
    // Кликать нужно по координатам штырька: над маркерами у Яндекса лежит
    // прозрачный events-pane, который ловит клики и передаёт их маркеру.
    const pin = page.locator('.store-pin-anchor[title*="ул. Азина, 39"]');
    await pin.scrollIntoViewIfNeeded();
    const box = await pin.boundingBox();
    if (!box) {
      throw new Error("Маркер ул. Азина, 39 не найден на карте");
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const selected = page.locator(".store-map-option--selected");
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("ул. Азина, 39");
    await expect(page.locator(".store-popup-card")).toBeVisible();
    await expect(page.locator(".store-popup-card")).toContainText(
      "Саратов, ул. Азина, 39",
    );
  });

  test("повторный клик по выбранному магазину снимает выбор", async ({
    page,
  }) => {
    await openContacts(page);
    const option = page
      .locator(".store-map-option")
      .filter({ hasText: "ул. Антонова, 33" });
    await option.click();
    await expect(page.locator(".store-pin--selected")).toHaveCount(1);
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".store-pin--selected")).toHaveCount(0);
    await expect(page.locator(".store-popup-card")).toHaveCount(0);
  });
});
