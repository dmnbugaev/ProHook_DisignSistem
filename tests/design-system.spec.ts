import { test, expect, type Page } from "@playwright/test";

async function openReady(page: Page) {
  await page.goto("/design-system");
  await page.waitForFunction(
    () =>
      (
        document.querySelector("#__nuxt") as Element & {
          __vue_app__?: { $nuxt?: { isHydrating: boolean } };
        }
      )?.__vue_app__?.$nuxt?.isHydrating === false,
  );
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
}

test("dialog isolates focus, closes with Escape and restores its trigger", async ({
  page,
}) => {
  await openReady(page);
  const trigger = page.getByRole("button", {
    name: "Открыть диалог",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Всё внимание — здесь" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Закрыть", exact: true }),
  ).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await trigger.click();
  await dialog.getByRole("button", { name: "Понятно" }).click();
  await expect(trigger).toBeFocused();
});

test("age gate blocks dismissal, handles refusal and asks again on reload", async ({
  page,
}) => {
  await page.goto("/design-system");
  const dialog = page.getByRole("dialog", {
    name: "Вам уже исполнилось 18 лет?",
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Мне нет 18 лет" }).click();
  await expect(dialog.getByRole("status")).toContainText("от 18 лет");
  await expect(page.locator("#top")).toHaveAttribute("inert", "");
  await dialog
    .getByRole("button", { name: "Вернуться к подтверждению" })
    .click();
  await dialog.getByRole("button", { name: "Мне 18 лет или больше" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#top")).not.toHaveAttribute("inert");
  await page.reload();
  await expect(dialog).toBeVisible();
});

test("mobile navigation supports keyboard, anchors and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  const trigger = page.getByRole("button", { name: "Открыть меню" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Разделы" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Движение" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Типографика" }).click();
  await expect(page).toHaveURL(/#typography$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("tabs follow arrow, Home and End keys with matching visible panels", async ({
  page,
}) => {
  await openReady(page);
  const list = page.getByRole("tablist", { name: "Принципы системы" });
  await list.getByRole("tab", { name: "Принцип", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(list.getByRole("tab", { name: "Детали" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Детали" })).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: "Принцип", exact: true }),
  ).not.toBeVisible();
  await page.keyboard.press("End");
  await expect(list.getByRole("tab", { name: "Применение" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  await expect(
    list.getByRole("tab", { name: "Принцип", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  await expect(
    list.getByRole("tab", { name: "Принцип", exact: true }),
  ).toBeFocused();
});

test("field errors are associated, and valid values remain local", async ({
  page,
}) => {
  await openReady(page);
  const email = page.getByRole("textbox", {
    name: "Электронная почта · пример",
  });
  await email.fill("invalid");
  await page.getByRole("button", { name: "Проверить формат" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription(
    "! Введите адрес в формате name@example.com",
  );
  await email.fill("example@example.com");
  await page.getByRole("button", { name: "Проверить формат" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "false");
  await expect(
    page.getByText("Формат адреса верный. Данные никуда не отправлены."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Название примера" })
    .fill("Новая композиция");
  await expect(page.locator(".live-preview h3")).toHaveText("Новая композиция");
});

test("header switches without resizing, and motion respects the system preference", async ({
  page,
}) => {
  await openReady(page);
  const header = page.locator(".site-header");
  const before = await header.boundingBox();
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
  await expect(header).toHaveClass(/site-header--glass/);
  expect((await header.boundingBox())?.height).toBe(before?.height);
  await page.evaluate(() => window.scrollTo({ top: 24, behavior: "instant" }));
  await expect(header).toHaveClass(/site-header--glass/);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(header).not.toHaveClass(/site-header--glass/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#motion").scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Статичная композиция")).toBeDisabled();
  for (const shape of await page.locator(".motion-shape").all())
    await expect(shape).toHaveCSS("transform", "none");
});

test("layout fits all target sizes and images load", async ({ page }) => {
  await openReady(page);
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      `overflow at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.locator(".footer").scrollIntoViewIfNeeded();
  for (const img of await page.locator("img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el) =>
            (el as HTMLImageElement).complete &&
            (el as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
});

test("no JavaScript explains the age gate and keeps the interface inert", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  expect(await page.locator("noscript").textContent()).toContain(
    "включите JavaScript",
  );
  await expect(page.locator("#top")).toHaveAttribute("inert", "");
  await expect(page.locator(".motion-shape--black")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await context.close();
});

test("text enlarged to 200% reflows at narrow and wide sizes", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openReady(page);
    await page.evaluate(() => {
      const sizes = Array.from(
        document.querySelectorAll<HTMLElement>("body *"),
      ).map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }));
      for (const { el, size } of sizes) el.style.fontSize = `${size * 2}px`;
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      `200% text overflows at ${width}px`,
    ).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("scroll composition reverses and static override returns the final frame", async ({
  page,
}) => {
  await openReady(page);
  const scene = page.locator(".motion-scene");
  const top = await scene.evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );
  const viewport = page.viewportSize()!.height;
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top - viewport * 0.7,
  );
  await expect
    .poll(() =>
      scene.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--remaining")),
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      scene.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--remaining")),
      ),
    )
    .toBeLessThan(1);
  const initial = await scene.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--remaining"),
  );
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top,
  );
  await expect
    .poll(() =>
      scene.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--remaining")),
      ),
    )
    .toBe(0);
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top - viewport * 0.7,
  );
  await expect
    .poll(() =>
      scene.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--remaining"),
      ),
    )
    .toBe(initial);
  await page.getByLabel("Статичная композиция").check();
  await expect
    .poll(() =>
      scene.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--remaining")),
      ),
    )
    .toBe(0);
});
