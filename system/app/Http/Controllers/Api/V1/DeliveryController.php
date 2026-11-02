<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignDeliveryRequest;
use App\Http\Requests\UpdateDeliveryStatusRequest;
use App\Models\Delivery;
use App\Services\ActivityLogger;
use App\Services\DeliveryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly DeliveryService $deliveries) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:pending,assigned,picked_up,on_the_way,delivered,failed,cancelled,awaiting_assignment'],
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->deliveries->list($request->only([
            'search', 'status', 'rider_id', 'date_from', 'date_to', 'per_page',
        ]));

        return $this->paginated('Deliveries retrieved.', $paginator);
    }

    public function active(Request $request): JsonResponse
    {
        $request->validate([
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
        ]);

        $items = $this->deliveries->activeDeliveries(
            $request->filled('rider_id') ? $request->integer('rider_id') : null
        );

        return $this->success('Active deliveries retrieved.', $items);
    }

    public function show(Delivery $delivery): JsonResponse
    {
        return $this->success('Delivery retrieved.', $this->deliveries->findWithRelations($delivery));
    }

    public function assign(AssignDeliveryRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $delivery = $this->deliveries->assignRider($request->user(), $request->validated());
        $activityLogger->log($request, 'delivery.assigned', 'deliveries', $delivery, after: [
            'order_id' => $delivery->order_id,
            'rider_id' => $delivery->rider_id,
            'status' => $delivery->status,
        ]);

        return $this->success('Rider assigned to delivery.', $delivery, 201);
    }

    public function updateStatus(
        UpdateDeliveryStatusRequest $request,
        Delivery $delivery,
        ActivityLogger $activityLogger,
    ): JsonResponse {
        $before = [
            'status' => $delivery->status,
            'rider_id' => $delivery->rider_id,
        ];

        $delivery = $this->deliveries->updateStatus(
            $delivery,
            $request->validated('status'),
            $request->user(),
            $request->validated('failure_reason'),
            $request->validated('notes'),
        );

        $activityLogger->log($request, 'delivery.status_updated', 'deliveries', $delivery, $before, [
            'status' => $delivery->status,
            'rider_id' => $delivery->rider_id,
            'delivered_at' => $delivery->delivered_at,
            'failed_at' => $delivery->failed_at,
        ]);

        return $this->success('Delivery status updated.', $delivery);
    }
}
