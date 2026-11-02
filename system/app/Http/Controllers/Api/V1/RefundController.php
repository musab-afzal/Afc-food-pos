<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRefundRequest;
use App\Models\Refund;
use App\Models\Sale;
use App\Services\ActivityLogger;
use App\Services\RefundService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefundController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RefundService $refunds) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'sale_id' => ['nullable', 'integer', 'exists:sales,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return $this->paginated('Refunds retrieved.', $this->refunds->list(
            $request->only(['sale_id', 'from', 'to', 'search', 'per_page'])
        ));
    }

    public function show(Refund $refund): JsonResponse
    {
        return $this->success('Refund retrieved.', $this->refunds->show($refund));
    }

    public function forSale(Request $request, Sale $sale): JsonResponse
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        return $this->paginated('Sale refunds retrieved.', $this->refunds->forSale($sale, $request->integer('per_page', 50)));
    }

    public function summary(Sale $sale): JsonResponse
    {
        return $this->success('Refundable summary retrieved.', $this->refunds->summary($sale));
    }

    public function store(StoreRefundRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $refund = $this->refunds->create($request->user(), $request->validated());
        $activityLogger->log($request, 'refund.created', 'pos', $refund, after: [
            'refund_number' => $refund->refund_number,
            'sale_id' => $refund->sale_id,
            'amount' => $refund->amount,
            'restore_inventory' => $refund->restore_inventory,
            'reason' => $refund->reason,
        ]);

        return $this->success('Refund created.', $refund, 201);
    }
}
