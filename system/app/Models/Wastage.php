<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['wastage_number', 'user_id', 'reason', 'total_cost', 'wastage_date', 'notes'])]
class Wastage extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(WastageItem::class);
    }

    protected function casts(): array
    {
        return [
            'total_cost' => 'decimal:2',
            'wastage_date' => 'date',
        ];
    }
}
