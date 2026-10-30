export const SIZE = 64;
export const PARTS = {
  head: { label: "머리", size: [8, 8, 8], base: [0, 0], overlay: [32, 0] },
  body: { label: "몸통", size: [8, 12, 4], base: [16, 16], overlay: [16, 32] },
  rightArm: {
    label: "오른팔",
    size: [4, 12, 4],
    base: [40, 16],
    overlay: [40, 32],
  },
  leftArm: {
    label: "왼팔",
    size: [4, 12, 4],
    base: [32, 48],
    overlay: [48, 48],
  },
  rightLeg: {
    label: "오른다리",
    size: [4, 12, 4],
    base: [0, 16],
    overlay: [0, 32],
  },
  leftLeg: {
    label: "왼다리",
    size: [4, 12, 4],
    base: [16, 48],
    overlay: [0, 48],
  },
};

export function faces(part, layer, model = "default") {
  const spec = PARTS[part];
  const [u, v] = spec[layer];
  const [normalWidth, height, depth] = spec.size;
  const width = model === "slim" && part.endsWith("Arm") ? 3 : normalWidth;
  return [
    { name: "오른쪽", x: u + depth + width, y: v + depth, w: depth, h: height },
    { name: "왼쪽", x: u, y: v + depth, w: depth, h: height },
    { name: "위", x: u + depth, y: v, w: width, h: depth },
    { name: "아래", x: u + depth + width, y: v, w: width, h: depth },
    { name: "앞", x: u + depth, y: v + depth, w: width, h: height },
    { name: "뒤", x: u + depth * 2 + width, y: v + depth, w: width, h: height },
  ];
}

export function locate(x, y, layer, model, visible = Object.keys(PARTS)) {
  for (const part of visible) {
    const regions = faces(part, layer, model);
    for (let face = 0; face < regions.length; face++) {
      const r = regions[face];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        return { x, y, part, face, region: r };
      }
    }
  }
  return null;
}

export function uvPixel(uv, region) {
  return {
    x: Math.max(
      region.x,
      Math.min(region.x + region.w - 1, Math.floor(uv.x * SIZE)),
    ),
    y: Math.max(
      region.y,
      Math.min(region.y + region.h - 1, Math.floor((1 - uv.y) * SIZE)),
    ),
  };
}

export function rgba(hex) {
  return [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    .concat(255);
}
export function pixel(data, x, y) {
  return Array.from(data.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4));
}
export function putPixel(data, x, y, color) {
  data.set(color, (y * SIZE + x) * 4);
}
export function line(x0, y0, x1, y1, visit) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    visit(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
  }
}
export function floodFill(data, x, y, color, region) {
  const target = pixel(data, x, y);
  if (target.every((v, i) => v === color[i])) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (
      cx < region.x ||
      cx >= region.x + region.w ||
      cy < region.y ||
      cy >= region.y + region.h
    )
      continue;
    if (!pixel(data, cx, cy).every((v, i) => v === target[i])) continue;
    putPixel(data, cx, cy, color);
    stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
  }
}

export function createStarter(model = "default") {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (const part of Object.keys(PARTS)) {
    for (const r of faces(part, "base", model)) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const row = y - r.y;
          let color;
          if (part === "head")
            color = r.name === "앞" && row > 1 ? "#e8b28f" : "#493930";
          else if (part === "body" || part.endsWith("Arm"))
            color = part.endsWith("Arm") && row > 7 ? "#e8b28f" : "#68cbb1";
          else color = row > 9 ? "#252e3e" : "#465375";
          putPixel(data, x, y, rgba(color));
        }
      }
    }
  }
  for (const x of [9, 10, 13, 14]) putPixel(data, x, 11, rgba("#ffffff"));
  for (const x of [10, 13]) putPixel(data, x, 11, rgba("#33475f"));
  for (const x of [11, 12]) putPixel(data, x, 14, rgba("#b67566"));
  return data;
}

export class History {
  undoStack = [];
  redoStack = [];
  push(before, after) {
    if (
      before.model === after.model &&
      before.data.every((v, i) => v === after.data[i])
    )
      return false;
    this.undoStack.push({ data: before.data.slice(), model: before.model });
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }
  undo(current) {
    if (!this.undoStack.length) return null;
    this.redoStack.push({ data: current.data.slice(), model: current.model });
    return this.undoStack.pop();
  }
  redo(current) {
    if (!this.redoStack.length) return null;
    this.undoStack.push({ data: current.data.slice(), model: current.model });
    return this.redoStack.pop();
  }
}
