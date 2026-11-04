import { timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Полноцепочечные проверки монитор-бота (MonitorBot на myserver) помечают
 * свои тестовые заявки секретом в заголовке x-monitor-secret. Такая заявка
 * создаётся и видна сотрудникам в инбоксе, но не рассылается в Telegram и
 * не создаёт fallback-задачу в МойСклад (мандат владельца 05.11.2026:
 * уведомления о тестах не должны приходить в бизнес-боты — только отчёты
 * монитор-бота). Секрет известен только серверу и монитор-боту, сравнение
 * агностично по времени — пометку извне не подделать.
 */
export function isMonitorProbe(event: H3Event): boolean {
  const expected = process.env.MONITOR_SECRET?.trim() ?? "";
  const provided = getHeader(event, "x-monitor-secret")?.trim() ?? "";
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
