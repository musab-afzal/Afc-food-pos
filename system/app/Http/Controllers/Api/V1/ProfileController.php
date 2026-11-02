<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    use ApiResponse;

    public function show(Request $request): JsonResponse
    {
        return $this->success('Profile retrieved.', new UserResource($request->user()->load('roles')));
    }

    public function update(Request $request, ActivityLogger $activityLogger): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'avatar' => ['nullable', 'string', 'max:500'],
        ]);

        $before = $user->only(['name', 'email', 'phone', 'avatar']);
        DB::transaction(function () use ($user, $validated, $request, $activityLogger, $before): void {
            $user->update($validated);
            $activityLogger->log($request, 'profile.updated', 'auth', $user, $before, $user->fresh()->only(['name', 'email', 'phone', 'avatar']));
        });

        return $this->success('Profile updated.', new UserResource($user->fresh()->load('roles')));
    }
}
