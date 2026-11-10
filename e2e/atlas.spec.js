import { test, expect } from "@playwright/test";

test("matching atlases pan and zoom together without painting and pick transformed pixels", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const fixture = await page.evaluate(() => {
    const pixels = JSON.parse(
      localStorage.getItem("coolmc.skin-studio.v1"),
    ).pixels;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    canvas
      .getContext("2d")
      .putImageData(new ImageData(new Uint8ClampedArray(pixels), 64, 64), 0, 0);
    return { pixels, url: canvas.toDataURL() };
  });
  await page.locator("#reference-files").setInputFiles({
    name: "same.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture.url.split(",")[1], "base64"),
  });
  await page.locator('[data-view="2d"]').click();
  await page.mouse.move(5, 5);
  const edit = page.locator("#texture-canvas"),
    ref = page.locator("#ref-sheet");
  await expect(ref).toBeVisible();
  const pixelsOf = (locator) => locator.evaluate((c) => c.toDataURL());
  expect(await pixelsOf(edit)).toEqual(await pixelsOf(ref));
  const before = await ref.boundingBox();
  expect((await edit.boundingBox()).width).toBeCloseTo(before.width, 0);
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.wheel(0, -250);
  await expect
    .poll(async () => (await ref.boundingBox()).width)
    .toBeGreaterThan(before.width);
  expect((await edit.boundingBox()).width).toBeCloseTo(
    (await ref.boundingBox()).width,
    0,
  );
  const zoomed = await ref.boundingBox();
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    before.x + before.width / 2 + 35,
    before.y + before.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up({ button: "right" });
  expect((await ref.boundingBox()).x - zoomed.x).toBeCloseTo(35, 0);
  expect((await edit.boundingBox()).y).toBeCloseTo(
    (await ref.boundingBox()).y,
    0,
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("coolmc.skin-studio.v1")).pixels,
    ),
  ).toEqual(fixture.pixels);
  await page.locator("#reference-sync").uncheck();
  const editorWidth = (await edit.boundingBox()).width;
  const stage = await page.locator(".reference-sheet-wrap").boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.wheel(0, -100);
  await expect
    .poll(async () => (await ref.boundingBox()).width)
    .toBeGreaterThan(editorWidth);
  expect((await edit.boundingBox()).width).toBeCloseTo(editorWidth, 0);
  await page.locator("#reference-sync").check();
  await page.locator("#picker-hex").fill("#123456");
  await page.locator("#picker-hex").press("Tab");
  await page.locator('[data-tool="picker"]').click();
  const box = await ref.boundingBox();
  await page.mouse.click(
    box.x + (box.width * 24.5) / 64,
    box.y + (box.height * 24.5) / 64,
  );
  const index = (24 * 64 + 24) * 4;
  const color =
    "#" +
    fixture.pixels
      .slice(index, index + 3)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  await expect(page.locator("#picker-hex")).toHaveValue(color);
  await page.locator("#reset-view").click();
  expect((await ref.boundingBox()).width).toBeCloseTo(before.width, 0);
  await page.screenshot({
    path: ".preview/atlas-comparison.png",
    fullPage: true,
  });
});
