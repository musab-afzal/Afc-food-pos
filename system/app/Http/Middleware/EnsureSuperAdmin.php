<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    /**
     * Role & permission administration is Super Admin only.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'data' => null,
                'errors' => null,
            ], 401);
        }

        if (! $user->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Only Super Admin can manage roles and permissions.',
                'data' => null,
                'errors' => null,
            ], 403);
        }

        return $next($request);
    }
}
