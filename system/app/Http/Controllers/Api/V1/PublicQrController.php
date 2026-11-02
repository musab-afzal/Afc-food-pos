<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePublicQrOrderRequest;
use App\Services\QrOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class PublicQrController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly QrOrderService $qrOrders) {}

    public function show(string $token): JsonResponse
    {
        return $this->success('QR table retrieved.', $this->qrOrders->tableContext($token));
    }

    public function menu(string $token): JsonResponse
    {
        return $this->success('QR menu retrieved.', $this->qrOrders->menu($token));
    }

    public function storeOrder(StorePublicQrOrderRequest $request, string $token): JsonResponse
    {
        $order = $this->qrOrders->placeOrder($token, $request->validated());

        return $this->success('QR order placed.', $order, 201);
    }

    public function orderStatus(string $uuid): JsonResponse
    {
        $order = $this->qrOrders->findPublicByUuid($uuid);

        return $this->success('QR order status retrieved.', [
            'uuid' => $order->uuid,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'order_type' => $order->order_type,
            'source' => $order->source,
            'grand_total' => $order->grand_total,
            'subtotal' => $order->subtotal,
            'tax_total' => $order->tax_total,
            'notes' => $order->notes,
            'ordered_at' => $order->ordered_at,
            'table' => $order->table,
            'items' => $order->items,
            'status_history' => $order->statusHistory,
        ]);
    }
}
