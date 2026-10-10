import { getSessionUser } from "../../utils/session";
import { staffInboxAllowed } from "../../utils/staff-inbox";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  const user = await getSessionUser(event);
  return { user, staffInbox: staffInboxAllowed(user?.phone) };
});
