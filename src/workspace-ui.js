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
  const model = document.createElement("label");
  model.className = "editor-model";
  model.append("편집 모델 ", document.querySelector("#model"));
  document.querySelector(".workspace-bar").prepend(model);
  const recent = document.querySelector("#recent-colors");
  const recentLabel = document.createElement("div");
  recentLabel.className = "picker-recent";
  const title = document.createElement("span");
  title.textContent = "최근 사용 색상";
  recentLabel.append(title, recent);
  document.querySelector(".inline-color-picker").append(recentLabel);
  const controls = document.createElement("div");
  controls.className = "editing-controls";
  controls.setAttribute("aria-label", "레이어와 신체 부위 설정");
  for (const selector of ["#base-visible", "#parts"])
    controls.append(
      document.querySelector(selector).closest(".setting-section"),
    );
  document.querySelector(".editor-panel>.panel-bar").after(controls);
  window.dispatchEvent(new Event("resize"));
  document.querySelector(".settings-panel").remove();
  window.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      document.querySelector("dialog[open]") ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
    )
      return;
    const target = { l: "#base-visible", p: "#parts input" }[
      event.key.toLowerCase()
    ];
    if (target) {
      event.preventDefault();
      const input = document.querySelector(target);
      input.scrollIntoView({ block: "nearest" });
      input.focus();
    }
  });
}
