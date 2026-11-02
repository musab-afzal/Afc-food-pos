<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Customer;
use App\Models\Discount;
use App\Models\LoyaltyTransaction;

class PromotionsDashboardService
{
    /** @return array<string, mixed> */
    public function summary(): array
    {
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth();

        return [
            'discounts' => [
                'total' => Discount::query()->count(),
                'active' => Discount::query()->current()->count(),
            ],
            'coupons' => [
                'total' => Coupon::query()->count(),
                'active' => Coupon::query()->current()->count(),
                'expiring_soon' => Coupon::query()->current()->where('expiry_date', '<=', now()->addDays(7)->toDateString())->count(),
                'expired' => Coupon::query()->where('expiry_date', '<', $today)->count(),
                'total_usages' => CouponUsage::query()->count(),
                'discount_given' => number_format((float) CouponUsage::query()->sum('discount_amount'), 2, '.', ''),
                'usages_this_month' => CouponUsage::query()->where('used_at', '>=', $monthStart)->count(),
            ],
            'loyalty' => [
                'points_outstanding' => (int) Customer::query()->sum('loyalty_points'),
                'customers_with_points' => Customer::query()->where('loyalty_points', '>', 0)->count(),
                'transactions_this_month' => LoyaltyTransaction::query()->where('created_at', '>=', $monthStart)->count(),
                'points_earned_this_month' => (int) LoyaltyTransaction::query()->where('created_at', '>=', $monthStart)->where('points', '>', 0)->sum('points'),
                'points_redeemed_this_month' => abs((int) LoyaltyTransaction::query()->where('created_at', '>=', $monthStart)->where('points', '<', 0)->sum('points')),
            ],
            'top_coupons' => Coupon::query()
                ->where('used_count', '>', 0)
                ->orderByDesc('used_count')
                ->limit(5)
                ->get(['id', 'code', 'name', 'used_count'])
                ->map(fn (Coupon $coupon): array => ['id' => $coupon->id, 'code' => $coupon->code, 'name' => $coupon->name, 'used_count' => $coupon->used_count])
                ->all(),
        ];
    }
}
