<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Charge;
use App\Models\Tax;
use App\Models\Unit;
use App\Services\SettingsService;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        /** @var SettingsService $settings */
        $settings = app(SettingsService::class);

        $defaults = [
            ['key' => 'restaurant.name', 'value' => 'AFC Kitchen', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.tagline', 'value' => 'Good food. Better service.', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.logo', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.address', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.phone', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.email', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.tax_number', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.website', 'value' => '', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.timezone', 'value' => 'Asia/Karachi', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.date_format', 'value' => 'd M Y', 'type' => 'string', 'group' => 'restaurant'],
            ['key' => 'restaurant.time_format', 'value' => 'h:i A', 'type' => 'string', 'group' => 'restaurant'],

            ['key' => 'pos.default_order_type', 'value' => 'takeaway', 'type' => 'string', 'group' => 'pos'],
            ['key' => 'pos.allow_negative_stock', 'value' => '0', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.require_customer', 'value' => '0', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.require_table', 'value' => '1', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.allow_discounts', 'value' => '1', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.cashier_max_discount', 'value' => '10', 'type' => 'decimal', 'group' => 'pos'],
            ['key' => 'pos.auto_print', 'value' => '1', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.hold_orders', 'value' => '1', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.require_register', 'value' => '0', 'type' => 'boolean', 'group' => 'pos'],
            ['key' => 'pos.require_shift', 'value' => '0', 'type' => 'boolean', 'group' => 'pos'],

            ['key' => 'order.prefix', 'value' => 'ORD', 'type' => 'string', 'group' => 'order'],
            ['key' => 'order.invoice_prefix', 'value' => 'INV', 'type' => 'string', 'group' => 'order'],
            ['key' => 'order.auto_kitchen_send', 'value' => '1', 'type' => 'boolean', 'group' => 'order'],
            ['key' => 'order.inventory_deduct_on', 'value' => 'confirmation', 'type' => 'string', 'group' => 'order'],

            ['key' => 'kitchen.enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'kitchen'],
            ['key' => 'kitchen.warning_minutes', 'value' => '10', 'type' => 'integer', 'group' => 'kitchen'],
            ['key' => 'kitchen.delay_minutes', 'value' => '20', 'type' => 'integer', 'group' => 'kitchen'],
            ['key' => 'kitchen.sound_notification', 'value' => '1', 'type' => 'boolean', 'group' => 'kitchen'],
            ['key' => 'kitchen.auto_refresh', 'value' => '10', 'type' => 'integer', 'group' => 'kitchen'],
            ['key' => 'kitchen.show_waiter', 'value' => '1', 'type' => 'boolean', 'group' => 'kitchen'],
            ['key' => 'kitchen.show_table', 'value' => '1', 'type' => 'boolean', 'group' => 'kitchen'],
            ['key' => 'kitchen.show_notes', 'value' => '1', 'type' => 'boolean', 'group' => 'kitchen'],

            ['key' => 'delivery.rider_commission_percent', 'value' => '0', 'type' => 'decimal', 'group' => 'delivery'],

            ['key' => 'inventory.allow_negative_stock', 'value' => '0', 'type' => 'boolean', 'group' => 'inventory'],
            ['key' => 'inventory.low_stock_notification', 'value' => '1', 'type' => 'boolean', 'group' => 'inventory'],
            ['key' => 'inventory.auto_recipe_deduction', 'value' => '1', 'type' => 'boolean', 'group' => 'inventory'],
            ['key' => 'inventory.cost_method', 'value' => 'weighted_average', 'type' => 'string', 'group' => 'inventory'],

            ['key' => 'receipt.paper_size', 'value' => '80mm', 'type' => 'string', 'group' => 'receipt'],
            ['key' => 'receipt.header', 'value' => '', 'type' => 'string', 'group' => 'receipt'],
            ['key' => 'receipt.footer', 'value' => 'Thank you for dining with us!', 'type' => 'string', 'group' => 'receipt'],
            ['key' => 'receipt.show_logo', 'value' => '1', 'type' => 'boolean', 'group' => 'receipt'],
            ['key' => 'receipt.show_tax', 'value' => '1', 'type' => 'boolean', 'group' => 'receipt'],
            ['key' => 'receipt.show_cashier', 'value' => '1', 'type' => 'boolean', 'group' => 'receipt'],
            ['key' => 'receipt.show_customer', 'value' => '1', 'type' => 'boolean', 'group' => 'receipt'],
            ['key' => 'receipt.show_review_qr', 'value' => '0', 'type' => 'boolean', 'group' => 'receipt'],
            ['key' => 'receipt.google_review_url', 'value' => '', 'type' => 'string', 'group' => 'receipt'],
            ['key' => 'receipt.website_review_url', 'value' => '', 'type' => 'string', 'group' => 'receipt'],
            ['key' => 'receipt.auto_print', 'value' => '1', 'type' => 'boolean', 'group' => 'receipt'],

            ['key' => 'loyalty.enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'loyalty'],
            ['key' => 'loyalty.spend_amount', 'value' => '100', 'type' => 'decimal', 'group' => 'loyalty'],
            ['key' => 'loyalty.points_earned', 'value' => '1', 'type' => 'decimal', 'group' => 'loyalty'],
            ['key' => 'loyalty.redemption_value', 'value' => '1', 'type' => 'decimal', 'group' => 'loyalty'],
            ['key' => 'loyalty.min_redemption', 'value' => '10', 'type' => 'integer', 'group' => 'loyalty'],
            ['key' => 'loyalty.max_redemption', 'value' => '500', 'type' => 'integer', 'group' => 'loyalty'],

            ['key' => 'currency.code', 'value' => 'PKR', 'type' => 'string', 'group' => 'currency'],
            ['key' => 'currency.symbol', 'value' => 'Rs.', 'type' => 'string', 'group' => 'currency'],
            ['key' => 'currency.position', 'value' => 'before', 'type' => 'string', 'group' => 'currency'],

            ['key' => 'system.app_name', 'value' => 'AFC', 'type' => 'string', 'group' => 'system'],
            ['key' => 'system.pagination', 'value' => '15', 'type' => 'integer', 'group' => 'system'],
            ['key' => 'system.low_stock_threshold_notify', 'value' => '1', 'type' => 'boolean', 'group' => 'system'],
        ];

        foreach ($defaults as $item) {
            if ($settings->get($item['key']) === null) {
                $settings->set($item['key'], $item['value'], $item['type'], $item['group']);
            }
        }

        // Backfill from legacy flat key if present
        $legacyName = $settings->get('restaurant_name');
        if ($legacyName && in_array($settings->get('restaurant.name'), ['ResPOS Kitchen', 'AFC Kitchen'], true)) {
            $settings->set('restaurant.name', $legacyName, 'string', 'restaurant');
        }

        $settings->forgetCache();

        foreach ([
            ['name' => 'Piece', 'short_name' => 'pc', 'type' => 'count', 'conversion_factor' => 1],
            ['name' => 'Kilogram', 'short_name' => 'kg', 'type' => 'weight', 'conversion_factor' => 1],
            ['name' => 'Gram', 'short_name' => 'g', 'type' => 'weight', 'conversion_factor' => 0.001],
            ['name' => 'Liter', 'short_name' => 'l', 'type' => 'volume', 'conversion_factor' => 1],
            ['name' => 'Milliliter', 'short_name' => 'ml', 'type' => 'volume', 'conversion_factor' => 0.001],
            ['name' => 'Box', 'short_name' => 'box', 'type' => 'count', 'conversion_factor' => 1],
            ['name' => 'Dozen', 'short_name' => 'dz', 'type' => 'count', 'conversion_factor' => 12],
        ] as $unit) {
            Unit::query()->updateOrCreate(
                ['short_name' => $unit['short_name']],
                ['name' => $unit['name'], 'type' => $unit['type'], 'conversion_factor' => $unit['conversion_factor'], 'is_active' => true],
            );
        }

        Tax::query()->updateOrCreate(
            ['name' => 'GST'],
            ['percentage' => 0, 'is_inclusive' => false, 'is_active' => true],
        );

        foreach ([
            ['name' => 'Service Charge', 'code' => 'service', 'type' => 'percent', 'value' => 0, 'apply_to' => 'dine_in'],
            ['name' => 'Delivery Charge', 'code' => 'delivery', 'type' => 'fixed', 'value' => 0, 'apply_to' => 'delivery'],
            ['name' => 'Packaging Charge', 'code' => 'packaging', 'type' => 'fixed', 'value' => 0, 'apply_to' => 'takeaway'],
        ] as $charge) {
            Charge::query()->updateOrCreate(['code' => $charge['code']], $charge + ['is_active' => true]);
        }

        foreach ([
            ['name' => 'Cash', 'code' => 'CASH', 'type' => 'cash', 'opening_balance' => 0, 'current_balance' => 0],
            ['name' => 'Bank', 'code' => 'BANK', 'type' => 'bank', 'opening_balance' => 0, 'current_balance' => 0],
            ['name' => 'Easypaisa', 'code' => 'EASYPAISA', 'type' => 'wallet', 'opening_balance' => 0, 'current_balance' => 0],
            ['name' => 'JazzCash', 'code' => 'JAZZCASH', 'type' => 'wallet', 'opening_balance' => 0, 'current_balance' => 0],
        ] as $account) {
            Account::query()->updateOrCreate(['code' => $account['code']], $account + ['is_active' => true]);
        }
    }
}
