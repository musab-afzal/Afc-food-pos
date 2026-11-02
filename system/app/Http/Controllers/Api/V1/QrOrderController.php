<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\QrOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QrOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly QrOrderService $qrOrders) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:30'],
            'payment_status' => ['nullable', 'string', 'max:30'],
            'table_id' => ['nullable', 'integer', 'exists:restaurant_tables,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->qrOrders->listForStaff($request->only([
            'search', 'status', 'payment_status', 'table_id', 'date_from', 'date_to', 'per_page',
        ]));

        return $this->paginated('QR orders retrieved.', $paginator);
    }

    public function accept(Request $request, Order $order, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $order->status, 'source' => $order->source];
        $order = $this->qrOrders->accept($order, $request->user());
        $activityLogger->log($request, 'qr_order.accepted', 'orders', $order, $before, [
            'status' => $order->status,
            'order_number' => $order->order_number,
        ]);

        return $this->success('QR order accepted.', $order);
    }

    public function reject(Request $request, Order $order, ActivityLogger $activityLogger): JsonResponse
    {
        $user = $request->user();
        if (! $user?->hasPermission('orders.cancel') && ! $user?->hasPermission('orders.update')) {
            return $this->error('You do not have permission to reject QR orders.', 403);
        }

        $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = ['status' => $order->status, 'source' => $order->source];
        $order = $this->qrOrders->reject($order, $user, $request->input('reason'));
        $activityLogger->log($request, 'qr_order.rejected', 'orders', $order, $before, [
            'status' => $order->status,
            'reason' => $request->input('reason'),
        ]);

        return $this->success('QR order rejected.', $order);
    }
}
