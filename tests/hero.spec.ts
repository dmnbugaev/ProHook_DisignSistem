import { test, expect } from "@playwright/test";

test("hero fits a phone and stops moving when reduced motion is requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const items = page.locator(".floating-scene__item");
  await expect(items).toHaveCount(11);
  await expect(page.locator(".floating-scene__item img")).toHaveCount(11);
  expect(
    await items
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      items
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("none");
  const verticalSpread = await page.evaluate(() => {
    const centers = [...document.querySelectorAll(".floating-scene__item")]
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => {
        const box = element.getBoundingClientRect();
        return box.top + box.height / 2;
      });
    return Math.max(...centers) - Math.min(...centers);
  });
  expect(verticalSpread).toBeGreaterThan(180);
  const mark = await page.evaluate(() => {
    const square = document
      .querySelector(".floating-scene__center")!
      .getBoundingClientRect();
    const image = document
      .querySelector(".floating-scene__center img")!
      .getBoundingClientRect();
    return { square: [square.width, square.height], imageWidth: image.width };
  });
  expect(Math.abs(mark.square[0] - mark.square[1])).toBeLessThan(1);
  expect(mark.imageWidth / mark.square[0]).toBeGreaterThan(0.95);
  await expect(page.locator(".hero__stat")).toHaveCount(3);
  await page
    .locator(".hero__stat strong")
    .nth(1)
    .evaluate((element) => {
      element.textContent = "5 477+";
    });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const mobileLayout = await page.evaluate(() => {
      const copy = document.querySelector(".hero__copy")!;
      const button = copy.querySelector(".button")!.getBoundingClientRect();
      const center = copy.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".hero__stat")].map(
        (element) => {
          const box = element.getBoundingClientRect();
          const number = element
            .querySelector("strong")!
            .getBoundingClientRect();
          const label = element.querySelector("span")!.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            height: box.height,
            radius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
            numberFits: number.left >= box.left && number.right <= box.right,
            numberGap: label.top - number.bottom,
          };
        },
      );
      return {
        copyAlignment: getComputedStyle(copy).textAlign,
        buttonOffset:
          button.left + button.width / 2 - (center.left + center.width / 2),
        cards,
      };
    });
    expect(mobileLayout.copyAlignment).toBe("center");
    expect(Math.abs(mobileLayout.buttonOffset)).toBeLessThan(1);
    expect(
      Math.max(...mobileLayout.cards.map((card) => card.top)) -
        Math.min(...mobileLayout.cards.map((card) => card.top)),
    ).toBeLessThan(1);
    for (const card of mobileLayout.cards) {
      expect(card.left).toBeGreaterThanOrEqual(0);
      expect(card.right).toBeLessThanOrEqual(width);
      expect(card.height).toBeLessThanOrEqual(100);
      expect(card.radius).toBeGreaterThanOrEqual(8);
      expect(card.numberFits).toBe(true);
      expect(card.numberGap).toBeGreaterThan(0);
      expect(card.numberGap).toBeLessThanOrEqual(12);
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("hero scene spans the content row without a card background or crop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const layout = await page.evaluate(() => {
    const hero = document.querySelector(".hero")!;
    const scene = document.querySelector(".floating-scene")!;
    return {
      heroWidth: hero.getBoundingClientRect().width,
      sceneWidth: scene.getBoundingClientRect().width,
      background: getComputedStyle(scene).backgroundColor,
      overflow: getComputedStyle(scene).overflow,
    };
  });
  expect(layout.sceneWidth).toBe(layout.heroWidth);
  expect(layout.background).toBe("rgba(0, 0, 0, 0)");
  expect(layout.overflow).toBe("visible");
});

test("hero has its final height before JavaScript starts", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1200 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const layout = await page.locator(".hero--screen").evaluate((element) => ({
      minHeight: parseFloat(getComputedStyle(element).minHeight),
      availableHeight: innerHeight - element.getBoundingClientRect().top,
    }));
    expect(Math.abs(layout.minHeight - layout.availableHeight)).toBeLessThan(2);
  } finally {
    await context.close();
  }
});

test("floating items enter their idle motion without jumping", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.addEventListener(
      "animationstart",
      (event) => {
        const element = event.target;
        if (
          !(element instanceof HTMLElement) ||
          !element.classList.contains("floating-scene__drift") ||
          !event.animationName.includes("item-drift")
        )
          return;
        const matrix = new DOMMatrixReadOnly(
          getComputedStyle(element).transform,
        );
        Object.assign(window, {
          heroDriftStart: {
            x: matrix.m41,
            y: matrix.m42,
            rotation: matrix.m12,
          },
        });
      },
      true,
    );
  });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              heroDriftStart?: { x: number; y: number; rotation: number };
            }
          ).heroDriftStart,
      ),
    )
    .toBeTruthy();
  const start = await page.evaluate(
    () =>
      (
        window as typeof window & {
          heroDriftStart: { x: number; y: number; rotation: number };
        }
      ).heroDriftStart,
  );
  expect(Math.abs(start.x)).toBeLessThan(0.5);
  expect(Math.abs(start.y)).toBeLessThan(0.5);
  expect(Math.abs(start.rotation)).toBeLessThan(0.01);
});
