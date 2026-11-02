<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

#[Fillable(['staff_id', 'shift_id', 'effective_from'])]
class EmployeeShift extends Pivot
{
    protected $table = 'employee_shifts';

    public $incrementing = true;

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    protected function casts(): array
    {
        return ['effective_from' => 'date'];
    }
}
