<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertChargeRequest;
use App\Models\Charge;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChargeController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'apply_to' => ['nullable', 'in:'.implode(',', UpsertChargeRequest::APPLY_TO)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $charges = Charge::query()
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('code', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('apply_to'), fn ($query) => $query->where('apply_to', $request->string('apply_to')->value()))
            ->orderBy('name')->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Charges retrieved.', $charges);
    }

    public function store(UpsertChargeRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $charge = DB::transaction(function () use ($request, $activityLogger): Charge {
            $data = $this->normalize($request->validated());
            $charge = Charge::query()->create($data + ['apply_to' => 'all', 'is_active' => true]);
            $activityLogger->log($request, 'charge.created', 'settings', $charge, after: $charge->fresh()->toArray());

            return $charge;
        });

        return $this->success('Charge created.', $charge->fresh(), 201);
    }

    public function update(UpsertChargeRequest $request, Charge $charge, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $charge->toArray();
        DB::transaction(function () use ($request, $charge, $activityLogger, $before): void {
            $charge->update($this->normalize($request->validated()));
            $activityLogger->log($request, 'charge.updated', 'settings', $charge, $before, $charge->fresh()->toArray());
        });

        return $this->success('Charge updated.', $charge->fresh());
    }

    public function destroy(Request $request, Charge $charge, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $charge->toArray();
        DB::transaction(function () use ($request, $charge, $activityLogger, $before): void {
            $activityLogger->log($request, 'charge.deleted', 'settings', $charge, $before);
            $charge->delete();
        });

        return $this->success('Charge deleted.');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data): array
    {
        if (isset($data['code'])) {
            $data['code'] = strtolower($data['code']);
        }
        if (($data['type'] ?? null) === 'percentage') {
            $data['type'] = 'percent';
        }

        return $data;
    }
}
