import "./floating-tools.css";

export function setupFloatingTools() {
  const workspace = document.querySelector(".workspace");
  const panel = document.createElement("section");
  panel.className = "floating-tools";
  panel.setAttribute("aria-label", "이동 가능한 도구와 컬러피커");
  const handle = document.createElement("button");
  handle.className = "tools-drag-handle";
  handle.textContent = "⠿ 도구 · 컬러피커";
  handle.title = "드래그 또는 방향키로 이동";
  const reset = document.createElement("button");
  reset.className = "tools-position-reset";
  reset.textContent = "위치 초기화";
  panel.append(
    handle,
    document.querySelector(".toolbar"),
    document.querySelector(".inline-color-picker"),
    reset,
  );
  workspace.append(panel);
  let position = null;
  let drag = null;
  try {
    const saved = JSON.parse(localStorage.getItem("coolmc.tools-position"));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
      position = saved;
  } catch {
    /* Position persistence is optional. */
  }
  function place() {
    const bounds = workspace.getBoundingClientRect();
    const stage = document.querySelector("#stage").getBoundingClientRect();
    const desired = position || { x: 8, y: stage.top - bounds.top + 40 };
    const x = Math.max(
      0,
      Math.min(desired.x, workspace.clientWidth - panel.offsetWidth),
    );
    const y = Math.max(
      0,
      Math.min(desired.y, workspace.clientHeight - panel.offsetHeight),
    );
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }
  function save() {
    try {
      localStorage.setItem("coolmc.tools-position", JSON.stringify(position));
    } catch {
      /* Optional. */
    }
  }
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: panel.offsetLeft,
      top: panel.offsetTop,
    };
    handle.setPointerCapture(event.pointerId);
    panel.classList.add("dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    position = {
      x: drag.left + event.clientX - drag.x,
      y: drag.top + event.clientY - drag.y,
    };
    place();
  });
  function finish() {
    if (!drag) return;
    drag = null;
    position = { x: panel.offsetLeft, y: panel.offsetTop };
    panel.classList.remove("dragging");
    save();
  }
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("lostpointercapture", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("keydown", (event) => {
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    position = {
      x: panel.offsetLeft + delta[0] * step,
      y: panel.offsetTop + delta[1] * step,
    };
    place();
    save();
  });
  reset.onclick = () => {
    position = null;
    save();
    place();
  };
  new ResizeObserver(place).observe(workspace);
  window.addEventListener("resize", place);
  place();
}
