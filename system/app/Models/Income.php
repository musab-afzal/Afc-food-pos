<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['income_number', 'user_id', 'payment_method_id', 'category', 'amount', 'income_date', 'reference', 'description'])]
class Income extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'income_date' => 'date',
        ];
    }
}
