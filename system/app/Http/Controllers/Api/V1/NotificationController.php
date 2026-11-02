<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'unread' => ['nullable', 'boolean'],
            'type' => ['nullable', 'string', 'max:60'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->notifications->listFor($request->user(), [
            'unread' => $request->boolean('unread'),
            'type' => $request->input('type'),
            'per_page' => $request->integer('per_page', 20),
        ]);

        return $this->success('Notifications retrieved.', $paginator->items(), 200, null, [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
            'unread_count' => $this->notifications->unreadCount($request->user()),
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return $this->success('Unread count retrieved.', ['count' => $this->notifications->unreadCount($request->user())]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        return $this->success('Notification marked as read.', $this->notifications->markRead($request->user(), $id));
    }

    public function readAll(Request $request): JsonResponse
    {
        $updated = $this->notifications->markAllRead($request->user());

        return $this->success('All notifications marked as read.', ['updated' => $updated]);
    }
}
