<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class InventoryDashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(): JsonResponse
    {
        $active = InventoryItem::query()->where('is_active', true);

        $totalItems = (clone $active)->count();
        $lowStock = (clone $active)->whereColumn('current_stock', '<=', 'reorder_level')->where('current_stock', '>', 0)->count();
        $outOfStock = (clone $active)->where('current_stock', '<=', 0)->count();
        $totalValuation = (float) (clone $active)->selectRaw('COALESCE(SUM(current_stock * average_cost), 0) as valuation')->value('valuation');

        $lowStockItems = InventoryItem::query()
            ->where('is_active', true)
            ->whereColumn('current_stock', '<=', 'reorder_level')
            ->where('current_stock', '>', 0)
            ->orderBy('current_stock')
            ->limit(8)
            ->get(['id', 'name', 'sku', 'unit', 'current_stock', 'reorder_level', 'minimum_stock']);

        $recentMovements = InventoryMovement::query()
            ->with('inventoryItem:id,name,sku,unit')
            ->latest('occurred_at')
            ->limit(8)
            ->get();

        return $this->success('Inventory dashboard retrieved.', [
            'total_items' => $totalItems,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'total_valuation' => round($totalValuation, 2),
            'low_stock_items' => $lowStockItems,
            'recent_movements' => $recentMovements,
        ]);
    }
}
