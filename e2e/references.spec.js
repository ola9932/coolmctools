import { test, expect } from "@playwright/test";
import { createStarter, faces, putPixel, rgba } from "../src/skin.js";

const saved = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("coolmc.skin-studio.v1")),
  );
async function fixture(page, color, name = "reference.png") {
  const data = createStarter();
  for (const layer of ["base", "overlay"])
    for (const r of faces("head", layer))
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) putPixel(data, x, y, rgba(color));
  const url = await page.evaluate((pixels) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    c.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(pixels), 64, 64),
      0,
      0,
    );
    return c.toDataURL();
  }, Array.from(data));
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(url.split(",")[1], "base64"),
  };
}
test("one-page references preserve editing, compose reversibly, extract colors and restore", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const initial = await saved(page);
  await page
    .locator("#reference-files")
    .setInputFiles([
      await fixture(page, "#ff00ff", "pink.png"),
      await fixture(page, "#00ffff", "cyan.png"),
    ]);
  await expect(page.locator("#reference-select option")).toHaveCount(2);
  expect((await saved(page)).pixels).toEqual(initial.pixels);
  const options = await page
    .locator("#reference-select option")
    .evaluateAll((nodes) => nodes.map((node) => node.value));
  await page.locator("#reference-select").selectOption(options[0]);
  await expect(page.locator("#reference-part")).toHaveCount(0);
  await expect(page.locator("#reference-layer")).toHaveCount(0);
  await expect
    .poll(async () => {
      const a = await page.locator("#stage").boundingBox();
      const b = await page.locator(".reference-stage").boundingBox();
      return Math.max(
        Math.abs(a.y - b.y),
        Math.abs(a.height - b.height),
        Math.abs(a.width - b.width),
      );
    })
    .toBeLessThan(2);
  await page.locator("#reference-view").click();
  const sample = () =>
    page
      .locator("#ref-sheet")
      .evaluate((canvas) =>
        Array.from(canvas.getContext("2d").getImageData(102, 102, 1, 1).data),
      );
  expect((await sample()).slice(0, 3)).toEqual([255, 0, 255]);
  await page.locator("#parts label").first().locator("input").uncheck();
  expect((await sample()).slice(0, 3)).not.toEqual([255, 0, 255]);
  await page.locator("#parts label").first().locator("input").check();
  await page.locator("#base-visible").uncheck();
  expect((await sample()).slice(0, 3)).not.toEqual([255, 0, 255]);
  await page.locator("#base-visible").check();
  await page.locator("#reference-view").click();
  const width = (await page.locator("#stage").boundingBox()).width;
  await page.locator("#reference-toggle").uncheck();
  expect((await page.locator("#stage").boundingBox()).width).toBeGreaterThan(
    width,
  );
  await page.locator("#reference-toggle").check();
  await expect(page.locator("#reference-select")).toHaveValue(options[0]);
  await page.locator("#palette-extraction summary").click();
  await page.locator("#palette-source").selectOption("reference");
  await page.locator("#palette-part").selectOption("head");
  await page.locator("#palette-layer").selectOption("base");
  await expect(page.locator("#extracted-colors button")).toHaveCount(1);
  await page.locator("#extracted-colors button").click();
  await expect(page.locator("#extracted-colors button")).not.toContainText("#");
  await expect(page.locator("#extracted-colors button")).toHaveAttribute(
    "title",
    /#FF00FF/,
  );
  await page.locator("#pin-color").click();
  await expect(page.locator("#pinned-colors")).toContainText("#FF00FF");
  await page.locator("#compose-controls summary").click();
  await page.locator("#compose-layer").selectOption("base");
  await page.locator("#compose-preview").click();
  await expect(page.locator("#compose-dialog")).toBeVisible();
  expect((await saved(page)).pixels).toEqual(initial.pixels);
  await page.locator("#compose-cancel").click();
  expect((await saved(page)).pixels).toEqual(initial.pixels);
  await page.locator("#compose-preview").click();
  await page.locator("#compose-apply").click();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const composed = await saved(page);
  expect(composed.pixels.slice((8 * 64 + 8) * 4, (8 * 64 + 8) * 4 + 4)).toEqual(
    [255, 0, 255, 255],
  );
  expect(composed.pixels.slice(16 * 64 * 4)).toEqual(
    initial.pixels.slice(16 * 64 * 4),
  );
  await page.locator("#undo").click();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  expect((await saved(page)).pixels).toEqual(initial.pixels);
  await page.locator("#redo").click();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  expect((await saved(page)).pixels).toEqual(composed.pixels);
  await page.locator('[data-side="animation"]').click();
  await expect(page.locator("#preview-canvas")).toBeVisible();
  await page.locator('[data-side="reference"]').click();
  await page.reload();
  await expect(page.locator("#reference-select option")).toHaveCount(2);
  await expect(page.locator("#reference-select")).toHaveValue(options[0]);
  expect((await saved(page)).pixels).toEqual(composed.pixels);
  await page.screenshot({
    path: ".preview/integrated-reference.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("rectangle copy, model mismatch, reference picker and removal are isolated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const initial = await saved(page);
  await page
    .locator("#reference-files")
    .setInputFiles(await fixture(page, "#ff00ff"));
  await expect(page.locator("#reference-select")).not.toHaveValue("");
  await page.locator("#compose-controls summary").click();
  await page.locator("#compose-layer").selectOption("base");
  await page.locator("#select-rectangle").click();
  await page.locator("#ref-sheet").scrollIntoViewIfNeeded();
  let box = await page.locator("#ref-sheet").boundingBox();
  await page.mouse.move(
    box.x + (8.5 / 64) * box.width,
    box.y + (8.5 / 64) * box.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (9.5 / 64) * box.width,
    box.y + (9.5 / 64) * box.height,
  );
  await page.mouse.up();
  await expect(page.locator("#selection-info")).toContainText("2×2");
  await page.locator("#compose-preview").click();
  await expect(page.locator("#compose-summary")).toContainText("4픽셀");
  await page.locator("#compose-apply").click();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const next = await saved(page);
  let changed = 0;
  for (let i = 0; i < 16384; i += 4)
    if (next.pixels.slice(i, i + 4).some((v, j) => v !== initial.pixels[i + j]))
      changed++;
  expect(changed).toBe(4);
  await page.locator("#reference-pick").click();
  await page.locator("#ref-sheet").scrollIntoViewIfNeeded();
  box = await page.locator("#ref-sheet").boundingBox();
  await page.mouse.move(
    box.x + (8.5 / 64) * box.width,
    box.y + (8.5 / 64) * box.height,
  );
  await expect(page.locator(".pixel-magnifier")).toBeVisible();
  await page.mouse.click(
    box.x + (8.5 / 64) * box.width,
    box.y + (8.5 / 64) * box.height,
  );
  await expect(page.locator("#reference-readout")).toContainText("#FF00FF");
  await page.locator("#reference-model").selectOption("slim");
  await page.locator('#compose-parts input[value="rightArm"]').check();
  await page.locator("#compose-scope").selectOption("all");
  await page.locator("#compose-preview").click();
  await expect(page.locator("#toast")).toContainText("팔은 직접 합성");
  await expect(page.locator("#compose-dialog")).toBeHidden();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reference-remove").click();
  await expect(page.locator(".reference-empty")).toBeVisible();
  expect((await saved(page)).pixels).toEqual(next.pixels);
});
test("mobile switches between editing and reference on the same page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .locator("#reference-files")
    .setInputFiles(await fixture(page, "#ff00ff"));
  await expect(page.locator("#reference-toggle")).toBeChecked();
  await expect(page.locator(".editor-panel")).toBeVisible();
  await page.locator("#show-side").click();
  await expect(page.locator(".reference-panel")).toBeVisible();
  await expect(page.locator(".editor-panel")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".preview/integrated-mobile.png",
    fullPage: true,
  });
  await page.locator("#show-editor").click();
  await expect(page.locator(".editor-panel")).toBeVisible();
  expect(page.url()).toMatch(/5173\/$/);
});
