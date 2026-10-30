export function createMagnifier(source) {
  const element = document.createElement("div");
  element.className = "pixel-magnifier";
  element.hidden = true;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 126;
  const label = document.createElement("span");
  element.append(canvas, label);
  document.body.append(element);
  const context = canvas.getContext("2d");
  return {
    hide() {
      element.hidden = true;
    },
    show(event, point) {
      if (!point) {
        element.hidden = true;
        return;
      }
      context.clearRect(0, 0, 126, 126);
      context.imageSmoothingEnabled = false;
      context.drawImage(
        source,
        (point.x - 3) * 18,
        (point.y - 3) * 18,
        1,
        1,
        0,
        0,
        0,
        0,
      );
      context.drawImage(
        source,
        -(point.x - 3) * 18,
        -(point.y - 3) * 18,
        64 * 18,
        64 * 18,
      );
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.strokeRect(54, 54, 18, 18);
      label.textContent = `${point.x}, ${point.y} · 18×`;
      element.hidden = false;
      const left =
        event.clientX + 22 + 142 > innerWidth
          ? event.clientX - 164
          : event.clientX + 22;
      element.style.left = `${Math.max(4, left)}px`;
      element.style.top = `${Math.max(4, Math.min(innerHeight - 170, event.clientY + 18))}px`;
    },
  };
}
