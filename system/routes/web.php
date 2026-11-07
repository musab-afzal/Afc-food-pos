<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

// Serve uploaded media before the SPA catch-all (Hostinger often has no storage symlink).
Route::get('/media/{path}', [MediaController::class, 'storage'])
    ->where('path', '.*')
    ->name('media.storage');

Route::get('/uploads/{path}', [MediaController::class, 'uploads'])
    ->where('path', '.*')
    ->name('media.uploads');

Route::view('/{path?}', 'app')->where('path', '.*')->name('app');
