<?php

namespace App\Models;

use Database\Factories\SaleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['uuid', 'invoice_number', 'order_id', 'customer_id', 'restaurant_table_id', 'cashier_id', 'order_type', 'status', 'was_offline', 'subtotal', 'discount_total', 'tax_total', 'service_charge', 'delivery_charge', 'rounding', 'grand_total', 'paid_total', 'change_total', 'notes', 'sold_at'])]
class Sale extends Model
{
    /** @use HasFactory<SaleFactory> */
    use HasFactory;

    /** Separator between free-text notes and the JSON receipt extras stored by PosSaleService. */
    public const POS_META_MARKER = '[[pos_meta]]';

    /**
     * Receipt extras stored as a JSON suffix on `notes`: processing_minutes, custom_slip_message, delivery_name.
     *
     * @return array{processing_minutes: ?int, custom_slip_message: ?string, delivery_name: ?string}
     */
    public function posMeta(): array
    {
        $meta = [];
        $position = strpos((string) $this->notes, self::POS_META_MARKER);

        if ($position !== false) {
            $decoded = json_decode(substr((string) $this->notes, $position + strlen(self::POS_META_MARKER)), true);
            $meta = is_array($decoded) ? $decoded : [];
        }

        return [
            'processing_minutes' => isset($meta['processing_minutes']) ? (int) $meta['processing_minutes'] : null,
            'custom_slip_message' => $meta['custom_slip_message'] ?? null,
            'delivery_name' => $meta['delivery_name'] ?? null,
        ];
    }

    /** Notes without the structured meta suffix. */
    public function displayNotes(): ?string
    {
        $position = strpos((string) $this->notes, self::POS_META_MARKER);

        if ($position === false) {
            return $this->notes;
        }

        $text = trim(substr((string) $this->notes, 0, $position));

        return $text !== '' ? $text : null;
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(RestaurantTable::class, 'restaurant_table_id');
    }

    protected function casts(): array
    {
        return [
            'was_offline' => 'boolean', 'subtotal' => 'decimal:2', 'discount_total' => 'decimal:2',
            'tax_total' => 'decimal:2', 'service_charge' => 'decimal:2', 'delivery_charge' => 'decimal:2',
            'rounding' => 'decimal:2', 'grand_total' => 'decimal:2', 'paid_total' => 'decimal:2',
            'change_total' => 'decimal:2', 'sold_at' => 'datetime',
        ];
    }
}
