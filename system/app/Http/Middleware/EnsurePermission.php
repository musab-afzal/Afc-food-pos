<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    /**
     * Handle an incoming request. Several permissions may be listed (permission:a,b); any one grants access.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        $allowed = collect($permissions)->contains(fn (string $permission): bool => $user->hasPermission($permission));

        if (! $allowed) {
            abort(403, 'You do not have permission to perform this action.');
        }

        return $next($request);
    }
}
