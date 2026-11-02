<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertInventoryItemRequest;
use App\Models\InventoryItem;
use App\Services\ActivityLogger;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'inventory_category_id' => ['nullable', 'integer', 'exists:inventory_categories,id'],
            'stock_status' => ['nullable', Rule::in(['low', 'out'])],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,sku,current_stock,average_cost,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';
        $stockStatus = $request->string('stock_status')->value();

        $items = InventoryItem::query()
            ->with(['category:id,name', 'brand:id,name', 'preferredSupplier:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('sku', 'like', $search)
                    ->orWhere('barcode', 'like', $search));
            })
            ->when($request->filled('inventory_category_id'), fn ($query) => $query->where('inventory_category_id', $request->integer('inventory_category_id')))
            // "low" includes at/below reorder (including zero) so notification deep-links stay useful.
            ->when($stockStatus === 'low', fn ($query) => $query->whereColumn('current_stock', '<=', 'reorder_level'))
            ->when($stockStatus === 'out', fn ($query) => $query->where('current_stock', '<=', 0))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Inventory items retrieved.', $items);
    }

    public function store(
        UpsertInventoryItemRequest $request,
        ActivityLogger $activityLogger,
        InventoryService $inventoryService,
    ): JsonResponse {
        $item = DB::transaction(function () use ($request, $activityLogger, $inventoryService): InventoryItem {
            $data = $request->validated();
            $openingStock = (float) ($data['current_stock'] ?? 0);
            $unitCost = isset($data['average_cost']) ? (float) $data['average_cost'] : null;

            $data['current_stock'] = 0;
            $data['minimum_stock'] = $data['minimum_stock'] ?? 0;
            $data['reorder_level'] = $data['reorder_level'] ?? 0;
            $data['average_cost'] = $data['average_cost'] ?? 0;
            $data['latest_purchase_cost'] = $data['latest_purchase_cost'] ?? 0;

            $item = InventoryItem::query()->create($data);

            if ($openingStock > 0) {
                $inventoryService->adjustStock(
                    $item,
                    $openingStock,
                    'opening_stock',
                    $request->user(),
                    'Opening stock',
                    null,
                    $unitCost,
                );
                $item->refresh();
            }

            $activityLogger->log($request, 'inventory_item.created', 'inventory', $item, after: $item->toArray());

            return $item;
        });

        return $this->success(
            'Inventory item created.',
            $item->load(['category:id,name', 'brand:id,name', 'preferredSupplier:id,name']),
            201,
        );
    }

    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        return $this->success(
            'Inventory item retrieved.',
            $inventoryItem->load(['category:id,name', 'brand:id,name', 'preferredSupplier:id,name']),
        );
    }

    public function update(UpsertInventoryItemRequest $request, InventoryItem $inventoryItem, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $inventoryItem->toArray();
        DB::transaction(function () use ($request, $inventoryItem, $activityLogger, $before): void {
            $inventoryItem->update($request->validated());
            $activityLogger->log($request, 'inventory_item.updated', 'inventory', $inventoryItem, $before, $inventoryItem->fresh()->toArray());
        });

        return $this->success(
            'Inventory item updated.',
            $inventoryItem->fresh()->load(['category:id,name', 'brand:id,name', 'preferredSupplier:id,name']),
        );
    }

    public function destroy(Request $request, InventoryItem $inventoryItem, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $inventoryItem->toArray();
        DB::transaction(function () use ($request, $inventoryItem, $activityLogger, $before): void {
            $inventoryItem->update(['is_active' => false]);
            $inventoryItem->delete();
            $activityLogger->log($request, 'inventory_item.deleted', 'inventory', $inventoryItem, $before, ['deleted' => true]);
        });

        return $this->success('Inventory item deleted.');
    }
}
