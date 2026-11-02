<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $logs = ActivityLog::query()
            ->with('user:id,name,email')
            ->when($request->filled('module'), fn ($query) => $query->where('module', $request->string('module')->value()))
            ->when($request->filled('action'), fn ($query) => $query->where('action', 'like', '%'.$request->string('action')->value().'%'))
            ->when($request->filled('user_id'), fn ($query) => $query->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('created_at', '<=', $request->date('to')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('action', 'like', $search)
                        ->orWhere('module', 'like', $search)
                        ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $search)->orWhere('email', 'like', $search));
                });
            })
            ->latest('created_at')
            ->paginate($request->integer('per_page', 20))
            ->withQueryString();

        return $this->paginated('Activity logs retrieved.', $logs);
    }

    public function show(ActivityLog $activityLog): JsonResponse
    {
        $activityLog->load('user:id,name,email');

        return $this->success('Activity log retrieved.', $activityLog);
    }
}
