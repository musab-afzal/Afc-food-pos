<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertRiderRequest;
use App\Models\Rider;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiderController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:available,busy,offline'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $riders = Rider::query()
            ->with('staff:id,employee_id,user_id,first_name,last_name')
            ->withCount([
                'deliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['assigned', 'picked_up', 'on_the_way']),
            ])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('phone', 'like', $search)
                    ->orWhere('vehicle_number', 'like', $search));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Riders retrieved.', $riders);
    }

    public function store(UpsertRiderRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $data['status'] = $data['status'] ?? 'available';
        $data['is_active'] = $data['is_active'] ?? true;

        $rider = Rider::query()->create($data);
        $activityLogger->log($request, 'rider.created', 'riders', $rider, after: $rider->toArray());

        return $this->success('Rider created.', $rider->load('staff:id,employee_id,user_id,first_name,last_name'), 201);
    }

    public function show(Rider $rider): JsonResponse
    {
        $rider->load('staff:id,employee_id,user_id,first_name,last_name')
            ->loadCount([
                'deliveries',
                'deliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['assigned', 'picked_up', 'on_the_way']),
                'deliveries as completed_deliveries_count' => fn ($query) => $query->where('status', 'delivered'),
            ]);

        return $this->success('Rider retrieved.', $rider);
    }

    public function update(UpsertRiderRequest $request, Rider $rider, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $rider->toArray();
        $rider->update($request->validated());
        $activityLogger->log($request, 'rider.updated', 'riders', $rider, $before, $rider->fresh()->toArray());

        return $this->success('Rider updated.', $rider->fresh()->load('staff:id,employee_id,user_id,first_name,last_name'));
    }

    public function destroy(Request $request, Rider $rider, ActivityLogger $activityLogger): JsonResponse
    {
        $active = $rider->deliveries()
            ->whereIn('status', ['assigned', 'picked_up', 'on_the_way'])
            ->exists();

        if ($active) {
            return $this->error('Cannot archive a rider with active deliveries.', 422);
        }

        $before = $rider->toArray();
        $rider->update(['is_active' => false, 'status' => 'offline']);
        $rider->delete();
        $activityLogger->log($request, 'rider.deleted', 'riders', $rider, $before, ['deleted' => true]);

        return $this->success('Rider archived.');
    }
}
