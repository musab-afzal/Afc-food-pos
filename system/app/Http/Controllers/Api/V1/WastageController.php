<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWastageRequest;
use App\Models\Wastage;
use App\Services\ActivityLogger;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WastageController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:40'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $wastages = Wastage::query()
            ->with(['user:id,name'])
            ->withCount('items')
            ->when($request->filled('reason'), fn ($query) => $query->where('reason', $request->string('reason')->value()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('wastage_date', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('wastage_date', '<=', $request->date('date_to')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('wastage_number', 'like', $search)
                    ->orWhere('reason', 'like', $search)
                    ->orWhere('notes', 'like', $search));
            })
            ->latest('wastage_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Wastages retrieved.', $wastages);
    }

    public function store(StoreWastageRequest $request, InventoryService $inventoryService, ActivityLogger $activityLogger): JsonResponse
    {
        $wastage = $inventoryService->createWastage($request->user(), $request->validated());
        $activityLogger->log($request, 'wastage.created', 'inventory', $wastage, after: $wastage->toArray());

        return $this->success('Wastage created.', $wastage, 201);
    }

    public function show(Wastage $wastage): JsonResponse
    {
        return $this->success(
            'Wastage retrieved.',
            $wastage->load(['user:id,name', 'items.inventoryItem:id,name,sku,unit']),
        );
    }
}
