<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['staff_id', 'sale_id', 'meal_date', 'description', 'items', 'amount', 'notes', 'created_by'])]
class StaffMeal extends Model
{
    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected function casts(): array
    {
        return [
            'meal_date' => 'date',
            'amount' => 'decimal:2',
            'items' => 'array',
        ];
    }
}
