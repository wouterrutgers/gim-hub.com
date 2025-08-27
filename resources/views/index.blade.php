<!doctype html>
<html lang="en">
  <head>
    <title>GIM hub</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preload" href="/fonts/RuneScape-Chat-07.ttf" as="font" type="font/ttf" crossorigin />

    <script>
      window.getTheme = () => {
        let theme = localStorage.getItem("theme");

        if (!theme && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          theme = "dark";
        }

        return theme;
      };

      window.updateTheme = () => {
        const theme = window.getTheme();
        const darkMode = theme === "dark";
        if (darkMode) {
          document.documentElement.classList.add("dark-mode");
        } else {
          document.documentElement.classList.remove("dark-mode");
        }
      };

      window.updateTheme(true);
    </script>
    @viteReactRefresh
    @vite(['resources/views/index.tsx'])
  </head>
  <body id="root">
  </body>
</html>
