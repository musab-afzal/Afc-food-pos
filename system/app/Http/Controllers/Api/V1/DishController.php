<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertDishRequest;
use App\Http\Resources\DishResource;
use App\Models\Dish;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DishController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'is_active' => ['nullable', 'boolean'],
            'is_available' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,base_price,sort_order,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'sort_order';
        $direction = $request->string('direction')->value() ?: 'asc';
        $dishes = Dish::query()
            ->with([
                'category:id,name,slug',
                'autoMinusItems:id,name,sku,unit,auto_minus,is_active',
            ])
            ->when($request->filled('search'), fn ($query) => $query->where(function ($nested) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $nested->where('name', 'like', $search)->orWhere('sku', 'like', $search)->orWhere('barcode', 'like', $search);
            }))
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->has('is_available'), fn ($query) => $query->where('is_available', $request->boolean('is_available')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return DishResource::collection($dishes)->additional(['success' => true]);
    }

    public function store(UpsertDishRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $dish = DB::transaction(function () use ($request, $activityLogger): Dish {
            $data = $request->safe()->except(['auto_minus_items']);
            $dish = Dish::query()->create($data);
            $this->syncAutoMinusItems($dish, $request->input('auto_minus_items', []));
            $activityLogger->log($request, 'dish.created', 'menu', $dish, after: $dish->toArray());

            return $dish;
        });

        return response()->json([
            'success' => true,
            'message' => 'Dish created.',
            'data' => new DishResource($dish->load(['category', 'autoMinusItems:id,name,sku,unit,auto_minus,is_active'])),
        ], 201);
    }

    public function show(Dish $dish): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new DishResource($dish->load([
                'category',
                'variants' => fn ($query) => $query->orderBy('sort_order'),
                'addons',
                'modifierGroups.modifiers',
                'autoMinusItems:id,name,sku,unit,auto_minus,is_active',
            ])),
        ]);
    }

    public function update(UpsertDishRequest $request, Dish $dish, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $dish->toArray();
        DB::transaction(function () use ($request, $dish, $activityLogger, $before): void {
            $dish->update($request->safe()->except(['auto_minus_items']));
            if ($request->exists('auto_minus_items')) {
                $this->syncAutoMinusItems($dish, $request->input('auto_minus_items', []));
            }
            $activityLogger->log($request, 'dish.updated', 'menu', $dish, $before, $dish->fresh()->toArray());
        });

        return response()->json([
            'success' => true,
            'message' => 'Dish updated.',
            'data' => new DishResource($dish->fresh()->load(['category', 'autoMinusItems:id,name,sku,unit,auto_minus,is_active'])),
        ]);
    }

    /**
     * @param  list<array{inventory_item_id: int|string, quantity: float|int|string}>  $items
     */
    private function syncAutoMinusItems(Dish $dish, array $items): void
    {
        $sync = [];
        foreach ($items as $row) {
            $id = (int) ($row['inventory_item_id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $sync[$id] = ['quantity' => (float) ($row['quantity'] ?? 1)];
        }
        $dish->autoMinusItems()->sync($sync);
    }

    public function destroy(Request $request, Dish $dish, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $dish->toArray();
        DB::transaction(function () use ($request, $dish, $activityLogger, $before): void {
            $dish->update([
                'is_active' => false,
                'is_available' => false,
                'pos_enabled' => false,
                'qr_enabled' => false,
            ]);
            $activityLogger->log($request, 'dish.deleted', 'menu', $dish, $before, [
                'is_active' => false,
                'deleted' => true,
            ]);
            $dish->delete();
        });

        return response()->json(['success' => true, 'message' => 'Dish deleted. Historical sales were preserved.']);
    }

    /** Upload a dish image to public storage; returns path + URL for the form. */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp,gif', 'max:5120'],
        ]);

        $file = $request->file('image');
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');
        $name = Str::uuid()->toString().'.'.$extension;
        $path = $file->storeAs('dishes', $name, 'public');

        if (! is_string($path) || $path === '' || ! Storage::disk('public')->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'Image upload failed. Could not save the file.',
                'data' => null,
                'errors' => ['image' => ['Image upload failed. Could not save the file.']],
            ], 500);
        }

        // Mirror into the web root so Hostinger can serve images even without a storage symlink.
        $publicDir = public_path('uploads/dishes');
        if (! is_dir($publicDir)) {
            mkdir($publicDir, 0755, true);
        }
        $publicAbsolute = $publicDir.DIRECTORY_SEPARATOR.$name;
        $storedAbsolute = Storage::disk('public')->path($path);
        if (is_file($storedAbsolute)) {
            @copy($storedAbsolute, $publicAbsolute);
        }

        $url = '/uploads/dishes/'.$name;

        return response()->json([
            'success' => true,
            'message' => 'Image uploaded.',
            'data' => [
                'path' => $path,
                'url' => $url,
            ],
        ]);
    }
}
