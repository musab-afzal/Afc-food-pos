<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockMovementRequest;
use App\Models\InventoryItem;
use App\Services\ActivityLogger;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StockMovementController extends Controller
{
    use ApiResponse;

    public function stockIn(StoreStockMovementRequest $request, InventoryService $inventoryService, ActivityLogger $activityLogger): JsonResponse
    {
        $movement = DB::transaction(function () use ($request, $inventoryService, $activityLogger) {
            $data = $request->validated();
            $item = InventoryItem::query()->findOrFail($data['inventory_item_id']);
            $unitCost = isset($data['unit_cost']) ? (float) $data['unit_cost'] : null;

            $movement = $inventoryService->adjustStock(
                $item,
                (float) $data['quantity'],
                'stock_in',
                $request->user(),
                $data['notes'] ?? null,
                null,
                $unitCost,
            );

            $activityLogger->log($request, 'inventory.stock_in', 'inventory', $movement, after: $movement->toArray());

            return $movement;
        });

        return $this->success(
            'Stock in recorded.',
            $movement->load('inventoryItem:id,name,sku,unit,current_stock,average_cost'),
            201,
        );
    }

    public function stockOut(StoreStockMovementRequest $request, InventoryService $inventoryService, ActivityLogger $activityLogger): JsonResponse
    {
        $movement = DB::transaction(function () use ($request, $inventoryService, $activityLogger) {
            $data = $request->validated();
            $item = InventoryItem::query()->findOrFail($data['inventory_item_id']);

            $movement = $inventoryService->adjustStock(
                $item,
                -1 * (float) $data['quantity'],
                'stock_out',
                $request->user(),
                $data['notes'] ?? null,
            );

            $activityLogger->log($request, 'inventory.stock_out', 'inventory', $movement, after: $movement->toArray());

            return $movement;
        });

        return $this->success(
            'Stock out recorded.',
            $movement->load('inventoryItem:id,name,sku,unit,current_stock,average_cost'),
            201,
        );
    }
}
