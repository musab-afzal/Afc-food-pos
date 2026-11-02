<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogger
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function log(Request $request, string $action, string $module, Model $subject, ?array $before = null, ?array $after = null): void
    {
        DB::table('activity_logs')->insert([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'module' => $module,
            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),
            'before_data' => $before ? json_encode($before) : null,
            'after_data' => $after ? json_encode($after) : null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);
    }
}
