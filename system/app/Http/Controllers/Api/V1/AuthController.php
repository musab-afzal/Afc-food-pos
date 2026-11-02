<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        if ($user->isLoginBlocked()) {
            $message = match ($user->status) {
                'suspended' => 'This account has been suspended.',
                'inactive' => 'This account is inactive.',
                default => 'This account is inactive.',
            };

            throw ValidationException::withMessages(['email' => [$message]]);
        }

        $user->update(['last_login_at' => now(), 'last_login_ip' => $request->ip()]);
        $token = $user->createToken($request->string('device_name')->value() ?: 'respos-web')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Signed in successfully.',
            'data' => [
                'token' => $token,
                'user' => new UserResource($user->load('roles')),
                'currency' => $this->currencyPayload(app(SettingsService::class)),
            ],
        ]);
    }

    public function me(Request $request, SettingsService $settings): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new UserResource($request->user()->load('roles')),
            'currency' => $this->currencyPayload($settings),
        ]);
    }

    /** @return array{code: string, symbol: string, position: string} */
    private function currencyPayload(SettingsService $settings): array
    {
        return [
            'code' => (string) $settings->get('currency.code', 'PKR'),
            'symbol' => (string) $settings->get('currency.symbol', 'Rs.'),
            'position' => (string) $settings->get('currency.position', 'before'),
        ];
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['success' => true, 'message' => 'Signed out successfully.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $request->user()->update(['password' => $validated['password']]);
        $request->user()->tokens()->delete();

        return response()->json(['success' => true, 'message' => 'Password changed. Please sign in again.']);
    }
}
