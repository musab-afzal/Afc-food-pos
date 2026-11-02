<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#FE9F43">
    <meta name="app-base" content="{{ request()->getBasePath() ?: '/' }}">
    <meta name="description" content="Restaurant operations and offline-first point of sale">
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <title>{{ config('app.name', 'AFC') }}</title>
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body>
    <div id="app"></div>
</body>
</html>
