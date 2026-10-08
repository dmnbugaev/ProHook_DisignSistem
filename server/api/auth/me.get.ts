import { getSessionUser } from "../../utils/session";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  return { user: await getSessionUser(event) };
});
