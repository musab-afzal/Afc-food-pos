<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryMovementController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'type' => ['nullable', 'string', Rule::in(InventoryMovement::TYPES)],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'sort' => ['nullable', 'in:occurred_at,created_at,quantity'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'occurred_at';
        $direction = $request->string('direction')->value() ?: 'desc';

        $movements = InventoryMovement::query()
            ->with(['inventoryItem:id,name,sku,unit', 'user:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->whereHas('inventoryItem', fn ($nested) => $nested->where('name', 'like', $search));
            })
            ->when($request->filled('inventory_item_id'), fn ($query) => $query->where('inventory_item_id', $request->integer('inventory_item_id')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('occurred_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('occurred_at', '<=', $request->date('date_to')))
            ->orderBy($sort, $direction)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Inventory movements retrieved.', $movements);
    }
}
