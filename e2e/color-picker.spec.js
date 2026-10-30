import { test, expect } from "@playwright/test";
test("inline picker synchronizes HEX, HSV and palette without modifying skin", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText("자동 저장됨");
  const before = await page.evaluate(() =>
    localStorage.getItem("coolmc.skin-studio.v1"),
  );
  await expect(page.locator(".inline-color-picker")).toBeVisible();
  await page.locator("#picker-hex").fill("#FF0000");
  await page.locator("#picker-hex").press("Tab");
  await expect(page.locator("#rgb-value")).toHaveText("RGB 255, 0, 0");
  await page.locator("#picker-h").fill("120");
  await page.locator("#picker-h").press("Tab");
  await expect(page.locator("#picker-hex")).toHaveValue("#00FF00");
  const box = await page.locator(".picker-sv").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#picker-s")).toHaveValue("50");
  await expect(page.locator("#picker-v")).toHaveValue("50");
  await page.locator("#picker-v").fill("0");
  await page.locator("#picker-v").press("Tab");
  await expect(page.locator("#picker-s")).toHaveValue("50");
  await page.locator("#palette button").first().click();
  await expect(page.locator("#picker-hex")).toHaveValue("#E8B28F");
  expect(
    await page.evaluate(() => localStorage.getItem("coolmc.skin-studio.v1")),
  ).toBe(before);
  await page.screenshot({ path: ".preview/color-picker.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
