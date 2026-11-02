<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\LoyaltyTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LoyaltyService
{
    /**
     * Manual points correction (positive adds, negative removes). Locks the customer row so the
     * running balance stays consistent under concurrent updates.
     *
     * @return array{transaction: LoyaltyTransaction, customer: Customer}
     */
    public function adjust(User $user, int $customerId, int $points, ?string $notes = null): array
    {
        return $this->record($user, $customerId, 'adjust', $points, $notes);
    }

    /**
     * Record a loyalty movement of any type. $points is signed (earn > 0, redeem < 0, adjust either).
     *
     * @return array{transaction: LoyaltyTransaction, customer: Customer}
     */
    public function record(User $user, int $customerId, string $type, int $points, ?string $notes = null, ?Model $reference = null): array
    {
        if ($points === 0) {
            throw ValidationException::withMessages(['points' => ['Points must not be zero.']]);
        }
        if ($type === 'earn' && $points < 0 || $type === 'redeem' && $points > 0) {
            throw ValidationException::withMessages(['points' => ["Points sign does not match the {$type} type."]]);
        }

        return DB::transaction(function () use ($user, $customerId, $type, $points, $notes, $reference): array {
            $customer = Customer::query()->lockForUpdate()->find($customerId);
            if (! $customer) {
                throw ValidationException::withMessages(['customer_id' => ['The selected customer does not exist.']]);
            }

            $balance = (int) $customer->loyalty_points + $points;
            if ($balance < 0) {
                throw ValidationException::withMessages([
                    'points' => ["Insufficient loyalty points. The customer has {$customer->loyalty_points} point(s)."],
                ]);
            }

            $customer->update(['loyalty_points' => $balance]);

            $transaction = LoyaltyTransaction::query()->create([
                'customer_id' => $customer->id,
                'type' => $type,
                'points' => $points,
                'balance_after' => $balance,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'notes' => $notes,
                'created_by' => $user->id,
            ]);

            return [
                'transaction' => $transaction->load(['customer:id,name,phone,customer_code,loyalty_points', 'creator:id,name']),
                'customer' => $customer->fresh(),
            ];
        });
    }
}
