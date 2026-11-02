<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'name', 'type', 'value', 'min_order', 'max_discount', 'start_date', 'expiry_date', 'total_usage_limit', 'per_customer_limit', 'used_count', 'is_active'])]
class Coupon extends Model
{
    public const TYPES = ['percent', 'fixed'];

    protected $appends = ['status'];

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }

    /** Coupons that are active, inside their date window and not exhausted today. */
    public function scopeCurrent(Builder $query): Builder
    {
        $today = now()->toDateString();

        return $query->where('is_active', true)
            ->where('start_date', '<=', $today)
            ->where('expiry_date', '>=', $today)
            ->where(fn (Builder $q) => $q->whereNull('total_usage_limit')->orWhereColumn('used_count', '<', 'total_usage_limit'));
    }

    protected function status(): Attribute
    {
        return Attribute::get(function (): string {
            $today = now()->startOfDay();

            return match (true) {
                ! $this->is_active => 'inactive',
                $this->start_date->gt($today) => 'scheduled',
                $this->expiry_date->lt($today) => 'expired',
                $this->total_usage_limit !== null && $this->used_count >= $this->total_usage_limit => 'exhausted',
                default => 'active',
            };
        });
    }

    protected function casts(): array
    {
        return [
            'value' => 'decimal:4',
            'min_order' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'start_date' => 'date:Y-m-d',
            'expiry_date' => 'date:Y-m-d',
            'total_usage_limit' => 'integer',
            'per_customer_limit' => 'integer',
            'used_count' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
