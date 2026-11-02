<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['staff_id', 'name', 'phone', 'vehicle_number', 'status', 'is_active'])]
class Rider extends Model
{
    use SoftDeletes;

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_BUSY = 'busy';

    public const STATUS_OFFLINE = 'offline';

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(RiderSettlement::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
