<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['customer_id', 'type', 'points', 'balance_after', 'reference_type', 'reference_id', 'notes', 'created_by'])]
class LoyaltyTransaction extends Model
{
    public const TYPES = ['earn', 'redeem', 'adjust'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return ['points' => 'integer', 'balance_after' => 'integer'];
    }
}

