<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertRecipeRequest;
use App\Models\Recipe;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecipeController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'dish_id' => ['nullable', 'integer', 'exists:dishes,id'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $recipes = Recipe::query()
            ->with([
                'dish:id,name,base_price',
                'variant:id,dish_id,name,price',
                'items.inventoryItem:id,name,sku,unit,average_cost',
            ])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('name', 'like', $search)
                        ->orWhereHas('dish', fn ($dish) => $dish->where('name', 'like', $search));
                });
            })
            ->when($request->filled('dish_id'), fn ($query) => $query->where('dish_id', $request->integer('dish_id')))
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        $recipes->getCollection()->transform(function (Recipe $recipe): Recipe {
            $recipe->setAttribute('recipe_cost', $this->computeRecipeCost($recipe));

            return $recipe;
        });

        return $this->paginated('Recipes retrieved.', $recipes);
    }

    public function store(UpsertRecipeRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $recipe = DB::transaction(function () use ($request, $activityLogger): Recipe {
            $data = $request->validated();
            $items = $data['items'];
            unset($data['items']);

            $recipe = Recipe::query()->create($data);
            $this->syncItems($recipe, $items);
            $activityLogger->log($request, 'recipe.created', 'recipes', $recipe, after: $recipe->toArray());

            return $recipe->fresh([
                'dish:id,name,base_price',
                'variant:id,dish_id,name,price',
                'items.inventoryItem:id,name,sku,unit,average_cost',
            ]);
        });

        $recipe->setAttribute('recipe_cost', $this->computeRecipeCost($recipe));

        return $this->success('Recipe created.', $recipe, 201);
    }

    public function show(Recipe $recipe): JsonResponse
    {
        $recipe->load([
            'dish:id,name,base_price',
            'variant:id,dish_id,name,price',
            'items.inventoryItem:id,name,sku,unit,average_cost',
        ]);
        $recipe->setAttribute('recipe_cost', $this->computeRecipeCost($recipe));

        return $this->success('Recipe retrieved.', $recipe);
    }

    public function update(UpsertRecipeRequest $request, Recipe $recipe, ActivityLogger $activityLogger): JsonResponse
    {
        $recipe = DB::transaction(function () use ($request, $recipe, $activityLogger): Recipe {
            $before = $recipe->toArray();
            $data = $request->validated();
            $items = $data['items'];
            unset($data['items']);

            $recipe->update($data);
            $this->syncItems($recipe, $items);
            $activityLogger->log($request, 'recipe.updated', 'recipes', $recipe, $before, $recipe->fresh()->toArray());

            return $recipe->fresh([
                'dish:id,name,base_price',
                'variant:id,dish_id,name,price',
                'items.inventoryItem:id,name,sku,unit,average_cost',
            ]);
        });

        $recipe->setAttribute('recipe_cost', $this->computeRecipeCost($recipe));

        return $this->success('Recipe updated.', $recipe);
    }

    public function destroy(Request $request, Recipe $recipe, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $recipe->toArray();
        DB::transaction(function () use ($request, $recipe, $activityLogger, $before): void {
            $recipe->items()->delete();
            $recipe->delete();
            $activityLogger->log($request, 'recipe.deleted', 'recipes', $recipe, $before, ['deleted' => true]);
        });

        return $this->success('Recipe deleted.');
    }

    public function costing(): JsonResponse
    {
        $recipes = Recipe::query()
            ->with([
                'dish:id,name,base_price',
                'variant:id,dish_id,name,price',
                'items.inventoryItem:id,name,average_cost',
            ])
            ->orderBy('id')
            ->get();

        $rows = $recipes->map(function (Recipe $recipe): array {
            $recipeCost = $this->computeRecipeCost($recipe);
            $sellingPrice = (float) ($recipe->variant?->price ?? $recipe->dish?->base_price ?? 0);
            $grossMargin = round($sellingPrice - $recipeCost, 2);
            $foodCostPercent = $sellingPrice > 0
                ? round(($recipeCost / $sellingPrice) * 100, 2)
                : 0.0;

            return [
                'recipe_id' => $recipe->id,
                'name' => $recipe->name ?? $recipe->dish?->name,
                'dish_id' => $recipe->dish_id,
                'dish_name' => $recipe->dish?->name,
                'dish_variant_id' => $recipe->dish_variant_id,
                'variant_name' => $recipe->variant?->name,
                'selling_price' => round($sellingPrice, 2),
                'recipe_cost' => $recipeCost,
                'food_cost_percent' => $foodCostPercent,
                'margin' => $grossMargin,
                'gross_margin' => $grossMargin,
            ];
        })->values();

        return $this->success('Recipe costing retrieved.', $rows);
    }

    /**
     * @param  list<array{inventory_item_id: int, quantity: float|int|string, unit: string, wastage_percent?: float|int|string|null}>  $items
     */
    private function syncItems(Recipe $recipe, array $items): void
    {
        $keepIds = [];

        foreach ($items as $line) {
            $recipeItem = $recipe->items()->updateOrCreate(
                ['inventory_item_id' => $line['inventory_item_id']],
                [
                    'quantity' => $line['quantity'],
                    'unit' => $line['unit'],
                    'wastage_percent' => $line['wastage_percent'] ?? 0,
                ],
            );
            $keepIds[] = $recipeItem->id;
        }

        $recipe->items()->whereNotIn('id', $keepIds)->delete();
    }

    private function computeRecipeCost(Recipe $recipe): float
    {
        $total = 0.0;

        foreach ($recipe->items as $line) {
            $qty = (float) $line->quantity;
            $wastage = (float) ($line->wastage_percent ?? 0);
            $averageCost = (float) ($line->inventoryItem?->average_cost ?? 0);
            $total += $qty * (1 + ($wastage / 100)) * $averageCost;
        }

        return round($total, 2);
    }
}
