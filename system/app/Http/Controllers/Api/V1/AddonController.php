<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertAddonRequest;
use App\Models\Addon;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddonController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,price,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $addons = Addon::query()
            ->withCount('dishes')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where('name', 'like', $search);
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Add-ons retrieved.', $addons);
    }

    public function store(UpsertAddonRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $addon = DB::transaction(function () use ($request, $activityLogger): Addon {
            $data = $request->validated();
            $data['cost'] = $data['cost'] ?? 0;
            $addon = Addon::query()->create($data);
            $activityLogger->log($request, 'addon.created', 'menu', $addon, after: $addon->toArray());

            return $addon;
        });

        return $this->success('Add-on created.', $addon->loadCount('dishes'), 201);
    }

    public function show(Addon $addon): JsonResponse
    {
        return $this->success('Add-on retrieved.', $addon->loadCount('dishes'));
    }

    public function update(UpsertAddonRequest $request, Addon $addon, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $addon->toArray();
        DB::transaction(function () use ($request, $addon, $activityLogger, $before): void {
            $data = $request->validated();
            $data['cost'] = $data['cost'] ?? 0;
            $addon->update($data);
            $activityLogger->log($request, 'addon.updated', 'menu', $addon, $before, $addon->fresh()->toArray());
        });

        return $this->success('Add-on updated.', $addon->fresh()->loadCount('dishes'));
    }

    public function destroy(Request $request, Addon $addon, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $addon->toArray();
        DB::transaction(function () use ($request, $addon, $activityLogger, $before): void {
            $addon->update(['is_active' => false]);
            $activityLogger->log($request, 'addon.archived', 'menu', $addon, $before, $addon->fresh()->toArray());
        });

        return $this->success('Add-on archived.');
    }
}
