import "./reference.css";
import { createMagnifier } from "./magnifier.js";
import { SkinViewer } from "skinview3d";
import { CanvasTexture, NearestFilter, Raycaster, Vector2 } from "three";
import { PARTS, faces, locate, pixel, uvPixel } from "./skin.js";
import { composeSkin, extractPalette, readSkinPng } from "./reference-data.js";

const KEY = "coolmc.references.v1";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const validPixels = (v) =>
  Array.isArray(v) &&
  v.length === 16384 &&
  v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
const hex = (color) =>
  "#" +
  color
    .slice(0, 3)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");

export function setupReferences(api) {
  const workspace = $(".workspace");
  workspace.classList.add("integrated");
  workspace.insertAdjacentHTML(
    "beforebegin",
    `<div class="workspace-bar">
    <label><input id="reference-toggle" type="checkbox" /> 레퍼런스 보기</label>
    <button id="reference-add">＋ 레퍼런스 추가</button><input id="reference-files" type="file" accept="image/png,.png" multiple hidden />
    <button id="settings-toggle" aria-expanded="true">편집 설정 접기</button>
    <label>그리기 색상 <input id="quick-color" type="color" value="#68cbb1" aria-label="빠른 색상 선택" /></label>
    <label class="reference-layout-label">배치 <select id="reference-layout"><option value="split">나란히</option><option value="float">작은 창</option></select></label>
    <div class="tabs"><button data-side="reference" aria-pressed="false">레퍼런스</button><button data-side="animation" aria-pressed="true" class="active">움직임 미리보기</button></div>
    <div class="mobile-switch"><button id="show-editor" class="active" aria-pressed="true">편집</button><button id="show-side" aria-pressed="false">참고 / 미리보기</button></div>
  </div>`,
  );
  workspace.insertAdjacentHTML(
    "beforeend",
    `<section class="reference-panel panel" hidden aria-label="레퍼런스 스킨">
    <div class="reference-head"><select id="reference-select" aria-label="레퍼런스 선택"></select><button id="reference-replace">교체</button><button id="reference-remove">제거</button><input id="reference-replace-file" type="file" accept="image/png,.png" hidden /></div>
    <div class="reference-controls"><label>모델 <select id="reference-model"><option value="default">Classic · 4px</option><option value="slim">Slim · 3px</option></select></label><label><input id="reference-sync" type="checkbox" checked /> 시점 동기화</label><button id="reference-view">2D 펼침도</button><button id="reference-pick" aria-pressed="false">색상 선택</button></div>
    <div class="reference-stage"><canvas id="ref-canvas" aria-label="읽기 전용 레퍼런스 3D"></canvas><div class="reference-sheet-wrap" hidden><canvas id="ref-sheet" width="768" height="768" aria-label="레퍼런스 2D 펼침도"></canvas></div><div class="reference-empty"><strong>함께 볼 스킨을 추가하세요</strong><p>64×64 PNG · 최대 8개<br />현재 작업은 그대로 유지됩니다.</p><button id="reference-empty-add">PNG 불러오기</button></div></div>
    <div class="reference-readout" id="reference-readout">드래그로 회전 · 색상 선택을 켜고 픽셀 클릭</div>
    <details id="compose-controls"><summary>부위 / 영역 합성</summary><p>레퍼런스의 같은 부위·좌표를 편집 스킨에 복사합니다. 옷·머리카락만 복사하려면 외부층 또는 사각형 영역을 선택하세요.</p><div class="composition-parts" id="compose-parts"></div>
    <div class="reference-fields"><label>복사할 레이어<select id="compose-layer"><option value="both">기본층 + 외부층</option><option value="base">기본층만</option><option value="overlay">외부층만</option></select></label><label>복사 범위<select id="compose-scope"><option value="all">부위 전체</option><option value="4">앞면</option><option value="5">뒷면</option><option value="0">오른쪽 면</option><option value="1">왼쪽 면</option><option value="2">윗면</option><option value="3">아랫면</option><option value="rectangle">2D 사각형 영역</option></select></label><label>투명 픽셀<select id="compose-transparency"><option value="skip">투명 픽셀 제외</option><option value="include">투명 픽셀까지 교체</option></select></label></div>
    <p id="selection-info" class="selection-info">선택 부위의 같은 좌표에 복사합니다.</p><div class="reference-actions"><button id="select-rectangle">2D에서 영역 선택</button><button id="clear-rectangle">영역 해제</button><button id="compose-preview" class="primary">합성 미리보기</button></div></details><p id="ref-storage-status" role="status"></p>
  </section>
  <details class="palette-panel panel" id="palette-extraction"><summary>부위별 팔레트 추출 · 고정 색상</summary><div class="palette-filters"><label>스킨<select id="palette-source"><option value="editing">편집 중인 스킨</option><option value="reference">선택한 레퍼런스</option></select></label><label>부위<select id="palette-part"><option value="all">전체</option></select></label><label>레이어<select id="palette-layer"><option value="both">둘 다</option><option value="base">기본층</option><option value="overlay">외부층</option></select></label><button id="palette-refresh">팔레트 생성</button></div><div id="extracted-colors" class="extracted-colors"></div><p class="palette-note">투명 픽셀과 미사용 영역 제외 · 실제 RGB 색상 · 빈도순 · 클릭하면 그리기 색상으로 선택</p><div class="pinned-row"><button id="pin-color">현재 색상 고정</button><span id="pinned-colors"></span></div></details>`,
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog class="compose-dialog" id="compose-dialog"><h2>합성 결과 미리보기</h2><p id="compose-summary"></p><div class="compose-preview"><canvas id="compose-canvas" aria-label="합성 결과 3D 미리보기"></canvas><canvas id="compose-fallback" width="64" height="64" hidden aria-label="합성 결과 펼침도"></canvas></div><p>적용 전에는 작업 스킨이 바뀌지 않습니다. 적용 후 실행 취소로 되돌릴 수 있습니다.</p><div class="reference-actions"><button id="compose-cancel">취소</button><button id="compose-apply" class="primary">적용</button></div></dialog>`,
  );
  for (const [key, part] of Object.entries(PARTS)) {
    for (const id of ["palette-part"]) {
      const option = new Option(part.label, key);
      $(`#${id}`).add(option);
    }
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.checked = key === "head";
    label.append(input, part.label);
    $("#compose-parts").append(label);
  }
  let references = [],
    selectedId = null,
    pinned = [],
    side = "animation",
    mobileSide = false;
  let referenceViewer = null,
    referenceTexture = null,
    previewViewer = null,
    previewTexture = null;
  let view2d = false,
    picking = false,
    selecting = false,
    rectangle = null,
    start = null,
    pointerId = null;
  let candidate = null,
    sourceSnapshot = null,
    importing = false,
    syncBusy = false,
    syncingEnabled = true;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  const magnifier = createMagnifier(canvas);
  const sheet = $("#ref-sheet"),
    sheetContext = sheet.getContext("2d");
  const current = () => references.find((item) => item.id === selectedId);
  const displayedParts = () => [...api.state.visible];
  const displayedLayers = () =>
    ["base", "overlay"].filter((layer) =>
      layer === "base" ? api.state.baseVisible : api.state.overlayVisible,
    );
  const top = document.createElement("div");
  top.className = "reference-top";
  $(".reference-head").before(top);
  top.append($(".reference-head"), $(".reference-controls"));
  function alignComparison() {
    const comparing =
      side === "reference" &&
      $("#reference-layout").value === "split" &&
      innerWidth > 700;
    workspace.classList.toggle("comparing", comparing);
    if (comparing) {
      workspace.style.setProperty(
        "--compare-stage-height",
        `${$("#stage").clientHeight}px`,
      );
      workspace.style.setProperty(
        "--compare-header-height",
        `${top.getBoundingClientRect().height}px`,
      );
    }
  }
  const comparisonObserver = new ResizeObserver(alignComparison);
  comparisonObserver.observe($("#stage"));
  comparisonObserver.observe(top);
  window.addEventListener("resize", alignComparison);
  function persist() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          references: references.map((item) => ({
            ...item,
            data: Array.from(item.data),
          })),
          selectedId,
          pinned,
          side,
          view2d,
          settingsHidden: $(".settings-panel").hidden,
          layout: $("#reference-layout").value,
          syncingEnabled,
        }),
      );
      $("#ref-storage-status").textContent =
        "레퍼런스와 고정 색상이 이 브라우저에 저장되었습니다.";
    } catch {
      $("#ref-storage-status").textContent =
        "레퍼런스 저장 공간이 부족하거나 저장이 차단되었습니다. 새로고침하면 사라질 수 있습니다.";
    }
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.references))
        throw new Error();
      references = saved.references
        .slice(0, 8)
        .filter(
          (item) =>
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            ["default", "slim"].includes(item.model) &&
            validPixels(item.data),
        )
        .map((item) => ({ ...item, data: new Uint8ClampedArray(item.data) }));
      selectedId = references.some((item) => item.id === saved.selectedId)
        ? saved.selectedId
        : references[0]?.id;
      pinned = Array.isArray(saved.pinned)
        ? saved.pinned
            .filter((color) => /^#[a-f\d]{6}$/i.test(color))
            .slice(0, 32)
        : [];
      side = ["reference", "animation", null].includes(saved.side)
        ? saved.side
        : "animation";
      view2d = saved.view2d === true;
      $(".settings-panel").hidden = saved.settingsHidden === true;
      $("#reference-layout").value =
        saved.layout === "float" ? "float" : "split";
      syncingEnabled = saved.syncingEnabled !== false;
    }
  } catch {
    api.notify("레퍼런스 저장 내용을 읽지 못했습니다. 편집 스킨은 유지됩니다.");
  }
  function setSettingsButton() {
    const hidden = $(".settings-panel").hidden;
    $("#settings-toggle").textContent = hidden
      ? "편집 설정 열기"
      : "편집 설정 접기";
    $("#settings-toggle").setAttribute("aria-expanded", !hidden);
  }
  function updateLayout(save = true) {
    workspace.classList.toggle("has-side", side !== null);
    workspace.classList.toggle(
      "float-reference",
      side === "reference" && $("#reference-layout").value === "float",
    );
    workspace.classList.toggle("mobile-reference", mobileSide);
    $(".reference-panel").hidden = side !== "reference";
    $(".preview-panel").hidden = side !== "animation";
    $("#reference-toggle").checked = side === "reference";
    $$("[data-side]").forEach((button) => {
      const active = button.dataset.side === side;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active);
    });
    $("#show-editor").classList.toggle("active", !mobileSide);
    $("#show-side").classList.toggle("active", mobileSide);
    $("#show-editor").setAttribute("aria-pressed", !mobileSide);
    $("#show-side").setAttribute("aria-pressed", mobileSide);
    if (referenceViewer)
      referenceViewer.renderPaused = side !== "reference" || view2d;
    if (api.views) api.views.preview.renderPaused = side !== "animation";
    alignComparison();
    setSettingsButton();
    if (save) persist();
  }
  $("#reference-toggle").onchange = () => {
    side = $("#reference-toggle").checked ? "reference" : null;
    if (side) $(".settings-panel").hidden = true;
    updateLayout();
  };
  $$("[data-side]").forEach((button) => {
    button.onclick = () => {
      side = button.dataset.side;
      if (side === "reference") $(".settings-panel").hidden = true;
      updateLayout();
    };
  });
  $("#show-editor").onclick = () => {
    mobileSide = false;
    updateLayout();
  };
  $("#show-side").onclick = () => {
    mobileSide = true;
    side ||= "reference";
    updateLayout();
  };
  $("#settings-toggle").onclick = () => {
    $(".settings-panel").hidden = !$(".settings-panel").hidden;
    updateLayout();
  };
  $("#reference-layout").onchange = () => updateLayout();
  function synchronize(from, to) {
    if (!syncingEnabled || syncBusy || !from || !to) return;
    syncBusy = true;
    to.camera.fov = from.camera.fov;
    to.camera.updateProjectionMatrix();
    to.camera.position.copy(from.camera.position);
    to.controls.target.copy(from.controls.target);
    to.controls.update();
    syncBusy = false;
  }
  function ensureViewer() {
    if (referenceViewer || !api.views) return;
    try {
      referenceViewer = new SkinViewer({
        canvas: $("#ref-canvas"),
        width: 400,
        height: 390,
        zoom: 0.75,
        pixelRatio: Math.min(devicePixelRatio, 2),
      });
      referenceTexture = new CanvasTexture(canvas);
      referenceTexture.magFilter = referenceTexture.minFilter = NearestFilter;
      referenceViewer.playerObject.skin.map = referenceTexture;
      referenceViewer.playerObject.skin.visible = true;
      referenceViewer.controls.enableDamping = false;
      referenceViewer.controls.enablePan = false;
      referenceViewer.globalLight.intensity = 2.2;
      referenceViewer.cameraLight.intensity = 0.4;
      referenceViewer.playerObject.skin.traverse((node) => {
        if (node.isMesh) {
          node.material.transparent = true;
          node.material.alphaTest = 0.01;
        }
      });
      referenceViewer.controls.addEventListener("change", () =>
        synchronize(referenceViewer, api.views.editor),
      );
      api.views.editor.controls.addEventListener("change", () =>
        synchronize(api.views.editor, referenceViewer),
      );
      new ResizeObserver(() => {
        const element = $(".reference-stage");
        if (element.clientWidth && element.clientHeight) {
          referenceViewer.setSize(element.clientWidth, element.clientHeight);
          synchronize(api.views.editor, referenceViewer);
        }
      }).observe($(".reference-stage"));
      synchronize(api.views.editor, referenceViewer);
    } catch {
      view2d = true;
      api.notify("레퍼런스 3D를 열지 못해 2D로 표시합니다.");
    }
  }
  function drawSheet() {
    sheetContext.clearRect(0, 0, 768, 768);
    if (!current()) return;
    sheetContext.imageSmoothingEnabled = false;
    sheetContext.fillStyle = "#101722aa";
    sheetContext.fillRect(0, 0, 768, 768);
    const layers = displayedLayers();
    for (const part of displayedParts())
      for (const layer of layers)
        for (const r of faces(part, layer, current().model)) {
          sheetContext.clearRect(r.x * 12, r.y * 12, r.w * 12, r.h * 12);
          sheetContext.drawImage(
            canvas,
            r.x,
            r.y,
            r.w,
            r.h,
            r.x * 12,
            r.y * 12,
            r.w * 12,
            r.h * 12,
          );
          sheetContext.strokeStyle = "#9fe6c599";
          sheetContext.strokeRect(r.x * 12, r.y * 12, r.w * 12, r.h * 12);
        }
    if (rectangle) {
      sheetContext.fillStyle = "#a6e8c533";
      sheetContext.fillRect(
        rectangle.x * 12,
        rectangle.y * 12,
        rectangle.w * 12,
        rectangle.h * 12,
      );
      sheetContext.strokeStyle = "#fff";
      sheetContext.lineWidth = 2;
      sheetContext.strokeRect(
        rectangle.x * 12,
        rectangle.y * 12,
        rectangle.w * 12,
        rectangle.h * 12,
      );
    }
  }
  function syncVisibility() {
    if (referenceViewer)
      for (const part of Object.keys(PARTS)) {
        const body = referenceViewer.playerObject.skin[part];
        body.visible = api.state.visible.has(part);
        body.innerLayer.visible = api.state.baseVisible;
        body.outerLayer.visible = api.state.overlayVisible;
      }
    drawSheet();
  }
  function syncReference() {
    magnifier.hide();
    const item = current();
    if (item) {
      context.putImageData(new ImageData(item.data, 64, 64), 0, 0);
      ensureViewer();
    }
    $(".reference-empty").hidden = !!item;
    $("#reference-model").value = item?.model || "default";
    for (const id of [
      "reference-replace",
      "reference-remove",
      "reference-model",
      "compose-preview",
      "reference-pick",
      "select-rectangle",
    ])
      $(`#${id}`).disabled = !item;
    if (referenceViewer && item) {
      referenceTexture.needsUpdate = true;
      referenceViewer.playerObject.skin.modelType = item.model;
      for (const part of Object.keys(PARTS)) {
        const body = referenceViewer.playerObject.skin[part];
        body.visible = displayedParts().includes(part);
        body.innerLayer.visible = api.state.baseVisible;
        body.outerLayer.visible = api.state.overlayVisible;
      }
      referenceViewer.controls.enabled = !picking;
      referenceViewer.renderPaused = side !== "reference" || view2d;
    }
    $("#ref-canvas").hidden = view2d;
    $(".reference-sheet-wrap").hidden = !view2d;
    $("#reference-view").textContent = view2d ? "3D 모델" : "2D 펼침도";
    drawSheet();
    renderPalette();
  }
  function resetSelection() {
    rectangle = null;
    selecting = false;
    start = null;
    $("#selection-info").textContent = "선택 부위의 같은 좌표에 복사합니다.";
    $("#select-rectangle").textContent = "2D에서 영역 선택";
  }
  function renderList() {
    $("#reference-select").replaceChildren();
    if (!references.length)
      $("#reference-select").add(new Option("레퍼런스를 추가하세요", ""));
    for (const item of references)
      $("#reference-select").add(new Option(item.name, item.id));
    $("#reference-select").value = selectedId || "";
    syncReference();
  }
  $("#reference-select").onchange = () => {
    selectedId = $("#reference-select").value;
    resetSelection();
    syncReference();
    persist();
  };
  $("#reference-model").onchange = () => {
    if (!current()) return;
    current().model = $("#reference-model").value;
    resetSelection();
    syncReference();
    persist();
  };
  $("#reference-view").onclick = () => {
    view2d = !view2d || !api.views;
    syncReference();
    persist();
  };
  $("#reference-sync").checked = syncingEnabled;
  $("#reference-sync").onchange = () => {
    syncingEnabled = $("#reference-sync").checked;
    synchronize(api.views?.editor, referenceViewer);
    persist();
  };
  $("#reference-pick").onclick = () => {
    picking = !picking;
    selecting = false;
    $("#reference-pick").setAttribute("aria-pressed", picking);
    $("#reference-pick").textContent = picking ? "색상 선택 중" : "색상 선택";
    syncReference();
  };
  $("#reference-add").onclick = $("#reference-empty-add").onclick = () =>
    $("#reference-files").click();
  $("#reference-replace").onclick = () => $("#reference-replace-file").click();
  async function importFiles(files, replacementId = null) {
    if (importing) return;
    importing = true;
    try {
      for (const file of files) {
        if (!replacementId && references.length >= 8) {
          api.notify(
            "레퍼런스는 최대 8개입니다. 기존 항목을 제거하거나 교체하세요.",
          );
          break;
        }
        try {
          const data = await readSkinPng(file);
          const item = {
            id: replacementId || crypto.randomUUID(),
            name: file.name.slice(0, 120),
            model: "default",
            data,
          };
          if (replacementId) {
            const index = references.findIndex(
              (ref) => ref.id === replacementId,
            );
            if (index < 0) break;
            references[index] = item;
          } else references.push(item);
          selectedId = item.id;
          side = "reference";
          $(".settings-panel").hidden = true;
          resetSelection();
          renderList();
          updateLayout();
        } catch (error) {
          api.notify(`${file.name}: ${error.message}`);
        }
      }
    } finally {
      importing = false;
    }
  }
  $("#reference-files").onchange = (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    void importFiles(files);
  };
  $("#reference-replace-file").onchange = (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (current()) void importFiles(files, current().id);
  };
  $("#reference-remove").onclick = () => {
    if (
      !current() ||
      !confirm("선택한 레퍼런스를 목록에서 제거할까요? 편집 스킨은 유지됩니다.")
    )
      return;
    references = references.filter((item) => item.id !== selectedId);
    selectedId = references[0]?.id || null;
    resetSelection();
    renderList();
    persist();
  };
  function pickColor(x, y) {
    if (!current()) return;
    const color = pixel(current().data, x, y);
    if (!color[3]) {
      api.notify("투명 픽셀에는 색상이 없습니다.");
      return;
    }
    api.setColor(hex(color));
    $("#reference-readout").textContent =
      `선택한 색상 ${hex(color).toUpperCase()} · ${x}, ${y}`;
  }
  const raycaster = new Raycaster();
  function referencePoint(event) {
    if (!picking || !referenceViewer || !current()) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    referenceViewer.scene.updateMatrixWorld(true);
    raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      referenceViewer.camera,
    );
    const targets = [];
    for (const part of displayedParts())
      for (const layer of displayedLayers()) {
        const mesh =
          referenceViewer.playerObject.skin[part][
            layer === "base" ? "innerLayer" : "outerLayer"
          ];
        targets.push({ part, layer, mesh });
      }
    for (const hit of raycaster.intersectObjects(
      targets.map((target) => target.mesh),
      false,
    )) {
      const target = targets.find((item) => item.mesh === hit.object);
      const r = faces(target.part, target.layer, current().model)[
        Math.floor(hit.faceIndex / 2)
      ];
      const point = uvPixel(hit.uv, r);
      if (!pixel(current().data, point.x, point.y)[3]) continue;
      return point;
    }
    return null;
  }
  $("#ref-canvas").addEventListener("pointermove", (event) =>
    magnifier.show(event, referencePoint(event)),
  );
  $("#ref-canvas").addEventListener("pointerleave", () => magnifier.hide());
  $("#ref-canvas").addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const point = referencePoint(event);
    if (point) pickColor(point.x, point.y);
  });
  function sheetPoint(event) {
    const bounds = sheet.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          63,
          Math.floor(((event.clientX - bounds.left) / bounds.width) * 64),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          63,
          Math.floor(((event.clientY - bounds.top) / bounds.height) * 64),
        ),
      ),
    };
  }
  sheet.addEventListener("pointermove", (event) =>
    magnifier.show(event, picking && current() ? sheetPoint(event) : null),
  );
  sheet.addEventListener("pointerleave", () => magnifier.hide());
  function updateRectangle(point) {
    rectangle = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(start.x - point.x) + 1,
      h: Math.abs(start.y - point.y) + 1,
    };
    $("#selection-info").textContent =
      `선택 영역: (${rectangle.x}, ${rectangle.y}) · ${rectangle.w}×${rectangle.h}px — 선택한 부위·레이어와 겹치는 영역만 복사`;
    drawSheet();
  }
  sheet.addEventListener("pointerdown", (event) => {
    if (!current() || event.button !== 0) return;
    const point = sheetPoint(event);
    if (selecting) {
      start = point;
      pointerId = event.pointerId;
      sheet.setPointerCapture(pointerId);
      updateRectangle(point);
      event.preventDefault();
    } else if (picking) {
      const layers = displayedLayers();
      if (
        layers.some((layer) =>
          locate(point.x, point.y, layer, current().model, displayedParts()),
        )
      )
        pickColor(point.x, point.y);
    }
  });
  sheet.addEventListener("pointermove", (event) => {
    if (start && event.pointerId === pointerId)
      updateRectangle(sheetPoint(event));
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    sheet.addEventListener(name, () => {
      start = null;
      pointerId = null;
    });
  $("#select-rectangle").onclick = () => {
    view2d = true;
    selecting = true;
    picking = false;
    $("#reference-pick").textContent = "색상 선택";
    $("#reference-pick").setAttribute("aria-pressed", false);
    $("#compose-scope").value = "rectangle";
    $("#select-rectangle").textContent = "펼침도에서 드래그하세요";
    syncReference();
  };
  $("#clear-rectangle").onclick = () => {
    resetSelection();
    $("#compose-scope").value = "all";
    drawSheet();
  };
  $("#compose-scope").onchange = () => {
    if ($("#compose-scope").value === "rectangle")
      $("#select-rectangle").click();
    else {
      selecting = false;
      $("#select-rectangle").textContent = "2D에서 영역 선택";
    }
  };
  function renderPalette() {
    if (!$("#palette-extraction").open) return;
    const item =
      $("#palette-source").value === "reference" ? current() : api.state;
    const parent = $("#extracted-colors");
    parent.replaceChildren();
    if (!item) {
      parent.textContent = "먼저 레퍼런스를 추가하세요.";
      return;
    }
    const parts =
      $("#palette-part").value === "all"
        ? Object.keys(PARTS)
        : [$("#palette-part").value];
    const colors = extractPalette(
      item.data,
      parts,
      $("#palette-layer").value,
      item.model,
    );
    if (!colors.length) {
      parent.textContent = "이 부위·레이어에는 색상이 없습니다.";
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of colors) {
      const button = document.createElement("button"),
        dot = document.createElement("i"),
        count = document.createElement("small");
      dot.style.background = entry.color;
      count.textContent = `${entry.percentage.toFixed(1)}%`;
      button.append(dot, count);
      button.title = `${entry.color.toUpperCase()} · ${entry.count}픽셀`;
      button.setAttribute(
        "aria-label",
        `${entry.color.toUpperCase()} · ${entry.percentage.toFixed(1)}%`,
      );
      button.onclick = () => api.setColor(entry.color);
      fragment.append(button);
    }
    parent.append(fragment);
  }
  function renderPinned() {
    $("#pinned-colors").replaceChildren();
    for (const color of pinned) {
      const button = document.createElement("button");
      button.textContent = color.toUpperCase();
      button.style.borderColor = color;
      button.onclick = () => api.setColor(color);
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${color} 고정 해제`);
      remove.onclick = () => {
        pinned = pinned.filter((value) => value !== color);
        renderPinned();
        persist();
      };
      $("#pinned-colors").append(button, remove);
    }
  }
  $("#pin-color").onclick = () => {
    if (pinned.includes(api.state.color)) return;
    if (pinned.length >= 32) {
      api.notify("색상은 최대 32개까지 고정할 수 있습니다.");
      return;
    }
    pinned.push(api.state.color);
    renderPinned();
    persist();
  };
  $("#palette-refresh").onclick = renderPalette;
  for (const id of ["palette-source", "palette-part", "palette-layer"])
    $(`#${id}`).onchange = renderPalette;
  $("#palette-extraction").addEventListener("toggle", renderPalette);
  $("#compose-preview").onclick = () => {
    if (!current()) return;
    api.finishStroke();
    try {
      const scope = $("#compose-scope").value;
      if (scope === "rectangle" && !rectangle)
        throw new Error("먼저 펼침도에서 사각형 영역을 드래그하세요.");
      const parts = $$("#compose-parts input:checked").map(
        (input) => input.value,
      );
      const result = composeSkin(api.state.data, current().data, {
        parts,
        layer: $("#compose-layer").value,
        model: api.state.model,
        sourceModel: current().model,
        face: scope === "rectangle" ? "all" : scope,
        rectangle: scope === "rectangle" ? rectangle : null,
        includeTransparent: $("#compose-transparency").value === "include",
      });
      if (!result.changed)
        throw new Error(
          "변경할 픽셀이 없습니다. 선택 부위·레이어·영역을 확인하세요.",
        );
      candidate = result.data;
      sourceSnapshot = api.snapshot();
      $("#compose-summary").textContent =
        `${current().name} → ${parts.map((part) => PARTS[part].label).join(", ")} · ${result.changed}픽셀 변경`;
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = textureCanvas.height = 64;
      textureCanvas
        .getContext("2d")
        .putImageData(new ImageData(candidate, 64, 64), 0, 0);
      $("#compose-dialog").showModal();
      try {
        if (!previewViewer)
          previewViewer = new SkinViewer({
            canvas: $("#compose-canvas"),
            width: 500,
            height: 340,
            zoom: 0.8,
          });
        if (previewTexture) previewTexture.dispose();
        previewTexture = new CanvasTexture(textureCanvas);
        previewTexture.magFilter = previewTexture.minFilter = NearestFilter;
        previewViewer.playerObject.skin.map = previewTexture;
        previewViewer.playerObject.skin.visible = true;
        previewViewer.playerObject.skin.modelType = api.state.model;
        previewViewer.setSize(
          $(".compose-preview").clientWidth,
          $(".compose-preview").clientHeight,
        );
        previewViewer.renderPaused = false;
        if (api.views) {
          previewViewer.camera.position.copy(api.views.editor.camera.position);
          previewViewer.controls.update();
        }
        $("#compose-canvas").hidden = false;
        $("#compose-fallback").hidden = true;
      } catch {
        $("#compose-canvas").hidden = true;
        $("#compose-fallback").hidden = false;
        $("#compose-fallback").getContext("2d").drawImage(textureCanvas, 0, 0);
      }
    } catch (error) {
      api.notify(error.message);
    }
  };
  $("#compose-cancel").onclick = () => $("#compose-dialog").close();
  $("#compose-dialog").addEventListener("close", () => {
    candidate = null;
    sourceSnapshot = null;
    if (previewViewer) previewViewer.renderPaused = true;
  });
  $("#compose-apply").onclick = () => {
    if (!candidate || !sourceSnapshot) return;
    if (
      api.state.model !== sourceSnapshot.model ||
      !api.state.data.every(
        (value, index) => value === sourceSnapshot.data[index],
      )
    ) {
      $("#compose-dialog").close();
      api.notify("편집 내용이 바뀌었습니다. 합성 미리보기를 다시 열어주세요.");
      return;
    }
    api.state.data = candidate;
    api.commit(sourceSnapshot);
    $("#compose-dialog").close();
    api.notify("합성을 적용했습니다. 실행 취소로 되돌릴 수 있습니다.");
  };
  if (!api.views) view2d = true;
  $("#quick-color").value = api.state.color;
  $("#quick-color").oninput = (event) => api.setColor(event.target.value);
  renderPinned();
  renderList();
  updateLayout(false);
  let paletteTimer;
  return {
    refresh: () => {
      syncVisibility();
      clearTimeout(paletteTimer);
      paletteTimer = setTimeout(renderPalette, 120);
    },
    isModalOpen: () => $("#compose-dialog").open,
  };
}
