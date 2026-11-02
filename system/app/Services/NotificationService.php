<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * @param  array<string, mixed>  $filters  unread (bool), type, per_page
     */
    public function listFor(User $user, array $filters = []): LengthAwarePaginator
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->when(! empty($filters['unread']), fn (Builder $query) => $query->whereNull('read_at'))
            ->when(! empty($filters['type']), fn (Builder $query) => $query->where('type', $filters['type']))
            // Unread first, then newest.
            ->orderByRaw('read_at IS NULL DESC')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();
    }

    public function unreadCount(User $user): int
    {
        return Notification::query()->where('user_id', $user->id)->whereNull('read_at')->count();
    }

    public function markRead(User $user, int $id): Notification
    {
        $notification = Notification::query()->where('user_id', $user->id)->findOrFail($id);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return $notification->fresh();
    }

    /** @return int number of notifications marked read */
    public function markAllRead(User $user): int
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }

    public function create(User|int $user, string $type, string $title, string $message, ?string $link = null): Notification
    {
        return Notification::query()->create([
            'user_id' => $user instanceof User ? $user->id : $user,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'link' => $link,
        ]);
    }

    /**
     * Notify every active user holding any of the given permissions.
     *
     * @param  list<string>  $permissions
     * @return int number of notifications created
     */
    public function notifyPermission(array $permissions, string $type, string $title, string $message, ?string $link = null): int
    {
        $users = $this->usersWithPermission($permissions);

        foreach ($users as $user) {
            $this->create($user, $type, $title, $message, $link);
        }

        return $users->count();
    }

    /**
     * Same as notifyPermission() but never throws — safe for use in business flows.
     *
     * @param  list<string>  $permissions
     */
    public function tryNotifyPermission(array $permissions, string $type, string $title, string $message, ?string $link = null): void
    {
        try {
            $this->notifyPermission($permissions, $type, $title, $message, $link);
        } catch (\Throwable $e) {
            Log::warning('Notification dispatch failed: '.$e->getMessage());
        }
    }

    /**
     * @param  list<string>  $permissions
     * @return Collection<int, User>
     */
    public function usersWithPermission(array $permissions): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->whereNotIn('status', ['inactive', 'suspended'])
            ->whereHas('roles', fn (Builder $roles) => $roles
                ->where('roles.is_active', true)
                ->whereHas('permissions', fn (Builder $perms) => $perms->whereIn('slug', $permissions)))
            ->get(['id']);
    }
}
