import "./mockup.css";
import { SkinViewer } from "skinview3d";
import { createStarter, faces, putPixel, rgba } from "./skin.js";

const $ = (selector) => document.querySelector(selector);
const examples = [
  { name: "라벤더 후디", colors: ["#b59adb", "#e8b28f", "#493930", "#38334c"] },
  { name: "선셋 재킷", colors: ["#d98b59", "#e8b28f", "#493930", "#3e4b52"] },
  { name: "오션 니트", colors: ["#679fcb", "#e8b28f", "#493930", "#34465f"] },
];
function skin(example) {
  const data = createStarter();
  if (example) {
    for (const part of ["body", "rightArm", "leftArm", "rightLeg", "leftLeg"]) {
      for (const r of faces(part, "base")) {
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) {
            if (part.endsWith("Arm") && y - r.y > 8) continue;
            const color = part.endsWith("Leg")
              ? example.colors[3]
              : example.colors[0];
            putPixel(data, x, y, rgba(color));
            if (
              part === "body" &&
              r.name === "앞" &&
              (x === r.x + 2 || x === r.x + 5) &&
              y - r.y < 4
            )
              putPixel(data, x, y, rgba("#f4eee1"));
          }
      }
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  canvas.getContext("2d").putImageData(new ImageData(data, 64, 64), 0, 0);
  return canvas;
}
const viewers = [
  new SkinViewer({
    canvas: $("#edit-canvas"),
    skin: skin(),
    model: "default",
    width: 500,
    height: 500,
    zoom: 0.8,
  }),
  new SkinViewer({
    canvas: $("#reference-canvas"),
    skin: skin(examples[0]),
    model: "default",
    width: 500,
    height: 400,
    zoom: 0.8,
  }),
];
for (const viewer of viewers) {
  viewer.controls.enableDamping = false;
  const distance = viewer.camera.position.length();
  viewer.camera.position.set(0.3, 0.12, 1).normalize().multiplyScalar(distance);
  viewer.controls.update();
}
let syncing = false;
function synchronize(from, to) {
  if (!$("#sync").checked || syncing) return;
  syncing = true;
  // Match direction and relative zoom, not pixel dimensions of the two panels.
  const relativeDistance =
    from.camera.position.length() /
    (from.height / Math.max(from.width, 1) > 1 ? from.height / from.width : 1);
  const aspectCorrection =
    to.height / Math.max(to.width, 1) > 1 ? to.height / to.width : 1;
  to.camera.position
    .copy(from.camera.position)
    .normalize()
    .multiplyScalar(relativeDistance * aspectCorrection);
  to.controls.target.copy(from.controls.target);
  to.controls.update();
  syncing = false;
}
viewers[0].controls.addEventListener("change", () =>
  synchronize(viewers[0], viewers[1]),
);
viewers[1].controls.addEventListener("change", () =>
  synchronize(viewers[1], viewers[0]),
);
const observer = new ResizeObserver(() => {
  for (const [i, id] of ["edit", "reference"].entries()) {
    const element = $(`#${id}-stage`);
    if (element.clientWidth && element.clientHeight) {
      viewers[i].setSize(element.clientWidth, element.clientHeight);
      $(`#${id}-width`).textContent = `화면 너비 ${element.clientWidth}px`;
    }
  }
});
observer.observe($("#edit-stage"));
observer.observe($("#reference-stage"));
function layout() {
  const visible = $("#reference-toggle").checked;
  $("#workspace").classList.toggle("reference-off", !visible);
  $("#workspace").classList.toggle(
    "float-mode",
    $("#layout").value === "float",
  );
  viewers[1].renderPaused = !visible;
  $("#mode-label").textContent = visible
    ? "레퍼런스 비교 모드"
    : "편집에 집중하는 모드";
  $("#hint").textContent = visible
    ? "레퍼런스를 끄면 편집 화면이 전체 너비로 확장됩니다."
    : "선택한 레퍼런스는 보관 중입니다. 다시 켜면 바로 이어서 비교할 수 있습니다.";
}
$("#reference-toggle").onchange = layout;
$("#layout").onchange = layout;
$("#close-reference").onclick = () => {
  $("#reference-toggle").checked = false;
  layout();
};
$("#settings-toggle").onclick = () => {
  $("#settings").hidden = !$("#settings").hidden;
  $("#settings-toggle").setAttribute("aria-expanded", !$("#settings").hidden);
  $("#settings-toggle").textContent = $("#settings").hidden
    ? "편집 설정 열기"
    : "편집 설정 접기";
};
function chooseReference() {
  const example = examples[Number($("#reference-select").value)];
  viewers[1].loadSkin(skin(example), { model: "default" });
  $("#reference-name").textContent = example.name;
  $("#swatches").replaceChildren();
  for (const color of example.colors) {
    const button = document.createElement("button");
    button.style.background = color;
    button.title = color;
    button.setAttribute("aria-label", `색상 ${color}`);
    button.onclick = () => {
      $("#color").value = color;
      $(".color-dot").style.background = color;
      $("#picked-color").textContent = color.toUpperCase();
    };
    $("#swatches").append(button);
  }
  $("#picked-color").textContent = "색상을 눌러보세요";
}
$("#reference-select").onchange = chooseReference;
$("#color").oninput = (event) => {
  $(".color-dot").style.background = event.target.value;
};
$("#sync").onchange = () => synchronize(viewers[0], viewers[1]);
chooseReference();
