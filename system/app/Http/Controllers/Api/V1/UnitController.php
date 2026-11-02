<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertUnitRequest;
use App\Models\Unit;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UnitController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'max:40'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,short_name,type,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $units = Unit::query()
            ->with('baseUnit:id,name,short_name')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('short_name', 'like', $search));
            })
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Units retrieved.', $units);
    }

    public function store(UpsertUnitRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $unit = DB::transaction(function () use ($request, $activityLogger): Unit {
            $unit = Unit::query()->create($request->validated());
            $activityLogger->log($request, 'unit.created', 'inventory', $unit, after: $unit->toArray());

            return $unit;
        });

        return $this->success('Unit created.', $unit->load('baseUnit:id,name,short_name'), 201);
    }

    public function show(Unit $unit): JsonResponse
    {
        return $this->success('Unit retrieved.', $unit->load('baseUnit:id,name,short_name'));
    }

    public function update(UpsertUnitRequest $request, Unit $unit, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $unit->toArray();
        DB::transaction(function () use ($request, $unit, $activityLogger, $before): void {
            $unit->update($request->validated());
            $activityLogger->log($request, 'unit.updated', 'inventory', $unit, $before, $unit->fresh()->toArray());
        });

        return $this->success('Unit updated.', $unit->fresh()->load('baseUnit:id,name,short_name'));
    }

    public function destroy(Request $request, Unit $unit, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $unit->toArray();
        DB::transaction(function () use ($request, $unit, $activityLogger, $before): void {
            $unit->update(['is_active' => false]);
            $activityLogger->log($request, 'unit.archived', 'inventory', $unit, $before, $unit->fresh()->toArray());
        });

        return $this->success('Unit archived.');
    }
}
