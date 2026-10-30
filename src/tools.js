export function fillFace(data, region, color) {
  for (let y = region.y; y < region.y + region.h; y++)
    for (let x = region.x; x < region.x + region.w; x++)
      data.set(color, (y * 64 + x) * 4);
}
export function shadePixel(data, x, y, tool, strength = 0.15) {
  const offset = (y * 64 + x) * 4;
  if (data[offset + 3] === 0) return;
  for (let i = 0; i < 3; i++)
    data[offset + i] = Math.round(
      tool === "burn"
        ? data[offset + i] * (1 - strength)
        : data[offset + i] + (255 - data[offset + i]) * strength,
    );
}
export function setupToolButtons() {
  const icons = {
    pen: '<path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-5-3L3 16l-1 6Z"/>',
    eraser:
      '<path d="m14 3 7 7-11 11H6l-4-4a2 2 0 0 1 0-3L13 3Z M7 9l7 7M10 21h12"/>',
    fill: '<path d="M3 5h7v6H3zM3 14h7v6H3zM13 5h8v6h-8zM13 14h8v6h-8z"/><path d="m4 7 4 2m-4 7 4 2"/>',
    bucket:
      '<path d="m9 3 10 10-8 8-9-9 8-8M4 10h12M6 2l6 6"/><path d="M20 15s-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"/>',
    burn: '<path d="M13 2c2 7-3 7-1 11 2-1 3-3 3-5 5 4 7 8 4 12-4 5-14 2-14-4 0-4 3-6 4-9 0 4 1 5 2 5-2-6 2-7 2-10Z"/>',
    dodge:
      '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    picker:
      '<path d="m15 3 6 6M13 5l6 6M16 8 6 18l-4 1 1-4L13 5M18 2l4 4-3 3-4-4Z"/>',
    rotate: '<path d="M20 8a9 9 0 1 0 1 8M20 2v6h-6"/>',
  };
  const toolbar = document.querySelector(".toolbar");
  for (const [tool, label, key] of [
    ["bucket", "페인트 통 · 면 전체", "F"],
    ["burn", "번 · 어둡게 15%", "O"],
    ["dodge", "닷지 · 밝게 15%", "D"],
  ]) {
    const button = document.createElement("button");
    button.dataset.tool = tool;
    button.title = `${label} (${key})`;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<span></span><small>${key}</small>`;
    toolbar.insertBefore(button, toolbar.querySelector('[data-tool="picker"]'));
  }
  for (const button of toolbar.querySelectorAll("[data-tool]")) {
    button.querySelector("span").innerHTML =
      `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[button.dataset.tool]}</svg>`;
  }
  toolbar.querySelector('[data-tool="fill"]').title = "연결 영역 채우기 (G)";
}
