import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";

await mkdir("public/brand", { recursive: true });
const source = "логотп и изображения/";
for (const [file, output, size] of [
  ["2.png", "mark.webp", 160],
  ["2.png", "mark-large.webp", 720],
  ["3.png", "lockup.webp", 720],
  ["Иконка 1.png", "icon.webp", 640],
]) {
  await sharp(source + file)
    .resize(size, size, { fit: "inside" })
    .webp({ quality: 90 })
    .toFile("public/brand/" + output);
}
await sharp(source + "2.png")
  .resize(64, 64)
  .png()
  .toFile("public/brand/favicon.png");
await mkdir("public/fonts", { recursive: true });
await copyFile(
  "node_modules/@fontsource-variable/golos-text/LICENSE",
  "public/fonts/Golos-Text-OFL.txt",
);
