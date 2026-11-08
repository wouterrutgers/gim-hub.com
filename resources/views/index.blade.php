<!doctype html>
<html lang="en">
  <head>
    <title>GIM hub</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />

    @vite(['resources/views/index.js'])
  </head>
  <body id="root"></body>
</html>
