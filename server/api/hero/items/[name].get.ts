import { canViewProductImages } from "../../../utils/session";

const NAMES = new Set([
  "device-red",
  "pack-mint",
  "stick-orange",
  "device-violet",
  "pack-yellow",
  "stick-single",
  "device-green",
  "pack-coral",
  "stick-close",
  "device-amber",
  "pack-teal",
]);

/** Фото из эскиза героя: те же требования к возрасту, что у фото товаров. */
export default defineEventHandler(async (event) => {
  if (!(await canViewProductImages(event)))
    throw createError({ statusCode: 403, statusMessage: "Adults only" });

  const name = getRouterParam(event, "name") || "";
  if (!NAMES.has(name))
    throw createError({ statusCode: 404, statusMessage: "Not found" });

  const image = await useStorage("assets:hero").getItemRaw(`${name}.webp`);
  if (!image)
    throw createError({ statusCode: 404, statusMessage: "Not found" });

  setHeader(event, "Content-Type", "image/webp");
  setHeader(event, "Cache-Control", "private, max-age=300");
  return image;
});
