/**
 * Резервный канал уведомлений для форм: задачи в МойСклад.
 *
 * Хостер продакшн-VPS блокирует api.telegram.org на сетевом уровне
 * (диагностика 11.10.2026: TCP 443 к IPv4 Telegram таймаутит, IPv6 не
 * маршрутизируется), поэтому Telegram-доставка с хостинга невозможна.
 * API МойСклад с того же хостинга доступен (каталог синхронизируется) —
 * при сбое Telegram уведомление сохраняется задачей сотруднику в МойСклад.
 *
 * Исполнитель задачи: env MOYSKLAD_NOTIFY_EMPLOYEE_ID (id сотрудника
 * МойСклад) или владелец API-токена (context/employee, кэш на час).
 * Без настроенного токена МойСклад канал молча отключён (dev/e2e).
 */

const API = "https://api.moysklad.ru/api/remap/1.2/";

function token(): string {
  return (
    process.env.NUXT_MOYSKLAD_TOKEN?.trim() ||
    process.env.MOYSKLAD_TOKEN?.trim() ||
    ""
  );
}

/** Одна строка без управляющих символов — как в Telegram-сообщениях. */
function plain(value: string): string {
  const stripped = Array.from(value)
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char,
    )
    .join("");
  return stripped.replace(/\s+/g, " ").trim();
}

let assigneeCache: { id: string; expires: number } | undefined;

async function resolveAssignee(auth: string): Promise<string | null> {
  const configured = process.env.MOYSKLAD_NOTIFY_EMPLOYEE_ID?.trim();
  if (configured) return configured;
  if (assigneeCache && assigneeCache.expires > Date.now())
    return assigneeCache.id;
  const response = await fetch(`${API}context/employee`, {
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: "application/json;charset=utf-8",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const employee = (await response.json()) as { id?: string };
  if (!employee.id) return null;
  assigneeCache = { id: employee.id, expires: Date.now() + 60 * 60 * 1000 };
  return employee.id;
}

/**
 * Создаёт задачу «Позвонить/обработать» в МойСклад. Best-effort: возвращает
 * true при успехе; вызывающий код лишь логирует результат без ПД.
 */
export async function notifyStaffViaMoySklad(
  name: string,
  text: string,
): Promise<boolean> {
  // Тестовый режим (Playwright со снимком-фикстурой): боевой МойСклад
  // не затрагивается, иначе e2e-заявки создавали бы настоящие задачи.
  if (process.env.MOYSKLAD_SNAPSHOT_PATH) return false;
  const auth = token();
  if (!auth) return false;
  try {
    const assignee = await resolveAssignee(auth);
    // У задачи МойСклад нет отдельного «названия» — текстом задачи служит
    // description; короткий заголовок ставим в начало строки.
    const description = plain(`${name}. ${text}`).slice(0, 4000);
    const response = await fetch(`${API}entity/task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json;charset=utf-8",
      },
      body: JSON.stringify({
        description,
        ...(assignee
          ? {
              assignee: {
                meta: {
                  href: `${API}entity/employee/${assignee}`,
                  type: "employee",
                  mediaType: "application/json",
                },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Только для тестов: сброс кэша исполнителя. */
export function resetMoyskladNotifyForTests(): void {
  assigneeCache = undefined;
}
