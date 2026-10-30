import { PARTS, faces, pixel, putPixel } from "./skin.js";

export function regionsFor(parts, layer, model, face = "all") {
  return parts.flatMap((part) =>
    (layer === "both" ? ["base", "overlay"] : [layer]).flatMap((name) =>
      faces(part, name, model).filter(
        (_, index) => face === "all" || index === Number(face),
      ),
    ),
  );
}
export function composeSkin(target, source, options) {
  const {
    parts,
    layer,
    model,
    sourceModel,
    face = "all",
    rectangle = null,
    includeTransparent = false,
  } = options;
  if (!parts.length) throw new Error("합성할 부위를 선택하세요.");
  if (model !== sourceModel && parts.some((part) => part.endsWith("Arm")))
    throw new Error(
      "Classic과 Slim의 팔은 직접 합성할 수 없습니다. 팔 선택을 해제하거나 같은 모델을 사용하세요.",
    );
  const data = target.slice();
  let changed = 0;
  for (const r of regionsFor(parts, layer, model, face)) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (
          rectangle &&
          (x < rectangle.x ||
            y < rectangle.y ||
            x >= rectangle.x + rectangle.w ||
            y >= rectangle.y + rectangle.h)
        )
          continue;
        const color = pixel(source, x, y);
        if (!includeTransparent && color[3] === 0) continue;
        if (!color.every((v, i) => v === pixel(data, x, y)[i])) {
          putPixel(data, x, y, color);
          changed++;
        }
      }
  }
  return { data, changed };
}
export function extractPalette(
  data,
  parts = Object.keys(PARTS),
  layer = "both",
  model = "default",
) {
  const counts = new Map();
  let total = 0;
  for (const r of regionsFor(parts, layer, model)) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const color = pixel(data, x, y);
        if (!color[3]) continue;
        const hex =
          "#" +
          color
            .slice(0, 3)
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
        counts.set(hex, (counts.get(hex) || 0) + 1);
        total++;
      }
  }
  return [...counts]
    .map(([color, count]) => ({
      color,
      count,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

export async function readSkinPng(file) {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("PNG 파일은 2MB 이하로 선택하세요.");
  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  if (
    header.length < 24 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => header[i] === v)
  )
    throw new Error("PNG 파일만 불러올 수 있습니다.");
  const dimensions = new DataView(header.buffer);
  if (dimensions.getUint32(16) !== 64 || dimensions.getUint32(20) !== 64)
    throw new Error("현재는 64×64 스킨 PNG만 지원합니다.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, 64, 64).data;
  } finally {
    bitmap.close();
  }
}
