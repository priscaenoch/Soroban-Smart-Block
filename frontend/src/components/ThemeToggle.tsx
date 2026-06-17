import { useEffect, useState } from "react";

const STORAGE_KEY = "sb-theme-preference";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const nextTheme = saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--text)",
        borderRadius: 6,
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {theme === "dark" ? "🌙 Dark mode" : "☀ Light mode"}
    </button>
  );
}
