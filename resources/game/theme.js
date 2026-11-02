export function applySiteTheme(siteTheme) {
  document.documentElement.classList.toggle("dark-mode", ["dark", "classic-dark"].includes(siteTheme));
  document.documentElement.classList.toggle("browntown-mode", siteTheme === "browntown");
  document.documentElement.classList.toggle("classic-mode", ["classic-light", "classic-dark"].includes(siteTheme));
}
