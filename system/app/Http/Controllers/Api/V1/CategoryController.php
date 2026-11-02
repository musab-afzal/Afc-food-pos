<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,sort_order,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'sort_order';
        $direction = $request->string('direction')->value() ?: 'asc';
        $categories = Category::query()
            ->withCount('dishes')
            ->when($request->filled('search'), fn ($query) => $query->where(function ($nested) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $nested->where('name', 'like', $search)->orWhere('slug', 'like', $search);
            }))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return CategoryResource::collection($categories)->additional(['success' => true]);
    }

    public function store(UpsertCategoryRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $category = DB::transaction(function () use ($request, $activityLogger): Category {
            $category = Category::query()->create($request->validated());
            $activityLogger->log($request, 'category.created', 'menu', $category, after: $category->toArray());

            return $category;
        });

        return response()->json(['success' => true, 'message' => 'Category created.', 'data' => new CategoryResource($category)], 201);
    }

    public function show(Category $category): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new CategoryResource($category->loadCount('dishes'))]);
    }

    public function update(UpsertCategoryRequest $request, Category $category, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $category->toArray();
        DB::transaction(function () use ($request, $category, $activityLogger, $before): void {
            $category->update($request->validated());
            $activityLogger->log($request, 'category.updated', 'menu', $category, $before, $category->fresh()->toArray());
        });

        return response()->json(['success' => true, 'message' => 'Category updated.', 'data' => new CategoryResource($category->fresh()->loadCount('dishes'))]);
    }

    public function destroy(Request $request, Category $category, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $category->toArray();
        DB::transaction(function () use ($request, $category, $activityLogger, $before): void {
            $category->update(['is_active' => false]);
            $activityLogger->log($request, 'category.archived', 'menu', $category, $before, $category->fresh()->toArray());
        });

        return response()->json(['success' => true, 'message' => 'Category archived. Historical records were preserved.']);
    }
}
