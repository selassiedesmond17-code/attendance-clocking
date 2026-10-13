"use client";

export default function ThemeToggle() {
  function toggle() {
    const el = document.documentElement;
    const next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage unavailable: the choice just won't be remembered
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="neu-btn theme-toggle"
      aria-label="Switch between light and dark mode"
      title="Switch between light and dark mode"
    >
      <span className="icon-sun" aria-hidden="true">☀</span>
      <span className="icon-moon" aria-hidden="true">☾</span>
    </button>
  );
}