<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertBrandRequest;
use App\Models\Brand;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BrandController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $brands = Brand::query()
            ->withCount('dishes')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('description', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Brands retrieved.', $brands);
    }

    public function store(UpsertBrandRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $brand = DB::transaction(function () use ($request, $activityLogger): Brand {
            $brand = Brand::query()->create($request->validated());
            $activityLogger->log($request, 'brand.created', 'menu', $brand, after: $brand->toArray());

            return $brand;
        });

        return $this->success('Brand created.', $brand->loadCount('dishes'), 201);
    }

    public function show(Brand $brand): JsonResponse
    {
        return $this->success('Brand retrieved.', $brand->loadCount('dishes'));
    }

    public function update(UpsertBrandRequest $request, Brand $brand, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $brand->toArray();
        DB::transaction(function () use ($request, $brand, $activityLogger, $before): void {
            $brand->update($request->validated());
            $activityLogger->log($request, 'brand.updated', 'menu', $brand, $before, $brand->fresh()->toArray());
        });

        return $this->success('Brand updated.', $brand->fresh()->loadCount('dishes'));
    }

    public function destroy(Request $request, Brand $brand, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $brand->toArray();
        DB::transaction(function () use ($request, $brand, $activityLogger, $before): void {
            $brand->update(['is_active' => false]);
            $brand->delete();
            $activityLogger->log($request, 'brand.deleted', 'menu', $brand, $before, ['deleted' => true]);
        });

        return $this->success('Brand deleted.');
    }
}
