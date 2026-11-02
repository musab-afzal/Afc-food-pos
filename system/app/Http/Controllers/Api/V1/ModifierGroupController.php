<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertModifierGroupRequest;
use App\Models\Modifier;
use App\Models\ModifierGroup;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModifierGroupController extends Controller
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

        $groups = ModifierGroup::query()
            ->with(['modifiers', 'dishes:id,name'])
            ->withCount(['modifiers', 'dishes'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where('name', 'like', $search);
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Modifier groups retrieved.', $groups);
    }

    public function store(UpsertModifierGroupRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $group = DB::transaction(function () use ($request, $activityLogger): ModifierGroup {
            $data = $request->safe()->except(['modifiers', 'dish_ids']);
            $group = ModifierGroup::query()->create($data);
            $this->syncModifiers($group, $request->input('modifiers', []));
            if ($request->has('dish_ids')) {
                $group->dishes()->sync($request->input('dish_ids', []));
            }
            $activityLogger->log($request, 'modifier_group.created', 'menu', $group, after: $group->load(['modifiers', 'dishes:id,name'])->toArray());

            return $group;
        });

        return $this->success('Modifier group created.', $group->load(['modifiers', 'dishes:id,name'])->loadCount(['modifiers', 'dishes']), 201);
    }

    public function show(ModifierGroup $modifierGroup): JsonResponse
    {
        return $this->success(
            'Modifier group retrieved.',
            $modifierGroup->load(['modifiers', 'dishes:id,name'])->loadCount(['modifiers', 'dishes'])
        );
    }

    public function update(UpsertModifierGroupRequest $request, ModifierGroup $modifierGroup, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $modifierGroup->load(['modifiers', 'dishes:id,name'])->toArray();
        DB::transaction(function () use ($request, $modifierGroup, $activityLogger, $before): void {
            $modifierGroup->update($request->safe()->except(['modifiers', 'dish_ids']));
            if ($request->has('modifiers')) {
                $this->syncModifiers($modifierGroup, $request->input('modifiers', []));
            }
            if ($request->has('dish_ids')) {
                $modifierGroup->dishes()->sync($request->input('dish_ids', []));
            }
            $activityLogger->log(
                $request,
                'modifier_group.updated',
                'menu',
                $modifierGroup,
                $before,
                $modifierGroup->fresh()->load(['modifiers', 'dishes:id,name'])->toArray()
            );
        });

        return $this->success(
            'Modifier group updated.',
            $modifierGroup->fresh()->load(['modifiers', 'dishes:id,name'])->loadCount(['modifiers', 'dishes'])
        );
    }

    public function destroy(Request $request, ModifierGroup $modifierGroup, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $modifierGroup->toArray();
        DB::transaction(function () use ($request, $modifierGroup, $activityLogger, $before): void {
            $modifierGroup->update(['is_active' => false]);
            $activityLogger->log($request, 'modifier_group.archived', 'menu', $modifierGroup, $before, $modifierGroup->fresh()->toArray());
        });

        return $this->success('Modifier group archived.');
    }

    /**
     * @param  array<int, array<string, mixed>>  $modifiers
     */
    private function syncModifiers(ModifierGroup $group, array $modifiers): void
    {
        $keptIds = [];

        foreach ($modifiers as $index => $payload) {
            $attributes = [
                'name' => $payload['name'],
                'additional_price' => $payload['additional_price'],
                'additional_cost' => $payload['additional_cost'] ?? 0,
                'is_active' => $payload['is_active'],
                'sort_order' => $payload['sort_order'] ?? $index,
            ];

            if (! empty($payload['id'])) {
                $modifier = Modifier::query()
                    ->where('modifier_group_id', $group->id)
                    ->whereKey($payload['id'])
                    ->first();

                if ($modifier) {
                    $modifier->update($attributes);
                    $keptIds[] = $modifier->id;

                    continue;
                }
            }

            $created = $group->modifiers()->create($attributes);
            $keptIds[] = $created->id;
        }

        $group->modifiers()->whereNotIn('id', $keptIds)->delete();
    }
}
