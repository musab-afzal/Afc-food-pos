<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    /**
     * Block API access for inactive / suspended accounts (even with a valid token).
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Always allow logout so a deactivated session can be cleared cleanly.
        if ($request->is('api/*/logout') || $request->is('*/logout')) {
            return $next($request);
        }

        if ($user && $user->isLoginBlocked()) {
            $user->currentAccessToken()?->delete();

            $message = match ($user->status) {
                'suspended' => 'This account has been suspended.',
                'inactive' => 'This account is inactive.',
                default => 'This account is inactive.',
            };

            return response()->json([
                'success' => false,
                'message' => $message,
                'data' => null,
                'errors' => ['account' => [$message]],
            ], 403);
        }

        return $next($request);
    }
}
