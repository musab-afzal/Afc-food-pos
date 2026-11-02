<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertCustomerGroupRequest;
use App\Models\CustomerGroup;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerGroupController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,discount_percent,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $groups = CustomerGroup::query()
            ->withCount('customers')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('description', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Customer groups retrieved.', $groups);
    }

    public function store(UpsertCustomerGroupRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $group = DB::transaction(function () use ($request, $activityLogger): CustomerGroup {
            $data = $request->validated();
            $data['discount_percent'] = $data['discount_percent'] ?? 0;

            $group = CustomerGroup::query()->create($data);
            $activityLogger->log($request, 'customer_group.created', 'customers', $group, after: $group->toArray());

            return $group;
        });

        return $this->success('Customer group created.', $group->loadCount('customers'), 201);
    }

    public function show(CustomerGroup $customerGroup): JsonResponse
    {
        return $this->success('Customer group retrieved.', $customerGroup->loadCount('customers'));
    }

    public function update(UpsertCustomerGroupRequest $request, CustomerGroup $customerGroup, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $customerGroup->toArray();
        DB::transaction(function () use ($request, $customerGroup, $activityLogger, $before): void {
            $customerGroup->update($request->validated());
            $activityLogger->log($request, 'customer_group.updated', 'customers', $customerGroup, $before, $customerGroup->fresh()->toArray());
        });

        return $this->success('Customer group updated.', $customerGroup->fresh()->loadCount('customers'));
    }

    public function destroy(Request $request, CustomerGroup $customerGroup, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('customers.edit')) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        $before = $customerGroup->toArray();
        DB::transaction(function () use ($request, $customerGroup, $activityLogger, $before): void {
            $customerGroup->update(['is_active' => false]);
            $activityLogger->log($request, 'customer_group.archived', 'customers', $customerGroup, $before, $customerGroup->fresh()->toArray());
        });

        return $this->success('Customer group archived.', $customerGroup->fresh());
    }
}
