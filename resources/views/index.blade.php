<!doctype html>
<html lang="en">
  <head>
    <title>GIM hub</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />

    <script>
      const storedTheme = localStorage.getItem("settings-site-theme");
      const prefersDarkTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle(
        "dark-mode",
        storedTheme === "dark" || (!storedTheme && prefersDarkTheme),
      );
    </script>
    @vite(['resources/views/index.js'])
  </head>
  <body id="root"></body>
</html>
