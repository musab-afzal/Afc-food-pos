<?php

namespace App\Models;

use Database\Factories\RestaurantTableFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['area_id', 'name', 'table_number', 'capacity', 'shape', 'qr_token', 'status', 'sort_order', 'is_active'])]
class RestaurantTable extends Model
{
    /** @use HasFactory<RestaurantTableFactory> */
    use HasFactory, SoftDeletes;

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
