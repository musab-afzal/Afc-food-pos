<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockAdjustmentRequest;
use App\Models\StockAdjustment;
use App\Services\ActivityLogger;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockAdjustmentController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', 'in:increase,decrease'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $adjustments = StockAdjustment::query()
            ->with(['user:id,name'])
            ->withCount('items')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('adjustment_date', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('adjustment_date', '<=', $request->date('date_to')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('adjustment_number', 'like', $search)
                    ->orWhere('reason', 'like', $search));
            })
            ->latest('adjustment_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Stock adjustments retrieved.', $adjustments);
    }

    public function store(StoreStockAdjustmentRequest $request, InventoryService $inventoryService, ActivityLogger $activityLogger): JsonResponse
    {
        $adjustment = $inventoryService->createAdjustment($request->user(), $request->validated());
        $activityLogger->log($request, 'stock_adjustment.created', 'inventory', $adjustment, after: $adjustment->toArray());

        return $this->success('Stock adjustment created.', $adjustment, 201);
    }

    public function show(StockAdjustment $stockAdjustment): JsonResponse
    {
        return $this->success(
            'Stock adjustment retrieved.',
            $stockAdjustment->load(['user:id,name', 'items.inventoryItem:id,name,sku,unit']),
        );
    }
}
