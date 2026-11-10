import { faces } from "./skin.js";
import "./atlas.css";

export function drawAtlas(
  context,
  source,
  { parts, layers, model, grid = false },
) {
  const size = context.canvas.width;
  const unit = size / 64;
  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = false;
  context.lineWidth = 1;
  context.fillStyle = "#101722aa";
  context.fillRect(0, 0, size, size);
  for (const part of parts)
    for (const layer of layers)
      for (const r of faces(part, layer, model)) {
        context.clearRect(r.x * unit, r.y * unit, r.w * unit, r.h * unit);
        context.drawImage(
          source,
          r.x,
          r.y,
          r.w,
          r.h,
          r.x * unit,
          r.y * unit,
          r.w * unit,
          r.h * unit,
        );
        context.strokeStyle = "#9fe6c599";
        context.strokeRect(r.x * unit, r.y * unit, r.w * unit, r.h * unit);
      }
  if (grid) {
    context.strokeStyle = "#b4c8d226";
    context.beginPath();
    for (let i = 0; i <= 64; i++) {
      context.moveTo(i * unit, 0);
      context.lineTo(i * unit, size);
      context.moveTo(0, i * unit);
      context.lineTo(size, i * unit);
    }
    context.stroke();
  }
}

export function createAtlasViewport(container, canvas, canPan) {
  container.classList.add("atlas-viewport");
  let state = { scale: 1, x: 0, y: 0 };
  let base = 1;
  let drag = null;
  let space = false;
  const listeners = new Set();
  function render() {
    if (!container.clientWidth || !container.clientHeight) return;
    base = Math.max(
      1,
      Math.min(container.clientWidth, container.clientHeight) - 16,
    );
    canvas.style.width = canvas.style.height = `${base * state.scale}px`;
    canvas.style.left = `${container.clientWidth / 2 + state.x * base}px`;
    canvas.style.top = `${container.clientHeight / 2 + state.y * base}px`;
  }
  function set(next, notify = true) {
    state = {
      scale: Math.max(0.5, Math.min(12, next.scale)),
      x: next.x,
      y: next.y,
    };
    const limit = (state.scale + 1) / 2 - 0.1;
    state.x = Math.max(-limit, Math.min(limit, state.x));
    state.y = Math.max(-limit, Math.min(limit, state.y));
    render();
    if (notify) for (const fn of listeners) fn({ ...state });
  }
  function zoom(factor, event) {
    const bounds = container.getBoundingClientRect();
    const ax = event
      ? (event.clientX - bounds.left - bounds.width / 2) / base
      : 0;
    const ay = event
      ? (event.clientY - bounds.top - bounds.height / 2) / base
      : 0;
    const scale = Math.max(0.5, Math.min(12, state.scale * factor));
    const ratio = scale / state.scale;
    set({
      scale,
      x: ax - (ax - state.x) * ratio,
      y: ay - (ay - state.y) * ratio,
    });
  }
  container.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      zoom(Math.exp(-event.deltaY * 0.0015), event);
    },
    { passive: false },
  );
  container.addEventListener("contextmenu", (event) => event.preventDefault());
  container.addEventListener(
    "pointerdown",
    (event) => {
      if (!(
        event.button === 1 ||
        event.button === 2 ||
        (event.button === 0 && (space || canPan()))
      ))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: { ...state },
      };
      container.setPointerCapture(event.pointerId);
      container.classList.add("atlas-dragging");
    },
    true,
  );
  container.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      set({
        ...drag.start,
        x: drag.start.x + (event.clientX - drag.x) / base,
        y: drag.start.y + (event.clientY - drag.y) / base,
      });
    },
    true,
  );
  function stop() {
    drag = null;
    container.classList.remove("atlas-dragging");
  }
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    container.addEventListener(name, stop);
  window.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
        event.target.tagName,
      ) &&
      !document.querySelector("dialog[open]")
    ) {
      space = true;
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") space = false;
  });
  window.addEventListener("blur", () => {
    space = false;
    stop();
  });
  new ResizeObserver(render).observe(container);
  return {
    set,
    zoom,
    reset: () => set({ scale: 1, x: 0, y: 0 }),
    get: () => ({ ...state }),
    onChange: (fn) => listeners.add(fn),
  };
}
