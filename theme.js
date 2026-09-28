(() => {
  "use strict";

  const KEY = "cw-theme-v2";
  const root = document.documentElement;

  function getTheme() {
    try {
      return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function updateButton() {
    const buttons = document.querySelectorAll("#themeToggle");
    const dark = root.dataset.theme === "dark";
    buttons.forEach((button) => {
      const icon = button.querySelector(".theme-icon");
      const label = button.querySelector(".theme-text");

      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (label) label.textContent = dark ? "Claro" : "Escuro";

      if (!icon && !label) {
        button.textContent = dark ? "☀" : "☾";
      }

      button.title = dark ? "Usar tema claro" : "Usar tema escuro";
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }

  function apply(theme) {
    const next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (e) {}
    updateButton();
  }

  window.applyCalcWorldTheme = apply;

  window.toggleCalcWorldTheme = function () {
    apply(root.dataset.theme === "dark" ? "light" : "dark");
  };

  // Apply immediately to avoid a flash of the wrong theme.
  root.dataset.theme = getTheme();

  // Bind after the DOM exists. Event delegation also works for buttons
  // inserted dynamically by other CalcWorld scripts.
  function bind() {
    updateButton();
    document.addEventListener("click", function (event) {
      const button = event.target.closest && event.target.closest("#themeToggle");
      if (!button || button.hasAttribute("onclick")) return;
      event.preventDefault();
      event.stopPropagation();
      window.toggleCalcWorldTheme();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
