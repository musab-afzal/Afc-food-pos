<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['purchase_number', 'supplier_id', 'user_id', 'purchase_date', 'invoice_reference', 'status', 'payment_status', 'subtotal', 'discount', 'tax', 'other_charges', 'total', 'paid', 'remaining', 'payment_method', 'notes'])]
class Purchase extends Model
{
    public const STATUSES = ['draft', 'ordered', 'partial', 'received', 'cancelled'];

    public const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class);
    }

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'other_charges' => 'decimal:2',
            'total' => 'decimal:2',
            'paid' => 'decimal:2',
            'remaining' => 'decimal:2',
        ];
    }
}
