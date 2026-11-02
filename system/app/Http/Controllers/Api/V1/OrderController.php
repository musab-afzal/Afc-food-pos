<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:30'],
            'order_type' => ['nullable', 'in:dine_in,takeaway,delivery'],
            'payment_status' => ['nullable', 'string', 'max:30'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'table_id' => ['nullable', 'integer', 'exists:restaurant_tables,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $orders = Order::query()
            ->with([
                'customer:id,name,phone',
                'table:id,name,table_number,status',
                'creator:id,name',
            ])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('order_number', 'like', $search)
                    ->orWhere('notes', 'like', $search)
                    ->orWhereHas('customer', fn ($customer) => $customer
                        ->where('name', 'like', $search)
                        ->orWhere('phone', 'like', $search)));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('order_type'), fn ($query) => $query->where('order_type', $request->string('order_type')->value()))
            ->when($request->filled('payment_status'), fn ($query) => $query->where('payment_status', $request->string('payment_status')->value()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('ordered_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('ordered_at', '<=', $request->date('date_to')))
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('table_id'), fn ($query) => $query->where('restaurant_table_id', $request->integer('table_id')))
            ->orderByDesc('ordered_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Orders retrieved.', $orders);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load([
            'items.addons',
            'customer',
            'table',
            'creator:id,name,email',
            'sale.payments.method',
            'kitchenTickets.items',
            'statusHistory.user:id,name',
        ]);

        return $this->success('Order retrieved.', $order);
    }

    public function store(StoreOrderRequest $request, OrderService $orderService, ActivityLogger $activityLogger): JsonResponse
    {
        $order = $orderService->createOpenOrder($request->user(), $request->validated());
        $activityLogger->log($request, 'order.created', 'orders', $order, after: [
            'order_number' => $order->order_number,
            'status' => $order->status,
            'grand_total' => $order->grand_total,
        ]);

        return $this->success('Order created.', $order, 201);
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, OrderService $orderService, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $order->status];
        $order = $orderService->updateStatus(
            $order,
            $request->string('status')->value(),
            $request->user(),
            $request->input('notes'),
        );
        $activityLogger->log($request, 'order.status_updated', 'orders', $order, $before, [
            'status' => $order->status,
        ]);

        return $this->success('Order status updated.', $order);
    }

    public function cancel(Request $request, Order $order, OrderService $orderService, ActivityLogger $activityLogger): JsonResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = ['status' => $order->status, 'payment_status' => $order->payment_status];
        $order = $orderService->cancel($order, $request->user(), $request->input('reason'));
        $activityLogger->log($request, 'order.cancelled', 'orders', $order, $before, [
            'status' => $order->status,
            'reason' => $request->input('reason'),
        ]);

        return $this->success('Order cancelled.', $order);
    }
}
