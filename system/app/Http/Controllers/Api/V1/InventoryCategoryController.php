<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertInventoryCategoryRequest;
use App\Models\InventoryCategory;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryCategoryController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $categories = InventoryCategory::query()
            ->withCount('items')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('description', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Inventory categories retrieved.', $categories);
    }

    public function store(UpsertInventoryCategoryRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $category = DB::transaction(function () use ($request, $activityLogger): InventoryCategory {
            $category = InventoryCategory::query()->create($request->validated());
            $activityLogger->log($request, 'inventory_category.created', 'inventory', $category, after: $category->toArray());

            return $category;
        });

        return $this->success('Inventory category created.', $category->loadCount('items'), 201);
    }

    public function show(InventoryCategory $inventoryCategory): JsonResponse
    {
        return $this->success('Inventory category retrieved.', $inventoryCategory->loadCount('items'));
    }

    public function update(UpsertInventoryCategoryRequest $request, InventoryCategory $inventoryCategory, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $inventoryCategory->toArray();
        DB::transaction(function () use ($request, $inventoryCategory, $activityLogger, $before): void {
            $inventoryCategory->update($request->validated());
            $activityLogger->log($request, 'inventory_category.updated', 'inventory', $inventoryCategory, $before, $inventoryCategory->fresh()->toArray());
        });

        return $this->success('Inventory category updated.', $inventoryCategory->fresh()->loadCount('items'));
    }

    public function destroy(Request $request, InventoryCategory $inventoryCategory, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $inventoryCategory->toArray();
        DB::transaction(function () use ($request, $inventoryCategory, $activityLogger, $before): void {
            $inventoryCategory->update(['is_active' => false]);
            $inventoryCategory->delete();
            $activityLogger->log($request, 'inventory_category.deleted', 'inventory', $inventoryCategory, $before, ['deleted' => true]);
        });

        return $this->success('Inventory category deleted.');
    }
}
