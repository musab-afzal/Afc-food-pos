<?php

namespace App\Services;

use App\Models\Discount;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DiscountService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): Discount
    {
        $data['used_count'] = 0;

        return Discount::query()->create($data)->fresh();
    }

    /** @param array<string, mixed> $data */
    public function update(Discount $discount, array $data): Discount
    {
        return DB::transaction(function () use ($discount, $data): Discount {
            $discount = Discount::query()->lockForUpdate()->findOrFail($discount->id);

            $limit = array_key_exists('usage_limit', $data) ? $data['usage_limit'] : $discount->usage_limit;
            if ($limit !== null && (int) $limit < $discount->used_count) {
                throw ValidationException::withMessages([
                    'usage_limit' => ["The usage limit cannot be lower than the number of times the discount was already used ({$discount->used_count})."],
                ]);
            }

            $start = array_key_exists('start_date', $data) ? $data['start_date'] : $discount->start_date?->toDateString();
            $end = array_key_exists('end_date', $data) ? $data['end_date'] : $discount->end_date?->toDateString();
            if ($start !== null && $end !== null && $end < $start) {
                throw ValidationException::withMessages(['end_date' => ['The end date must be on or after the start date.']]);
            }

            $discount->update($data);

            return $discount->fresh();
        });
    }

    public function delete(Discount $discount): void
    {
        DB::transaction(function () use ($discount): void {
            Discount::query()->lockForUpdate()->findOrFail($discount->id)->delete();
        });
    }
}
