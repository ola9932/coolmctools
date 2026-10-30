import "./workspace-ui.css";
export function setupWorkspaceUI() {
  const bar = document.createElement("section");
  bar.className = "always-tools";
  bar.setAttribute("aria-label", "항상 표시되는 색상 팔레트");
  bar.innerHTML =
    '<strong>그리기 색상</strong><div id="always-palette"></div><output id="rgb-value" aria-live="polite"></output>';
  document.querySelector(".workspace-bar").after(bar);
  document
    .querySelector("#always-palette")
    .append(document.querySelector("#palette"));
}
export function updateColorReadout(color) {
  const output = document.querySelector("#rgb-value");
  if (output)
    output.textContent = `RGB ${[1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).join(", ")}`;
}
