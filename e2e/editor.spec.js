import { test, expect } from "@playwright/test";

const saved = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("coolmc.skin-studio.v1")),
  );
const waitSaved = (page) =>
  expect(page.locator("#save-status")).toContainText("자동 저장됨");

test("3D painting, undo/redo, live animation, download and reload work together", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await waitSaved(page);
  await expect(page.locator("#webgl-error")).toBeHidden();
  const initial = await saved(page);
  await page.locator("#picker-hex").fill("#FF0000");
  await page.locator("#picker-hex").press("Tab");
  await page.locator("#reset-view").click();
  const canvas = page.locator("#editor-canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#pixel-info")).toContainText("몸통");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await waitSaved(page);
  const painted = await saved(page);
  expect(painted.pixels).not.toEqual(initial.pixels);
  await page.locator("#undo").click();
  await waitSaved(page);
  expect((await saved(page)).pixels).toEqual(initial.pixels);
  await page.locator("#redo").click();
  await waitSaved(page);
  expect((await saved(page)).pixels).toEqual(painted.pixels);
  const preview = page.locator("#preview-canvas");
  const walking = await preview.screenshot();
  await page.waitForTimeout(350);
  expect((await preview.screenshot()).equals(walking)).toBe(false);
  await page.locator("#pause").click();
  await page.waitForTimeout(150);
  const paused = await preview.screenshot();
  await page.waitForTimeout(200);
  expect((await preview.screenshot()).equals(paused)).toBe(true);
  for (const animation of ["idle", "run", "wave", "fly", "crouch"])
    await page.locator("#animation").selectOption(animation);
  await page.locator("#animation").selectOption("walk");
  await page.locator("#pause").click();
  await page.locator("#model").selectOption("slim");
  await waitSaved(page);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("coolmc-skin-slim.png");
  const path = await download.path();
  await page.locator("#file").setInputFiles(path);
  await waitSaved(page);
  expect((await saved(page)).pixels).toEqual(painted.pixels);
  await page.reload();
  await waitSaved(page);
  await expect(page.locator("#model")).toHaveValue("slim");
  expect((await saved(page)).pixels).toEqual(painted.pixels);
  await page.screenshot({ path: ".preview/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("overlay edits, fill, eraser, picker, visibility and invalid files", async ({
  page,
}) => {
  await page.goto("/");
  await waitSaved(page);
  const initial = await saved(page);
  await page.locator('[data-view="2d"]').click();
  await page.locator('input[name="layer"][value="overlay"]').check();
  await page.locator("#picker-hex").fill("#FF0000");
  await page.locator("#picker-hex").press("Tab");
  await page.locator('[data-tool="fill"]').click();
  const clickPixel = async (x, y) => {
    await page.locator(".editor-panel").scrollIntoViewIfNeeded();
    const box = await page.locator("#texture-canvas").boundingBox();
    await page.mouse.click(
      box.x + ((x + 0.5) / 64) * box.width,
      box.y + ((y + 0.5) / 64) * box.height,
    );
  };
  await clickPixel(40, 8);
  await waitSaved(page);
  const filled = await saved(page);
  expect(filled.pixels.slice((8 * 64 + 40) * 4, (8 * 64 + 40) * 4 + 4)).toEqual(
    [255, 0, 0, 255],
  );
  expect(filled.pixels.slice((8 * 64 + 39) * 4, (8 * 64 + 39) * 4 + 4)).toEqual(
    [0, 0, 0, 0],
  );
  expect(filled.pixels.slice(0, 32 * 4)).toEqual(
    initial.pixels.slice(0, 32 * 4),
  );
  await page.locator('[data-tool="eraser"]').click();
  await clickPixel(40, 8);
  await waitSaved(page);
  expect((await saved(page)).pixels[(8 * 64 + 40) * 4 + 3]).toBe(0);
  await page.locator('[data-tool="picker"]').click();
  await clickPixel(41, 8);
  await expect(page.locator("#picker-hex")).toHaveValue("#FF0000");
  await page.locator("#overlay-visible").uncheck();
  await expect(page.locator('input[name="layer"][value="base"]')).toBeChecked();
  await page
    .locator("#parts label")
    .filter({ hasText: "머리" })
    .locator("input")
    .uncheck();
  await page.locator("#file").setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator("#toast")).toContainText("PNG 파일만");
});

test("mobile layout has no horizontal overflow and controls remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitSaved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("#webgl-error")).toBeHidden();
  await page.locator("#show-side").click();
  await page.locator("#animation").selectOption("run");
  await page.screenshot({ path: ".preview/mobile.png", fullPage: true });
});
