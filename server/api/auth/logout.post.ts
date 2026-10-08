import { endSession } from "../../utils/session";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  if (getHeader(event, "sec-fetch-site") === "cross-site")
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  await endSession(event);
  return { ok: true };
});
