<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Dish;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class QrOrderService
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly SettingsService $settings,
        private readonly NotificationService $notifications,
    ) {}

    public function resolveTable(string $token): RestaurantTable
    {
        $table = RestaurantTable::query()
            ->with('area:id,name,is_active')
            ->where('qr_token', $token)
            ->first();

        if (! $table) {
            throw new NotFoundHttpException('Table not found for this QR code.');
        }

        if (! $table->is_active || $table->status === 'disabled') {
            throw ValidationException::withMessages([
                'token' => ['This table is inactive or disabled and cannot accept QR orders.'],
            ]);
        }

        if ($table->area && ! $table->area->is_active) {
            throw ValidationException::withMessages([
                'token' => ['This table area is inactive and cannot accept QR orders.'],
            ]);
        }

        return $table;
    }

    /**
     * @return array<string, mixed>
     */
    public function tableContext(string $token): array
    {
        $table = $this->resolveTable($token);

        return [
            'restaurant_name' => (string) $this->settings->get('restaurant.name', 'AFC'),
            'table' => [
                'id' => $table->id,
                'name' => $table->name,
                'table_number' => $table->table_number,
                'capacity' => $table->capacity,
                'status' => $table->status,
                'qr_token' => $table->qr_token,
                'area' => $table->area ? [
                    'id' => $table->area->id,
                    'name' => $table->area->name,
                ] : null,
            ],
            'menu_path' => '/menu/table/'.$table->qr_token,
        ];
    }

    /**
     * @return array{categories: mixed, dishes: mixed, table: array<string, mixed>}
     */
    public function menu(string $token): array
    {
        $table = $this->resolveTable($token);

        $dishes = Dish::query()
            ->where('is_active', true)
            ->where('is_available', true)
            ->where('qr_enabled', true)
            ->with([
                'variants' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order'),
                'addons' => fn ($query) => $query->where('is_active', true),
            ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get([
                'id', 'category_id', 'name', 'slug', 'sku', 'description', 'short_description',
                'image', 'base_price', 'tax_percent', 'preparation_minutes', 'sort_order', 'qr_enabled',
            ]);

        $categoryIds = $dishes->pluck('category_id')->filter()->unique()->values();

        $categories = Category::query()
            ->where('is_active', true)
            ->whereIn('id', $categoryIds)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'sort_order']);

        return [
            'restaurant_name' => (string) $this->settings->get('restaurant.name', 'AFC'),
            'table' => [
                'id' => $table->id,
                'name' => $table->name,
                'table_number' => $table->table_number,
                'qr_token' => $table->qr_token,
            ],
            'categories' => $categories,
            'dishes' => $dishes->map(fn (Dish $dish) => [
                'id' => $dish->id,
                'category_id' => $dish->category_id,
                'name' => $dish->name,
                'slug' => $dish->slug,
                'sku' => $dish->sku,
                'description' => $dish->short_description ?: $dish->description,
                'image' => $dish->image,
                'price' => $dish->base_price,
                'tax_percent' => $dish->tax_percent,
                'preparation_minutes' => $dish->preparation_minutes,
                'qr_enabled' => $dish->qr_enabled,
                'variants' => $dish->variants->map(fn ($variant) => [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'sku' => $variant->sku,
                    'price' => $variant->price,
                ])->values(),
                'addons' => $dish->addons->map(fn ($addon) => [
                    'id' => $addon->id,
                    'name' => $addon->name,
                    'price' => $addon->price,
                ])->values(),
            ])->values(),
        ];
    }

    /**
     * Place a guest QR order (pending, unpaid). No kitchen ticket or inventory until staff accept.
     *
     * @param  array<string, mixed>  $payload
     */
    public function placeOrder(string $token, array $payload): Order
    {
        $table = $this->resolveTable($token);

        $order = DB::transaction(function () use ($table, $payload): Order {
            $built = $this->orders->quoteLines($payload, 'qr');
            $now = now();
            $uuid = (string) Str::uuid();
            $notes = $this->composeGuestNotes($payload);

            $order = Order::query()->create([
                'uuid' => $uuid,
                'order_number' => 'PENDING-'.$uuid,
                'customer_id' => null,
                'restaurant_table_id' => $table->id,
                'created_by' => null,
                'source' => 'qr',
                'order_type' => 'dine_in',
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'delivery_address' => null,
                'notes' => $notes,
                'subtotal' => $this->orders->moneyFromCents($built['subtotalCents']),
                'discount_total' => $this->orders->moneyFromCents($built['discountCents']),
                'tax_total' => $this->orders->moneyFromCents($built['taxCents']),
                'service_charge' => $this->orders->moneyFromCents($built['serviceChargeCents']),
                'delivery_charge' => $this->orders->moneyFromCents(0),
                'grand_total' => $this->orders->moneyFromCents($built['grandTotalCents']),
                'ordered_at' => $now,
            ]);

            $order->update([
                'order_number' => $this->settings->formatOrderNumber($order->id),
            ]);

            $this->orders->persistOrderItems($order, $built['lines']);

            if ($table->status === 'available') {
                RestaurantTable::query()
                    ->whereKey($table->id)
                    ->update(['status' => 'occupied']);
            }

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'user_id' => null,
                'from_status' => null,
                'to_status' => 'pending',
                'notes' => 'QR guest order placed',
            ]);

            return $order->fresh([
                'items.addons',
                'table:id,name,table_number,status,qr_token',
                'statusHistory',
            ]);
        }, 3);

        // Outside the transaction and failure-tolerant: a notification problem must never block a guest order.
        $this->notifications->tryNotifyPermission(
            ['orders.update'],
            'qr_order',
            'New QR order',
            sprintf('Order %s placed from %s.', $order->order_number, $table->name ?: ('Table '.$table->table_number)),
            '/orders/qr',
        );

        return $order;
    }

    public function findPublicByUuid(string $uuid): Order
    {
        $order = Order::query()
            ->where('uuid', $uuid)
            ->where('source', 'qr')
            ->with([
                'items.addons',
                'table:id,name,table_number,status',
                'statusHistory' => fn ($query) => $query->orderBy('id'),
            ])
            ->first();

        if (! $order) {
            throw new NotFoundHttpException('QR order not found.');
        }

        return $order;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function listForStaff(array $filters): LengthAwarePaginator
    {
        return Order::query()
            ->where('source', 'qr')
            ->with([
                'table:id,name,table_number,status,area_id',
                'table.area:id,name',
                'creator:id,name',
                'items',
            ])
            ->when(
                ! empty($filters['status']),
                fn ($query) => $query->where('status', $filters['status'])
            )
            ->when(
                ! empty($filters['payment_status']),
                fn ($query) => $query->where('payment_status', $filters['payment_status'])
            )
            ->when(
                ! empty($filters['table_id']),
                fn ($query) => $query->where('restaurant_table_id', (int) $filters['table_id'])
            )
            ->when(
                ! empty($filters['search']),
                function ($query) use ($filters): void {
                    $search = '%'.$filters['search'].'%';
                    $query->where(fn ($nested) => $nested
                        ->where('order_number', 'like', $search)
                        ->orWhere('uuid', 'like', $search)
                        ->orWhere('notes', 'like', $search));
                }
            )
            ->when(
                ! empty($filters['date_from']),
                fn ($query) => $query->whereDate('ordered_at', '>=', $filters['date_from'])
            )
            ->when(
                ! empty($filters['date_to']),
                fn ($query) => $query->whereDate('ordered_at', '<=', $filters['date_to'])
            )
            ->orderByDesc('ordered_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();
    }

    public function accept(Order $order, User $user): Order
    {
        return $this->orders->acceptQrOrder($order, $user);
    }

    public function reject(Order $order, User $user, ?string $reason = null): Order
    {
        if ($order->source !== 'qr') {
            throw ValidationException::withMessages(['order' => ['Only QR orders can be rejected here.']]);
        }

        if ($order->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending QR orders can be rejected.']]);
        }

        return $this->orders->cancel(
            $order,
            $user,
            $reason ?: 'QR order rejected'
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function composeGuestNotes(array $payload): ?string
    {
        $parts = [];

        if (! empty($payload['guest_name'])) {
            $parts[] = 'Guest: '.$payload['guest_name'];
        }

        if (! empty($payload['guest_phone'])) {
            $parts[] = 'Phone: '.$payload['guest_phone'];
        }

        if (! empty($payload['notes'])) {
            $parts[] = $payload['notes'];
        }

        if ($parts === []) {
            return null;
        }

        return implode("\n", $parts);
    }
}
