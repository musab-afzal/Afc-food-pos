<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\BackupService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class BackupController extends Controller
{
    use ApiResponse;

    public function index(BackupService $backups): JsonResponse
    {
        return $this->success('Backups retrieved.', $backups->list());
    }

    public function store(Request $request, BackupService $backups, ActivityLogger $activityLogger): JsonResponse
    {
        $validated = $request->validate([
            'include_storage' => ['sometimes', 'boolean'],
            'password' => ['required', 'current_password'],
        ]);

        try {
            $backup = $backups->create((bool) ($validated['include_storage'] ?? false));
        } catch (Throwable $e) {
            return $this->error($e->getMessage() ?: 'Backup failed.', 500);
        }

        $activityLogger->log($request, 'system.backup_created', 'system', $request->user(), null, [
            'name' => $backup['name'],
            'size' => $backup['size'],
        ]);

        return $this->success('Backup created.', $backup, 201);
    }

    public function download(string $backup, BackupService $backups): BinaryFileResponse|JsonResponse
    {
        try {
            $path = $backups->absolutePath($backup);
        } catch (Throwable $e) {
            return $this->error($e->getMessage(), 404);
        }

        return response()->download($path, basename($path));
    }

    public function destroy(Request $request, string $backup, BackupService $backups, ActivityLogger $activityLogger): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        try {
            $backups->delete($backup);
        } catch (Throwable $e) {
            return $this->error($e->getMessage(), 404);
        }

        $activityLogger->log($request, 'system.backup_deleted', 'system', $request->user(), null, ['name' => basename($backup)]);

        return $this->success('Backup deleted.');
    }
}
