import test from "node:test";
import assert from "node:assert/strict";
import { fillFace, shadePixel } from "../src/tools.js";
test("face paint replaces every face pixel and preserves other regions", () => {
  const data = new Uint8ClampedArray(16384);
  data.fill(17);
  const before = data.slice();
  fillFace(data, { x: 8, y: 8, w: 8, h: 8 }, [30, 60, 90, 255]);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      assert.deepEqual(
        Array.from(data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)),
        x >= 8 && x < 16 && y >= 8 && y < 16
          ? [30, 60, 90, 255]
          : Array.from(before.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)),
      );
});
test("burn and dodge preserve alpha, clamp RGB and ignore transparent pixels", () => {
  const data = new Uint8ClampedArray(16384);
  data.set([100, 150, 200, 128]);
  shadePixel(data, 0, 0, "burn");
  assert.deepEqual(Array.from(data.slice(0, 4)), [85, 128, 170, 128]);
  shadePixel(data, 0, 0, "dodge");
  assert.deepEqual(Array.from(data.slice(0, 4)), [111, 147, 183, 128]);
  data.set([99, 88, 77, 0], 4);
  shadePixel(data, 1, 0, "dodge");
  assert.deepEqual(Array.from(data.slice(4, 8)), [99, 88, 77, 0]);
});
import { composeSkin, extractPalette } from "../src/reference-data.js";
import {
  PARTS,
  SIZE,
  faces,
  locate,
  uvPixel,
  rgba,
  pixel,
  putPixel,
  floodFill,
  line,
  createStarter,
  History,
} from "../src/skin.js";

test("composition preserves all unselected parts and layers, including transparent pixels", () => {
  const target = createStarter();
  const source = new Uint8ClampedArray(target.length);
  putPixel(source, 8, 8, rgba("#ff00ff"));
  const options = {
    parts: ["head"],
    layer: "base",
    model: "default",
    sourceModel: "default",
  };
  const result = composeSkin(target, source, options);
  assert.equal(result.changed, 1);
  assert.deepEqual(pixel(result.data, 8, 8), rgba("#ff00ff"));
  assert.deepEqual(pixel(result.data, 9, 8), pixel(target, 9, 8));
  assert.deepEqual(result.data.slice(16 * 64 * 4), target.slice(16 * 64 * 4));
  assert.deepEqual(pixel(target, 8, 8), pixel(createStarter(), 8, 8));
  const replaced = composeSkin(target, source, {
    ...options,
    includeTransparent: true,
  });
  assert.equal(pixel(replaced.data, 9, 8)[3], 0);
});
test("composition intersects rectangle, face and part masks and blocks mismatched arms", () => {
  const target = new Uint8ClampedArray(16384);
  const source = createStarter();
  const options = {
    parts: ["head"],
    layer: "base",
    model: "default",
    sourceModel: "slim",
    face: "4",
    rectangle: { x: 7, y: 8, w: 3, h: 2 },
  };
  const result = composeSkin(target, source, options);
  assert.equal(result.changed, 4);
  assert.equal(pixel(result.data, 7, 8)[3], 0);
  assert.equal(pixel(result.data, 10, 8)[3], 0);
  assert.throws(
    () => composeSkin(target, source, { ...options, parts: ["rightArm"] }),
    /팔/,
  );
  assert.throws(
    () => composeSkin(target, source, { ...options, parts: [] }),
    /부위/,
  );
});
test("palette uses valid selected regions, excludes transparent pixels and counts exact RGB", () => {
  const data = new Uint8ClampedArray(16384);
  putPixel(data, 8, 8, [255, 0, 0, 255]);
  putPixel(data, 9, 8, [255, 0, 0, 128]);
  putPixel(data, 10, 8, [0, 0, 255, 255]);
  putPixel(data, 11, 8, [255, 255, 0, 0]);
  putPixel(data, 0, 0, [0, 255, 0, 255]);
  putPixel(data, 20, 20, [0, 255, 0, 255]);
  const palette = extractPalette(data, ["head"], "base", "default");
  assert.equal(palette.length, 2);
  assert.equal(palette[0].color, "#ff0000");
  assert.equal(palette[0].count, 2);
  assert.ok(Math.abs(palette[0].percentage - 200 / 3) < 0.001);
  assert.deepEqual(extractPalette(data, ["head"], "overlay"), []);
});

test("UV regions fit the atlas and do not overlap for either model or layer", () => {
  for (const model of ["default", "slim"]) {
    const occupied = new Set();
    for (const layer of ["base", "overlay"])
      for (const part of Object.keys(PARTS)) {
        for (const region of faces(part, layer, model)) {
          for (let y = region.y; y < region.y + region.h; y++)
            for (let x = region.x; x < region.x + region.w; x++) {
              assert.ok(x >= 0 && y >= 0 && x < SIZE && y < SIZE);
              assert.ok(
                !occupied.has(`${x},${y}`),
                `${model} overlap: ${part} ${layer} ${x},${y}`,
              );
              occupied.add(`${x},${y}`);
              assert.equal(locate(x, y, layer, model).part, part);
            }
        }
      }
  }
});
test("UV pixel selection clamps face edges without bleeding into adjacent faces", () => {
  const region = faces("head", "base")[4];
  assert.deepEqual(uvPixel({ x: 16 / 64, y: 1 - 16 / 64 }, region), {
    x: 15,
    y: 15,
  });
  assert.deepEqual(uvPixel({ x: 8 / 64, y: 1 - 8 / 64 }, region), {
    x: 8,
    y: 8,
  });
});
test("flood fill stays on the selected face and respects disconnected colors", () => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  const red = rgba("#ff0000");
  const blue = rgba("#0000ff");
  for (let y = 8; y < 16; y++) putPixel(data, 12, y, blue);
  floodFill(data, 8, 8, red, faces("head", "base")[4]);
  assert.deepEqual(pixel(data, 11, 15), red);
  assert.deepEqual(pixel(data, 12, 15), blue);
  assert.deepEqual(pixel(data, 13, 15), [0, 0, 0, 0]);
  assert.deepEqual(pixel(data, 7, 8), [0, 0, 0, 0]);
});
test("fast brush strokes interpolate every crossed pixel", () => {
  const points = [];
  line(0, 0, 7, 7, (x, y) => points.push([x, y]));
  assert.equal(points.length, 8);
  assert.deepEqual(points[7], [7, 7]);
});
test("history restores texture and model and invalidates redo after a new edit", () => {
  const history = new History();
  const before = { data: createStarter(), model: "default" };
  const after = { data: before.data.slice(), model: "slim" };
  putPixel(after.data, 8, 8, rgba("#ff0000"));
  assert.equal(history.push(before, before), false);
  history.push(before, after);
  const restored = history.undo(after);
  assert.deepEqual(restored, before);
  assert.deepEqual(history.redo(restored), after);
  history.undo(after);
  history.push(before, after);
  assert.equal(history.redoStack.length, 0);
});
test("starter paints all base pixels while keeping overlay transparent", () => {
  for (const model of ["default", "slim"]) {
    const data = createStarter(model);
    for (const part of Object.keys(PARTS))
      for (const layer of ["base", "overlay"]) {
        for (const r of faces(part, layer, model))
          for (let y = r.y; y < r.y + r.h; y++)
            for (let x = r.x; x < r.x + r.w; x++) {
              assert.equal(pixel(data, x, y)[3], layer === "base" ? 255 : 0);
            }
      }
  }
});
