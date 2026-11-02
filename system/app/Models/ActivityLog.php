<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['user_id', 'action', 'module', 'subject_type', 'subject_id', 'before_data', 'after_data', 'ip_address', 'user_agent', 'created_at'])]
class ActivityLog extends Model
{
    public $timestamps = false;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return [
            'before_data' => 'array',
            'after_data' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
