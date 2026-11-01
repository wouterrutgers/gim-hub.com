export function applySiteTheme(siteTheme) {
  document.documentElement.classList.toggle("dark-mode", siteTheme === "dark");
  document.documentElement.classList.toggle("browntown-mode", siteTheme === "browntown");
}
