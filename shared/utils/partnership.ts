export type Partnership = {
  name: string;
  phone: string;
  city: string;
  company: string;
  offer: string;
  /** Отдельное согласие на обработку персональных данных (152-ФЗ ст. 9). */
  consent: boolean;
  /** Отдельное согласие на передачу данных через Telegram (трансграничная). */
  consentTelegram: boolean;
};

export function validatePartnership(input: unknown) {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const data: Partnership = {
    name: "",
    phone: "",
    city: "",
    company: "",
    offer: "",
    consent: raw.consent === true,
    consentTelegram: raw.consentTelegram === true,
  };
  for (const key of ["name", "phone", "city", "company"] as const) {
    const value = raw[key];
    data[key] = typeof value === "string" ? value.trim() : "";
    const max = key === "phone" ? 32 : 150;
    if (
      !data[key] ||
      data[key].length > max ||
      Array.from(data[key]).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    ) {
      errors[key] = `Заполните поле (до ${max} символов).`;
    }
  }
  if (!errors.name && data.name.length < 2) errors.name = "Укажите ваше имя.";
  if (
    !errors.phone &&
    (!/^\+?[\d\s()-]+$/.test(data.phone) ||
      !/^\d{10,15}$/.test(data.phone.replace(/\D/g, "")))
  ) {
    errors.phone = "Укажите телефон: от 10 до 15 цифр, можно с кодом страны.";
  }
  // Whitespace is collapsed so a proposal can never forge extra message lines.
  data.offer =
    typeof raw.offer === "string" ? raw.offer.trim().replace(/\s+/g, " ") : "";
  if (
    data.offer.length < 10 ||
    data.offer.length > 500 ||
    Array.from(data.offer).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  ) {
    errors.offer = "Опишите предложение (от 10 до 500 символов).";
  }
  if (!data.consent)
    errors.consent = "Подтвердите согласие на обработку персональных данных.";
  if (!data.consentTelegram)
    errors.consentTelegram =
      "Подтвердите согласие на передачу заявки через Telegram.";
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
