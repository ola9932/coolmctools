import "./workspace-ui.css";
import "./theme.css";
export function setupWorkspaceUI() {
  const themeButton = document.createElement("button");
  themeButton.id = "theme-toggle";
  document.querySelector(".site-header").append(themeButton);
  let theme = "dark";
  try {
    theme = localStorage.getItem("coolmc.theme") === "light" ? "light" : "dark";
  } catch {
    /* Storage is optional. */
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    themeButton.textContent = theme === "dark" ? "화이트 모드" : "다크 모드";
    themeButton.setAttribute("aria-label", themeButton.textContent + "로 전환");
  }
  themeButton.onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
    try {
      localStorage.setItem("coolmc.theme", theme);
    } catch {
      /* The theme still works without storage. */
    }
  };
  applyTheme();
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
