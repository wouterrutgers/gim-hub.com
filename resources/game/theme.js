export function applySiteTheme(siteTheme) {
  document.documentElement.classList.toggle("dark-mode", siteTheme === "dark");
}
