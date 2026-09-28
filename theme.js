(() => {
  const KEY = "cw-theme-v2";

  function normalize(value) {
    return value === "dark" ? "dark" : "light";
  }

  function apply(theme) {
    theme = normalize(theme);
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById("themeToggle");
    if (!button) return;
    const icon = button.querySelector(".theme-icon");
    const label = button.querySelector(".theme-text");
    if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
    if (label) label.textContent = theme === "dark" ? "Claro" : "Escuro";
    button.title = theme === "dark" ? "Usar tema claro" : "Usar tema escuro";
    button.setAttribute("aria-label", button.title);
  }

  window.applyCalcWorldTheme = apply;
  window.toggleCalcWorldTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  };

  let saved = "light";
  try { saved = localStorage.getItem(KEY) || "light"; } catch {}
  apply(saved);
})();
