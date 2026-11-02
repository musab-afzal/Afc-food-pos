<?php

namespace App\Models;

use Database\Factories\PaymentMethodFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'code', 'icon', 'is_active', 'requires_reference', 'works_offline', 'sort_order'])]
class PaymentMethod extends Model
{
    /** @use HasFactory<PaymentMethodFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'requires_reference' => 'boolean', 'works_offline' => 'boolean'];
    }
}
