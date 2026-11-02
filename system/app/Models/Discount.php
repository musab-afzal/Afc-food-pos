<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'type', 'value', 'applies_to', 'start_date', 'end_date', 'min_order', 'max_discount', 'usage_limit', 'used_count', 'is_active'])]
class Discount extends Model
{
    public const TYPES = ['percent', 'fixed'];

    public const APPLIES_TO = ['order', 'item'];

    protected $appends = ['status'];

    /** Discounts that are active, inside their date window and not exhausted today. */
    public function scopeCurrent(Builder $query): Builder
    {
        $today = now()->toDateString();

        return $query->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('start_date')->orWhere('start_date', '<=', $today))
            ->where(fn (Builder $q) => $q->whereNull('end_date')->orWhere('end_date', '>=', $today))
            ->where(fn (Builder $q) => $q->whereNull('usage_limit')->orWhereColumn('used_count', '<', 'usage_limit'));
    }

    protected function status(): Attribute
    {
        return Attribute::get(function (): string {
            $today = now()->startOfDay();

            return match (true) {
                ! $this->is_active => 'inactive',
                $this->start_date !== null && $this->start_date->gt($today) => 'scheduled',
                $this->end_date !== null && $this->end_date->lt($today) => 'expired',
                $this->usage_limit !== null && $this->used_count >= $this->usage_limit => 'exhausted',
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
            'end_date' => 'date:Y-m-d',
            'usage_limit' => 'integer',
            'used_count' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
