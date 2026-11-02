<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['staff_id', 'date', 'check_in', 'check_out', 'working_minutes', 'late_minutes', 'overtime_minutes', 'status', 'notes'])]
class Attendance extends Model
{
    protected $table = 'attendance';

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'check_in' => 'datetime',
            'check_out' => 'datetime',
        ];
    }
}
