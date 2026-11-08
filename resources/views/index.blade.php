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
      (function restoreCachedTheme() {
        try {
          if (window.location.pathname === "/demo") {
            return;
          }

          const groupName = localStorage.getItem("groupName");
          const selection = JSON.parse(localStorage.getItem("selected-players") ?? "{}")[groupName];
          const snapshot = JSON.parse(localStorage.getItem(`player-preferences:${groupName}`));

          if (!snapshot || snapshot.memberId !== selection) {
            return;
          }

          const siteTheme = snapshot.preferences.siteTheme;
          document.documentElement.classList.toggle("dark-mode", ["dark", "classic-dark"].includes(siteTheme));
          document.documentElement.classList.toggle("browntown-mode", siteTheme === "browntown");
          document.documentElement.classList.toggle("classic-mode", ["classic-light", "classic-dark"].includes(siteTheme));
        } catch {
          // Ignore an unavailable or invalid local snapshot.
        }
      })();
    </script>

    @vite(['resources/views/index.js'])
  </head>
  <body id="root"></body>
</html>
