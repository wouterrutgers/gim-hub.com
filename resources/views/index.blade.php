<!doctype html>
<html lang="en">
  <head>
    @php
      $metadata = match (request()->path()) {
          '/' => [
              'title' => 'GIM hub | OSRS Group Ironman tracker',
              'description' => "Track your Old School RuneScape Group Ironman team's items, skills, drops, activity, and locations with GIM hub and the free RuneLite plugin.",
          ],
          'create-group' => [
              'title' => 'Create a group | GIM hub',
              'description' => "Create your Old School RuneScape Group Ironman group in GIM hub, connect the RuneLite plugin, and start tracking your team's items and progress.",
          ],
          'setup-instructions' => [
              'title' => 'RuneLite plugin setup | GIM hub',
              'description' => "Set up the GIM hub RuneLite plugin to sync your Group Ironman team's banks, inventories, skills, activity, and locations.",
          ],
          'changelog' => [
              'title' => "What's new | GIM hub",
              'description' => 'See the latest features, improvements, and fixes for GIM hub, the Old School RuneScape Group Ironman companion.',
          ],
          default => null,
      };
    @endphp
    <meta charset="UTF-8" />
    <title>{{ $metadata['title'] ?? 'GIM hub' }}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    @if (is_null($metadata))
      <meta name="robots" content="noindex" />
    @else
      <meta name="description" content="{{ $metadata['description'] }}" />
      <link rel="canonical" href="{{ url()->current() }}" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="GIM hub" />
      <meta property="og:title" content="{{ $metadata['title'] }}" />
      <meta property="og:description" content="{{ $metadata['description'] }}" />
      <meta property="og:url" content="{{ url()->current() }}" />
    @endif
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
