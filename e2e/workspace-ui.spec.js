import { test, expect } from "@playwright/test";
test("persistent colors, themes, quick menus and new poses work together", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#rgb-value")).toHaveText("RGB 104, 203, 177");
  await page.locator("#palette button").first().click();
  await expect(page.locator("#rgb-value")).toHaveText("RGB 232, 178, 143");
  await page.locator("#settings-toggle").click();
  await expect(page.locator("#palette")).toBeVisible();
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#layer-menu summary").focus();
  await page.keyboard.press("l");
  await expect(page.locator("#base-visible")).toBeVisible();
  await page.locator("#base-visible").uncheck();
  await expect(page.locator("#base-visible")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await page.locator("#parts-menu summary").focus();
  await page.keyboard.press("p");
  await expect(page.locator("#parts")).toBeVisible();
  await page.locator("#parts label").first().locator("input").uncheck();
  await page.keyboard.press("Escape");
  await page.locator('[data-side="animation"]').click();
  await page.locator("#pause").click();
  for (const pose of ["sit", "lie", "walk"]) {
    await page.locator("#animation").selectOption(pose);
    await page.waitForTimeout(100);
    await page.screenshot({
      path: `.preview/pose-${pose}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
