<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['employee_id', 'user_id', 'first_name', 'last_name', 'phone', 'email', 'national_id', 'address', 'emergency_contact', 'designation', 'joining_date', 'salary', 'employment_type', 'shift', 'status', 'profile_image', 'notes'])]
class Staff extends Model
{
    use SoftDeletes;

    protected $table = 'staff';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shifts(): BelongsToMany
    {
        return $this->belongsToMany(Shift::class, 'employee_shifts')
            ->using(EmployeeShift::class)
            ->withPivot('id', 'effective_from')
            ->withTimestamps();
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function leaves(): HasMany
    {
        return $this->hasMany(Leave::class);
    }

    protected function casts(): array
    {
        return [
            'joining_date' => 'date',
            'salary' => 'decimal:2',
        ];
    }
}
