import { test, expect } from "@playwright/test";

test("combined tools drag without painting and restore their position", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const pixels = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("coolmc.skin-studio.v1")).pixels,
    );
  const before = await pixels();
  const panel = page.locator(".floating-tools");
  const handle = page.locator(".tools-drag-handle");
  const initial = await panel.boundingBox();
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + 60, grip.y + 15);
  await page.mouse.down();
  await page.mouse.move(grip.x + 260, grip.y + 65, { steps: 8 });
  await page.mouse.up();
  const moved = await panel.boundingBox();
  expect(moved.x - initial.x).toBeCloseTo(200, 0);
  expect(moved.y - initial.y).toBeCloseTo(50, 0);
  expect(await pixels()).toEqual(before);
  const tools = await panel.locator(".toolbar").boundingBox();
  const picker = await panel.locator(".inline-color-picker").boundingBox();
  expect(tools.y + tools.height).toBeLessThanOrEqual(picker.y);
  await page.reload();
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox()).x).toBeCloseTo(moved.x, 0);
  await page.locator(".tools-position-reset").click();
  expect((await panel.boundingBox()).x).toBeCloseTo(initial.x, 0);
});
