<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['refund_id', 'sale_item_id', 'quantity', 'amount'])]
class RefundItem extends Model
{
    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class);
    }

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'amount' => 'decimal:2'];
    }
}
