import { test, expect } from "@playwright/test";
test("face paint and shading are undoable and only shade once per stroke", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const data = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("coolmc.skin-studio.v1")).pixels,
    );
  const initial = await data();
  await page.locator('[data-view="2d"]').click();
  await page.locator("#picker-hex").fill("#804020");
  await page.locator("#picker-hex").press("Tab");
  const point = async () => {
    await page.locator("#stage").scrollIntoViewIfNeeded();
    const b = await page.locator("#texture-canvas").boundingBox();
    return { x: b.x + (10.5 / 64) * b.width, y: b.y + (10.5 / 64) * b.height };
  };
  const click = async () => {
    const p = await point();
    await page.mouse.move(p.x, p.y);
    await expect(page.locator("#pixel-info")).toContainText(
      "머리 · 앞 · 10, 10",
    );
    await page.mouse.click(p.x, p.y);
    await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  };
  await page.locator('[data-tool="bucket"]').click();
  await click();
  const painted = await data();
  for (let y = 8; y < 16; y++)
    for (let x = 8; x < 16; x++)
      expect(painted.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)).toEqual([
        128, 64, 32, 255,
      ]);
  expect(painted.slice(16 * 64 * 4)).toEqual(initial.slice(16 * 64 * 4));
  await page.locator('[data-tool="burn"]').click();
  const p = await point();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 1, p.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  expect(
    (await data()).slice((10 * 64 + 10) * 4, (10 * 64 + 10) * 4 + 4),
  ).toEqual([109, 54, 27, 255]);
  await page.locator('[data-tool="dodge"]').click();
  await click();
  expect(
    (await data()).slice((10 * 64 + 10) * 4, (10 * 64 + 10) * 4 + 4),
  ).toEqual([131, 84, 61, 255]);
  for (let i = 0; i < 3; i++) await page.locator("#undo").click();
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  expect(await data()).toEqual(initial);
  await page.screenshot({ path: ".preview/new-tools.png", fullPage: true });
});
