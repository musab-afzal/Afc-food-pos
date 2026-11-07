<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    /**
     * Serve files from storage/app/public when the public/storage symlink is missing
     * (common on shared hosting like Hostinger).
     */
    public function storage(Request $request, string $path): Response
    {
        return $this->respond($path, 'public');
    }

    /**
     * Serve files mirrored into public/uploads.
     */
    public function uploads(Request $request, string $path): Response
    {
        $safe = $this->safePath($path);
        $absolute = public_path('uploads/'.$safe);
        if (! is_file($absolute)) {
            abort(404);
        }

        return response()->file($absolute);
    }

    private function respond(string $path, string $disk): Response
    {
        $safe = $this->safePath($path);
        if (! Storage::disk($disk)->exists($safe)) {
            abort(404);
        }

        return Storage::disk($disk)->response($safe);
    }

    private function safePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $path = ltrim($path, '/');
        if ($path === '' || str_contains($path, '..')) {
            abort(404);
        }

        return $path;
    }
}
