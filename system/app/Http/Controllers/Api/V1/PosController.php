<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePosSaleRequest;
use App\Http\Resources\PosCatalogResource;
use App\Models\Addon;
use App\Models\Category;
use App\Models\Charge;
use App\Models\Dish;
use App\Models\PaymentMethod;
use App\Models\RestaurantTable;
use App\Models\Sale;
use App\Models\Staff;
use App\Models\Tax;
use App\Services\DealService;
use App\Services\PosSaleService;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;

class PosController extends Controller
{
    public function catalog(SettingsService $settings, DealService $deals): JsonResponse
    {
        $dishes = Dish::query()
            ->where('is_active', true)->where('is_available', true)->where('pos_enabled', true)
            ->with([
                'variants' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order'),
                'variants.recipe.items.inventoryItem:id,name,unit,is_active',
                'addons' => fn ($query) => $query->where('is_active', true),
                'recipe.items.inventoryItem:id,name,unit,is_active',
            ])
            ->orderBy('sort_order')->get();

        return response()->json(['success' => true, 'data' => [
            'categories' => Category::query()->where('is_active', true)->orderBy('sort_order')->get(['id', 'name', 'slug']),
            'dishes' => PosCatalogResource::collection($dishes),
            'deals' => $deals->sellable()->map(fn ($deal) => $deals->toCatalog($deal))->values(),
            'addons' => Addon::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'price', 'cost', 'is_active']),
            'payment_methods' => PaymentMethod::query()->where('is_active', true)->orderBy('sort_order')->get(),
            'staff' => Staff::query()
                ->where('status', 'active')
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'employee_id', 'first_name', 'last_name', 'designation', 'salary']),
            'tables' => RestaurantTable::query()
                ->where('is_active', true)
                ->with('area:id,name')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'area_id', 'name', 'table_number', 'capacity', 'status', 'sort_order']),
            'taxes' => Tax::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'percentage', 'is_inclusive']),
            'charges' => Charge::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'type', 'value', 'apply_to']),
            'loyalty' => [
                'enabled' => (bool) $settings->get('loyalty.enabled', false),
                'spend_amount' => (float) $settings->get('loyalty.spend_amount', 0),
                'points_earned' => (float) $settings->get('loyalty.points_earned', 0),
                'redemption_value' => (float) $settings->get('loyalty.redemption_value', 0),
                'min_redemption' => (int) $settings->get('loyalty.min_redemption', 0),
                'max_redemption' => (int) $settings->get('loyalty.max_redemption', 0),
            ],
            'settings' => [
                'require_customer' => (bool) $settings->get('pos.require_customer', false),
                'require_table' => (bool) $settings->get('pos.require_table', false),
                'require_register' => (bool) $settings->get('pos.require_register', false),
                'allow_discounts' => (bool) $settings->get('pos.allow_discounts', true),
                'cashier_max_discount' => (float) $settings->get('pos.cashier_max_discount', 0),
                'default_order_type' => (string) $settings->get('pos.default_order_type', 'takeaway'),
                'auto_print' => (bool) $settings->get('pos.auto_print', true) && (bool) $settings->get('receipt.auto_print', true),
                'invoice_prefix' => (string) $settings->get('order.invoice_prefix', 'INV'),
                'restaurant_name' => (string) $settings->get('restaurant.name', 'AFC'),
                'restaurant_tagline' => (string) $settings->get('restaurant.tagline', ''),
                'restaurant_address' => (string) $settings->get('restaurant.address', ''),
                'restaurant_phone' => (string) $settings->get('restaurant.phone', ''),
                'restaurant_email' => (string) $settings->get('restaurant.email', ''),
                'restaurant_tax_number' => (string) $settings->get('restaurant.tax_number', ''),
                'restaurant_logo' => (string) $settings->get('restaurant.logo', ''),
                'currency_code' => (string) $settings->get('currency.code', 'PKR'),
                'currency_symbol' => (string) $settings->get('currency.symbol', 'Rs.'),
                'currency_position' => (string) $settings->get('currency.position', 'before'),
                'receipt_header' => (string) $settings->get('receipt.header', ''),
                'receipt_footer' => (string) $settings->get('receipt.footer', 'Thank you for dining with us.'),
                'receipt_paper_size' => (string) $settings->get('receipt.paper_size', '80mm'),
                'receipt_show_logo' => (bool) $settings->get('receipt.show_logo', true),
                'receipt_show_tax' => (bool) $settings->get('receipt.show_tax', true),
                'receipt_show_cashier' => (bool) $settings->get('receipt.show_cashier', true),
                'receipt_show_customer' => (bool) $settings->get('receipt.show_customer', true),
                'receipt_show_review_qr' => (bool) $settings->get('receipt.show_review_qr', false),
                'receipt_google_review_url' => (string) $settings->get('receipt.google_review_url', ''),
                'receipt_website_review_url' => (string) $settings->get('receipt.website_review_url', $settings->get('restaurant.website', '')),
            ],
            'cached_at' => now()->toIso8601String(),
        ]]);
    }

    public function store(StorePosSaleRequest $request, PosSaleService $service): JsonResponse
    {
        $sale = $service->complete($request->user(), $request->validated());

        return response()->json(['success' => true, 'message' => 'Sale completed.', 'data' => $this->salePayload($sale)], 201);
    }

    public function sync(StorePosSaleRequest $request, PosSaleService $service): JsonResponse
    {
        $existing = Sale::query()->where('uuid', $request->string('uuid'))->first();
        $sale = $existing ?? $service->complete($request->user(), [...$request->validated(), 'was_offline' => true]);

        return response()->json([
            'success' => true,
            'message' => $existing ? 'Sale was already synchronized.' : 'Offline sale synchronized.',
            'data' => $this->salePayload($sale),
        ]);
    }

    /** @return array<string, mixed> */
    private function salePayload(Sale $sale): array
    {
        $sale->load([
            'items.addons',
            'payments.method',
            'cashier:id,name',
            'customer:id,name,phone,address',
            'table:id,name,table_number',
            'order:id,order_number,payment_status,created_by,delivery_address',
            'order.creator:id,name',
        ]);

        return [
            'id' => $sale->id,
            'uuid' => $sale->uuid,
            'invoice_number' => $sale->invoice_number,
            'order_number' => $sale->order?->order_number,
            'order_type' => $sale->order_type,
            'subtotal' => $sale->subtotal,
            'discount_total' => $sale->discount_total,
            'tax_total' => $sale->tax_total,
            'service_charge' => $sale->service_charge,
            'delivery_charge' => $sale->delivery_charge,
            'grand_total' => $sale->grand_total,
            'paid_total' => $sale->paid_total,
            'change_total' => $sale->change_total,
            'sold_at' => $sale->sold_at,
            'notes' => $sale->displayNotes(),
            ...$sale->posMeta(),
            'payment_status' => $sale->order?->payment_status,
            'cashier' => $sale->cashier,
            'waiter' => $sale->order?->creator,
            'customer' => $sale->customer,
            'table' => $sale->table,
            'delivery_address' => $sale->order?->delivery_address ?: $sale->customer?->address,
            'items' => $sale->items,
            'payments' => $sale->payments,
        ];
    }
}
