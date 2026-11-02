<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'start_time', 'end_time', 'grace_minutes', 'is_active'])]
class Shift extends Model
{
    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(Staff::class, 'employee_shifts')
            ->using(EmployeeShift::class)
            ->withPivot('id', 'effective_from')
            ->withTimestamps();
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeShift::class);
    }

    /** True when the shift ends on the following calendar day (e.g. 22:00 - 06:00). */
    public function isOvernight(): bool
    {
        return strcmp((string) $this->end_time, (string) $this->start_time) <= 0;
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'grace_minutes' => 'integer',
        ];
    }
}
