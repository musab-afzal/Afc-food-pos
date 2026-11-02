<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateTableStatusRequest;
use App\Http\Requests\UpsertTableRequest;
use App\Models\Area;
use App\Models\RestaurantTable;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TableController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'area_id' => ['nullable', 'integer', 'exists:areas,id'],
            'status' => ['nullable', 'in:available,occupied,reserved,cleaning,disabled'],
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,table_number,sort_order,status,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'sort_order';
        $direction = $request->string('direction')->value() ?: 'asc';

        $tables = RestaurantTable::query()
            ->with('area:id,name')
            ->when($request->filled('area_id'), fn ($query) => $query->where('area_id', $request->integer('area_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('table_number', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Tables retrieved.', $tables);
    }

    public function floor(): JsonResponse
    {
        $areas = Area::query()
            ->where('is_active', true)
            ->with(['tables' => function ($query): void {
                $query->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('name');
            }])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'sort_order'])
            ->map(fn (Area $area) => [
                'id' => $area->id,
                'name' => $area->name,
                'sort_order' => $area->sort_order,
                'tables' => $area->tables,
            ])
            ->values()
            ->all();

        $unassigned = RestaurantTable::query()
            ->where('is_active', true)
            ->whereNull('area_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        if ($unassigned->isNotEmpty()) {
            $areas[] = [
                'id' => null,
                'name' => 'Unassigned',
                'sort_order' => 9999,
                'tables' => $unassigned,
            ];
        }

        return $this->success('Floor view retrieved.', $areas);
    }

    public function store(UpsertTableRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $table = DB::transaction(function () use ($request, $activityLogger): RestaurantTable {
            $data = $request->validated();
            $data['qr_token'] = $data['qr_token'] ?? (string) Str::uuid();
            $data['table_number'] = $data['table_number'] ?? $data['name'];
            $data['capacity'] = $data['capacity'] ?? 2;
            $data['shape'] = $data['shape'] ?? 'square';
            $data['status'] = $data['status'] ?? 'available';
            $data['sort_order'] = $data['sort_order'] ?? 0;

            $table = RestaurantTable::query()->create($data);
            $activityLogger->log($request, 'table.created', 'tables', $table, after: $table->toArray());

            return $table;
        });

        return $this->success('Table created.', $table->load('area:id,name'), 201);
    }

    public function show(RestaurantTable $table): JsonResponse
    {
        return $this->success('Table retrieved.', $table->load('area:id,name'));
    }

    public function update(UpsertTableRequest $request, RestaurantTable $table, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $table->toArray();
        DB::transaction(function () use ($request, $table, $activityLogger, $before): void {
            $table->update($request->validated());
            $activityLogger->log($request, 'table.updated', 'tables', $table, $before, $table->fresh()->toArray());
        });

        return $this->success('Table updated.', $table->fresh()->load('area:id,name'));
    }

    public function destroy(Request $request, RestaurantTable $table, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $table->toArray();
        DB::transaction(function () use ($request, $table, $activityLogger, $before): void {
            $table->update(['is_active' => false]);
            $table->delete();
            $activityLogger->log($request, 'table.deleted', 'tables', $table, $before, ['deleted' => true]);
        });

        return $this->success('Table deleted.');
    }

    public function updateStatus(UpdateTableStatusRequest $request, RestaurantTable $table, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $table->toArray();
        DB::transaction(function () use ($request, $table, $activityLogger, $before): void {
            $table->update(['status' => $request->validated('status')]);
            $activityLogger->log($request, 'table.status_updated', 'tables', $table, $before, $table->fresh()->toArray());
        });

        return $this->success('Table status updated.', $table->fresh()->load('area:id,name'));
    }

    public function move(Request $request, RestaurantTable $table, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('tables.manage')) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        $validated = $request->validate([
            'area_id' => ['required', 'integer', 'exists:areas,id'],
        ]);

        $before = $table->toArray();
        DB::transaction(function () use ($request, $table, $activityLogger, $before, $validated): void {
            $table->update(['area_id' => $validated['area_id']]);
            $activityLogger->log($request, 'table.moved', 'tables', $table, $before, $table->fresh()->toArray());
        });

        return $this->success('Table moved.', $table->fresh()->load('area:id,name'));
    }

    public function qr(RestaurantTable $table): JsonResponse
    {
        $path = '/menu/table/'.$table->qr_token;

        return $this->success('Table QR retrieved.', [
            'qr_token' => $table->qr_token,
            'path' => $path,
            'public_path' => $path,
            'url' => url($path),
        ]);
    }
}
