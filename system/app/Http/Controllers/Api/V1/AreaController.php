<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertAreaRequest;
use App\Models\Area;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AreaController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,sort_order,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'sort_order';
        $direction = $request->string('direction')->value() ?: 'asc';

        $areas = Area::query()
            ->withCount('tables')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('description', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Areas retrieved.', $areas);
    }

    public function store(UpsertAreaRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $area = DB::transaction(function () use ($request, $activityLogger): Area {
            $data = $request->validated();
            $data['sort_order'] = $data['sort_order'] ?? 0;

            $area = Area::query()->create($data);
            $activityLogger->log($request, 'area.created', 'tables', $area, after: $area->toArray());

            return $area;
        });

        return $this->success('Area created.', $area->loadCount('tables'), 201);
    }

    public function show(Area $area): JsonResponse
    {
        return $this->success('Area retrieved.', $area->loadCount('tables'));
    }

    public function update(UpsertAreaRequest $request, Area $area, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $area->toArray();
        DB::transaction(function () use ($request, $area, $activityLogger, $before): void {
            $area->update($request->validated());
            $activityLogger->log($request, 'area.updated', 'tables', $area, $before, $area->fresh()->toArray());
        });

        return $this->success('Area updated.', $area->fresh()->loadCount('tables'));
    }

    public function destroy(Request $request, Area $area, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $area->toArray();
        DB::transaction(function () use ($request, $area, $activityLogger, $before): void {
            $area->update(['is_active' => false]);
            $area->delete();
            $activityLogger->log($request, 'area.deleted', 'tables', $area, $before, ['deleted' => true]);
        });

        return $this->success('Area deleted.');
    }
}
