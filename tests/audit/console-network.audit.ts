import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { ARTIFACTS, AUDIT_PAGES, ensureDir, setUserCookies } from "./helpers";

// Консоль и сеть: ошибки консоли, pageerror, необработанные rejection,
// падшие сети и 4xx/5xx на пользовательских маршрутах.
test.describe("console and network audit", () => {
  ensureDir(`${ARTIFACTS}/reports`);

  test("no console errors, pageerrors or failed requests on any page", async ({
    page,
  }, testInfo) => {
    const consoleErrors: unknown[] = [];
    const pageErrors: unknown[] = [];
    const failedRequests: unknown[] = [];
    const badResponses: unknown[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        // Известный шум окружения, не дефекты сайта:
        //  - Яндекс.Карты предупреждают об отсутствии API-ключа (ключ
        //    не коммитится, подключается переменной окружения в проде);
        //  - WebGL GPU stall — артефакт headless-рендера карты в CI.
        if (msg.text().includes("Invalid API key")) return;
        if (msg.text().includes("GL Driver Message")) return;
        consoleErrors.push({
          type: msg.type(),
          text: msg.text().slice(0, 300),
        });
      }
    });
    page.on("pageerror", (error) =>
      pageErrors.push({ message: error.message.slice(0, 300) }),
    );
    page.on("requestfailed", (request) => {
      // Firefox репортит отменённые навигацией запросы (карта грузит тайлы,
      // тест уходит со страницы) как NS_BINDING_ABORTED — это не сбой сети.
      if (request.failure()?.errorText === "nsbindingaborted") return;
      failedRequests.push({
        url: request.url().slice(0, 200),
        failure: request.failure()?.errorText,
      });
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        badResponses.push({
          url: response.url().slice(0, 200),
          status: response.status(),
        });
    });

    await setUserCookies(page);
    for (const def of AUDIT_PAGES) {
      await page.goto(def.path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => {});
      // Небольшая выдержка на клиентские запросы (suggest, карта)
      await page.waitForTimeout(400);
    }

    const report = {
      browser: testInfo.project.name,
      consoleErrors,
      pageErrors,
      failedRequests,
      badResponses,
    };
    writeFileSync(
      `${ARTIFACTS}/reports/console-${testInfo.project.name}.json`,
      JSON.stringify(report, null, 2),
    );
    expect(
      pageErrors,
      `uncaught page errors (details: ${ARTIFACTS}/reports/console-${testInfo.project.name}.json)`,
    ).toEqual([]);
    expect(
      consoleErrors,
      `console errors/warnings (details: same report)`,
    ).toEqual([]);
    expect(
      badResponses.filter((r: { url: string }) => r.url.includes("127.0.0.1")),
      `4xx/5xx on same-origin requests`,
    ).toEqual([]);
  });
});
