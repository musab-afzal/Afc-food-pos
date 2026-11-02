<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertDishVariantRequest;
use App\Models\Dish;
use App\Models\DishVariant;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DishVariantController extends Controller
{
    use ApiResponse;

    public function index(Request $request, Dish $dish): JsonResponse
    {
        $request->validate([
            'is_active' => ['nullable', 'boolean'],
        ]);

        $variants = $dish->variants()
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return $this->success('Variants retrieved.', $variants);
    }

    public function store(UpsertDishVariantRequest $request, Dish $dish, ActivityLogger $activityLogger): JsonResponse
    {
        $variant = DB::transaction(function () use ($request, $dish, $activityLogger): DishVariant {
            $variant = $dish->variants()->create($request->validated());
            $activityLogger->log($request, 'dish_variant.created', 'menu', $variant, after: $variant->toArray());

            return $variant;
        });

        return $this->success('Variant created.', $variant, 201);
    }

    public function update(UpsertDishVariantRequest $request, Dish $dish, DishVariant $variant, ActivityLogger $activityLogger): JsonResponse
    {
        if ($variant->dish_id !== $dish->id) {
            return $this->error('Variant does not belong to this dish.', 404);
        }

        $before = $variant->toArray();
        DB::transaction(function () use ($request, $variant, $activityLogger, $before): void {
            $variant->update($request->validated());
            $activityLogger->log($request, 'dish_variant.updated', 'menu', $variant, $before, $variant->fresh()->toArray());
        });

        return $this->success('Variant updated.', $variant->fresh());
    }

    public function destroy(Request $request, Dish $dish, DishVariant $variant, ActivityLogger $activityLogger): JsonResponse
    {
        if ($variant->dish_id !== $dish->id) {
            return $this->error('Variant does not belong to this dish.', 404);
        }

        $before = $variant->toArray();
        DB::transaction(function () use ($request, $variant, $activityLogger, $before): void {
            $variant->delete();
            $activityLogger->log($request, 'dish_variant.deleted', 'menu', $variant, $before, ['deleted' => true]);
        });

        return $this->success('Variant deleted.');
    }
}
