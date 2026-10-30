import "./style.css";
import {
  PARTS,
  SIZE,
  History,
  createStarter,
  faces,
  locate,
  pixel,
  putPixel,
  rgba,
  line,
  floodFill,
} from "./skin.js";
import { createViews } from "./views.js";
import { setupReferences } from "./references.js";
import { readSkinPng } from "./reference-data.js";
import { setupWorkspaceUI, updateColorReadout } from "./workspace-ui.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = "coolmc.skin-studio.v1";
const history = new History();
const state = {
  data: createStarter(),
  model: "default",
  layer: "base",
  tool: "pen",
  color: "#68cbb1",
  visible: new Set(Object.keys(PARTS)),
  overlayVisible: true,
  baseVisible: true,
  view: "3d",
  grid: true,
};
const source = document.createElement("canvas");
source.width = source.height = SIZE;
const sourceContext = source.getContext("2d");
const sheet = $("#texture-canvas");
const sheetContext = sheet.getContext("2d");
let views;
let referenceTools;
let stroke = null;
let previous = null;
let hovered = null;
let saveTimer;
let toastTimer;
let sheetZoom = 1;
let recent = [];
let paused = false;

function snapshot() {
  return { data: state.data.slice(), model: state.model };
}
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4000);
}
function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        model: state.model,
        pixels: Array.from(state.data),
        recent,
      }),
    );
    $("#save-status").textContent = "● 이 브라우저에 자동 저장됨";
  } catch {
    $("#save-status").textContent =
      "자동 저장 불가 · PNG를 다운로드해 보관하세요";
  }
}
function scheduleSave() {
  $("#save-status").textContent = "저장 중…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
function restore() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return;
    const saved = JSON.parse(value);
    if (
      saved.version !== 1 ||
      !["default", "slim"].includes(saved.model) ||
      !Array.isArray(saved.pixels) ||
      saved.pixels.length !== 16384 ||
      !saved.pixels.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    )
      throw new Error("Invalid save");
    state.data = new Uint8ClampedArray(saved.pixels);
    state.model = saved.model;
    recent = Array.isArray(saved.recent)
      ? saved.recent.filter((color) => /^#[\da-f]{6}$/i.test(color)).slice(0, 8)
      : [];
    notify("이전에 작업하던 스킨을 복원했습니다.");
  } catch {
    notify("저장된 작업을 읽지 못했습니다. 기본 스킨으로 시작합니다.");
  }
}
function drawSheet() {
  const scale = sheet.width / SIZE;
  sheetContext.clearRect(0, 0, sheet.width, sheet.height);
  sheetContext.imageSmoothingEnabled = false;
  sheetContext.drawImage(source, 0, 0, sheet.width, sheet.height);
  for (const layer of ["base", "overlay"]) {
    if (layer === "base" ? state.baseVisible : state.overlayVisible) continue;
    for (const part of Object.keys(PARTS))
      for (const r of faces(part, layer, state.model))
        sheetContext.clearRect(
          r.x * scale,
          r.y * scale,
          r.w * scale,
          r.h * scale,
        );
  }
  sheetContext.fillStyle = "rgba(10,15,22,.65)";
  sheetContext.fillRect(0, 0, sheet.width, sheet.height);
  for (const part of state.visible) {
    if (state.layer === "base" ? !state.baseVisible : !state.overlayVisible)
      continue;
    for (const region of faces(part, state.layer, state.model)) {
      const { x, y, w, h } = region;
      sheetContext.clearRect(x * scale, y * scale, w * scale, h * scale);
      sheetContext.drawImage(
        source,
        x,
        y,
        w,
        h,
        x * scale,
        y * scale,
        w * scale,
        h * scale,
      );
      sheetContext.strokeStyle = "rgba(130,225,198,.7)";
      sheetContext.lineWidth = 2;
      sheetContext.strokeRect(x * scale, y * scale, w * scale, h * scale);
    }
  }
  if (state.grid) {
    sheetContext.strokeStyle = "rgba(180,200,210,.15)";
    sheetContext.lineWidth = 1;
    sheetContext.beginPath();
    for (let i = 0; i <= SIZE; i++) {
      sheetContext.moveTo(i * scale, 0);
      sheetContext.lineTo(i * scale, sheet.height);
      sheetContext.moveTo(0, i * scale);
      sheetContext.lineTo(sheet.width, i * scale);
    }
    sheetContext.stroke();
  }
  if (hovered) {
    sheetContext.strokeStyle = "#fff";
    sheetContext.lineWidth = 2;
    sheetContext.strokeRect(hovered.x * scale, hovered.y * scale, scale, scale);
  }
}
function refresh() {
  sourceContext.putImageData(new ImageData(state.data, SIZE, SIZE), 0, 0);
  views?.sync();
  drawSheet();
  $("#model").value = state.model;
  $("#undo").disabled = !history.undoStack.length;
  $("#redo").disabled = !history.redoStack.length;
  referenceTools?.refresh();
}
function commit(before) {
  if (history.push(before, snapshot())) scheduleSave();
  refresh();
}
function finishStroke() {
  if (!stroke) return;
  commit(stroke);
  stroke = null;
  previous = null;
  if (views) views.editor.controls.enabled = true;
}
function applyHistory(direction) {
  finishStroke();
  const next = history[direction](snapshot());
  if (!next) return;
  state.data = next.data;
  state.model = next.model;
  refresh();
  scheduleSave();
}
function swatch(color, parent) {
  const button = document.createElement("button");
  button.style.backgroundColor = color;
  button.title = color.toUpperCase();
  button.setAttribute("aria-label", `색상 ${color}`);
  button.onclick = () => setColor(color);
  parent.append(button);
}
function renderRecent() {
  $("#recent-colors").replaceChildren();
  recent.forEach((color) => swatch(color, $("#recent-colors")));
  if (!recent.length)
    $("#recent-colors").textContent = "그리면 색상이 여기에 모입니다.";
}
function setColor(color) {
  state.color = color.toLowerCase();
  $("#color").value = state.color;
  $("#hex").value = state.color.toUpperCase();
  $("#color-label").textContent = state.color.toUpperCase();
  if ($("#quick-color")) $("#quick-color").value = state.color;
  updateColorReadout(state.color);
}
function useColor() {
  recent = [
    state.color,
    ...recent.filter((value) => value !== state.color),
  ].slice(0, 8);
  renderRecent();
}
function setTool(tool) {
  finishStroke();
  state.tool = tool;
  $$("[data-tool]").forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected);
  });
  views?.setTool(tool);
  $("#stage").classList.toggle("rotating", tool === "rotate");
}
function getHit(event, canvas) {
  if (state.layer === "base" ? !state.baseVisible : !state.overlayVisible)
    return null;
  if (canvas === sheet) {
    const rect = sheet.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * SIZE);
    return locate(x, y, state.layer, state.model, [...state.visible]);
  }
  return views?.pick(event) ?? null;
}
function paint(hit) {
  if (!hit) {
    previous = null;
    return;
  }
  const color = state.tool === "eraser" ? [0, 0, 0, 0] : rgba(state.color);
  if (state.tool === "fill") {
    floodFill(state.data, hit.x, hit.y, color, hit.region);
  } else if (
    previous &&
    previous.part === hit.part &&
    previous.face === hit.face
  ) {
    line(previous.x, previous.y, hit.x, hit.y, (x, y) =>
      putPixel(state.data, x, y, color),
    );
  } else putPixel(state.data, hit.x, hit.y, color);
  previous = hit;
  refresh();
}
function hover(hit) {
  hovered = hit;
  $("#pixel-info").textContent = hit
    ? `${PARTS[hit.part].label} · ${hit.region.name} · ${hit.x}, ${hit.y}`
    : "모델 위에서 그리기를 시작하세요";
  views?.renderGrid(hit);
  drawSheet();
}
for (const canvas of [$("#editor-canvas"), sheet]) {
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state.tool === "rotate") return;
    const hit = getHit(event, canvas);
    if (!hit) return;
    event.preventDefault();
    if (state.tool === "picker") {
      const value = pixel(state.data, hit.x, hit.y);
      if (!value[3]) {
        notify("투명 픽셀에는 선택할 색상이 없습니다.");
        return;
      }
      setColor(
        `#${value
          .slice(0, 3)
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")}`,
      );
      setTool("pen");
      return;
    }
    finishStroke();
    stroke = snapshot();
    if (views) views.editor.controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    if (state.tool !== "eraser") useColor();
    paint(hit);
    if (state.tool === "fill") finishStroke();
  });
  canvas.addEventListener("pointermove", (event) => {
    const hit = getHit(event, canvas);
    hover(hit);
    if (stroke) paint(hit);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(name, finishStroke);
  canvas.addEventListener("pointerleave", () => hover(null));
}
window.addEventListener("blur", finishStroke);
window.addEventListener("pagehide", () => {
  finishStroke();
  save();
});

$$("[data-tool]").forEach((button) => {
  button.onclick = () => setTool(button.dataset.tool);
});
$$("[data-view]").forEach((button) => {
  button.onclick = () => {
    finishStroke();
    state.view = button.dataset.view;
    $$("[data-view]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", active);
    });
    $("#editor-canvas").hidden = state.view !== "3d";
    $("#texture-wrap").hidden = state.view !== "2d";
    hover(null);
  };
});
$("#color").oninput = (event) => setColor(event.target.value);
$("#hex").onchange = (event) => {
  const value = event.target.value.startsWith("#")
    ? event.target.value
    : `#${event.target.value}`;
  if (/^#[\da-f]{6}$/i.test(value)) setColor(value);
  else {
    notify("6자리 HEX 색상 코드를 입력하세요. 예: #68CBB1");
    setColor(state.color);
  }
};
$("#model").onchange = (event) => {
  finishStroke();
  const before = snapshot();
  state.model = event.target.value;
  commit(before);
};
$$('[name="layer"]').forEach((radio) => {
  radio.onchange = () => {
    finishStroke();
    state.layer = radio.value;
    if (state.layer === "base") {
      state.baseVisible = true;
      $("#base-visible").checked = true;
    }
    $("#layer-tag").textContent = state.layer === "base" ? "기본층" : "외부층";
    if (state.layer === "overlay") {
      state.overlayVisible = true;
      $("#overlay-visible").checked = true;
    }
    hover(null);
    refresh();
  };
});
$("#overlay-visible").onchange = (event) => {
  finishStroke();
  if (!event.target.checked && state.layer === "overlay") {
    $('input[name="layer"][value="base"]').checked = true;
    state.layer = "base";
    $("#layer-tag").textContent = "기본층";
  }
  state.overlayVisible = event.target.checked;
  hover(null);
  refresh();
};
$("#base-visible").onchange = (event) => {
  finishStroke();
  state.baseVisible = event.target.checked;
  hover(null);
  refresh();
};
for (const [key, part] of Object.entries(PARTS)) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.onchange = () => {
    finishStroke();
    if (checkbox.checked) state.visible.add(key);
    else state.visible.delete(key);
    hover(null);
    refresh();
  };
  label.append(checkbox, part.label);
  $("#parts").append(label);
}
$("#grid").onchange = (event) => {
  state.grid = event.target.checked;
  views?.setGrid(state.grid);
  drawSheet();
};
$("#undo").onclick = () => applyHistory("undo");
$("#redo").onclick = () => applyHistory("redo");
function zoom(factor) {
  if (state.view === "3d") views?.zoom(factor);
  else {
    sheetZoom = Math.max(1, Math.min(4, sheetZoom / factor));
    sheet.style.width = `${sheetZoom * 100}%`;
  }
}
$("#zoom-in").onclick = () => zoom(0.85);
$("#zoom-out").onclick = () => zoom(1.15);
$("#reset-view").onclick = () => {
  views?.reset();
  sheetZoom = 1;
  sheet.style.width = "100%";
};
$("#texture-wrap").addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.1 : 0.9);
  },
  { passive: false },
);
$("#new-skin").onclick = () => {
  if (
    !confirm(
      "기본 스킨으로 새로 시작할까요? 현재 작업은 실행 취소로 복구할 수 있습니다.",
    )
  )
    return;
  finishStroke();
  const before = snapshot();
  state.data = createStarter(state.model);
  commit(before);
  notify("새 스킨을 만들었습니다.");
};
$("#import-skin").onclick = () => $("#file").click();
$("#file").onchange = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const data = await readSkinPng(file);
    finishStroke();
    const before = snapshot();
    state.data = data;
    commit(before);
    notify("스킨을 불러왔습니다. 팔 모양에 맞는 모델을 선택하세요.");
  } catch (error) {
    notify(error.message || "PNG를 읽지 못했습니다.");
  }
};
$("#download").onclick = () => {
  finishStroke();
  source.toBlob((blob) => {
    if (!blob) {
      notify("PNG 저장에 실패했습니다.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `coolmc-skin-${state.model === "slim" ? "slim" : "classic"}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify("64×64 PNG를 다운로드했습니다.");
  }, "image/png");
};
$("#animation").onchange = () =>
  views?.animate($("#animation").value, Number($("#speed").value), paused);
$("#pause").onclick = () => {
  paused = !paused;
  if (views) views.preview.animation.paused = paused;
  $("#pause").textContent = paused ? "▶ 재생" : "Ⅱ 일시 정지";
  $("#pause").setAttribute("aria-pressed", paused);
};
$("#auto-rotate").onchange = (event) => {
  if (views) views.preview.autoRotate = event.target.checked;
};
$("#speed").oninput = (event) => {
  const speed = Number(event.target.value);
  $("#speed-value").textContent = `${speed.toFixed(2).replace(/0$/, "")}×`;
  if (views) views.preview.animation.speed = speed;
};
window.addEventListener("keydown", (event) => {
  if (referenceTools?.isModalOpen()) return;
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
    event.altKey
  )
    return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    applyHistory(event.shiftKey ? "redo" : "undo");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    applyHistory("redo");
    return;
  }
  if (event.ctrlKey || event.metaKey) return;
  const tool = { b: "pen", e: "eraser", g: "fill", i: "picker", r: "rotate" }[
    key
  ];
  if (tool) {
    event.preventDefault();
    setTool(tool);
  }
});

restore();
[
  "#e8b28f",
  "#493930",
  "#f3eee1",
  "#273245",
  "#68cbb1",
  "#8bb5f3",
  "#bc96e5",
  "#e89fa0",
  "#e6c578",
  "#ffffff",
  "#8d9ba8",
  "#151d28",
].forEach((color) => swatch(color, $("#palette")));
renderRecent();
refresh();
try {
  views = createViews(source, () => state);
} catch (error) {
  console.error(error);
  $("#webgl-error").hidden = false;
  $('[data-view="2d"]').click();
  for (const id of ["animation", "pause", "auto-rotate", "speed"])
    $(`#${id}`).disabled = true;
  notify("3D 렌더링을 시작하지 못했습니다. 2D 편집을 사용할 수 있습니다.");
}
refresh();
scheduleSave();
referenceTools = setupReferences({
  state,
  views,
  notify,
  setColor,
  snapshot,
  commit,
  finishStroke,
});
setupWorkspaceUI();
updateColorReadout(state.color);
