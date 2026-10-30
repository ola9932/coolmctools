import "./color-picker.css";

export function rgbToHsv(hex, previousHue = 0) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue = previousHue;
  if (delta)
    hue =
      ((max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) *
        60 +
        360) %
      360;
  return { h: hue, s: max ? (delta / max) * 100 : 0, v: max * 100 };
}
export function hsvToHex({ h, s, v }) {
  const saturation = s / 100,
    value = v / 100;
  const channel = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(
      (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))) * 255,
    )
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + channel(5) + channel(3) + channel(1);
}
export function createColorPicker(initialColor, onChange) {
  let hsv = rgbToHsv(initialColor);
  let notifying = false;
  const root = document.createElement("section");
  root.className = "inline-color-picker";
  root.setAttribute("aria-label", "화면 내 컬러피커");
  root.innerHTML = `<div class="picker-header"><i class="picker-swatch"></i><label>HEX<input id="picker-hex" maxlength="7" spellcheck="false" aria-label="컬러피커 HEX" /></label></div><div class="picker-controls"><div class="picker-sv" aria-label="채도와 명도 선택"><span class="picker-cursor"></span></div><input id="picker-hue" type="range" min="0" max="359" step="1" aria-label="색조" /></div><div class="picker-values"><label>H<input id="picker-h" type="number" min="0" max="359" step="1" aria-label="색조 값" /></label><label>S<input id="picker-s" type="number" min="0" max="100" step="1" aria-label="채도 값" /></label><label>V<input id="picker-v" type="number" min="0" max="100" step="1" aria-label="명도 값" /></label></div>`;
  document.querySelector("#stage").append(root);
  const $ = (selector) => root.querySelector(selector);
  const sv = $(".picker-sv");
  function render(color) {
    root.style.setProperty("--picker-hue", `${hsv.h}`);
    $(".picker-cursor").style.left = `${hsv.s}%`;
    $(".picker-cursor").style.top = `${100 - hsv.v}%`;
    $(".picker-swatch").style.background = color;
    $("#picker-hex").value = color.toUpperCase();
    $("#picker-hue").value = Math.round(hsv.h);
    for (const key of ["h", "s", "v"])
      $(`#picker-${key}`).value = Math.round(hsv[key]);
  }
  function emit() {
    const color = hsvToHex(hsv);
    render(color);
    notifying = true;
    try {
      onChange(color);
    } finally {
      notifying = false;
    }
  }
  let activePointer = null;
  function select(event) {
    const rect = sv.getBoundingClientRect();
    hsv.s = Math.max(
      0,
      Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
    );
    hsv.v = Math.max(
      0,
      Math.min(100, 100 - ((event.clientY - rect.top) / rect.height) * 100),
    );
    emit();
  }
  sv.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    sv.setPointerCapture(event.pointerId);
    select(event);
  });
  sv.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointer) select(event);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    sv.addEventListener(name, () => {
      activePointer = null;
    });
  $("#picker-hue").oninput = (event) => {
    hsv.h = Number(event.target.value);
    emit();
  };
  for (const key of ["h", "s", "v"])
    $(`#picker-${key}`).onchange = (event) => {
      if (event.target.value === "" || !event.target.validity.valid) {
        render(hsvToHex(hsv));
        return;
      }
      hsv[key] = Number(event.target.value);
      emit();
    };
  $("#picker-hex").onchange = (event) => {
    const hex = event.target.value.startsWith("#")
      ? event.target.value
      : "#" + event.target.value;
    if (!/^#[a-f\d]{6}$/i.test(hex)) {
      render(hsvToHex(hsv));
      return;
    }
    hsv = rgbToHsv(hex, hsv.h);
    render(hex);
    onChange(hex);
  };
  render(initialColor);
  return {
    sync(color) {
      if (notifying) return;
      hsv = rgbToHsv(color, hsv.h);
      render(color);
    },
  };
}
