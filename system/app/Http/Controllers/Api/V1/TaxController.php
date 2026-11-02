<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertTaxRequest;
use App\Models\Tax;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaxController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $taxes = Tax::query()
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Taxes retrieved.', $taxes);
    }

    public function store(UpsertTaxRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $tax = DB::transaction(function () use ($request, $activityLogger): Tax {
            $tax = Tax::query()->create($request->validated() + ['is_inclusive' => false, 'is_active' => true]);
            $activityLogger->log($request, 'tax.created', 'settings', $tax, after: $tax->fresh()->toArray());

            return $tax;
        });

        return $this->success('Tax created.', $tax->fresh(), 201);
    }

    public function update(UpsertTaxRequest $request, Tax $tax, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $tax->toArray();
        DB::transaction(function () use ($request, $tax, $activityLogger, $before): void {
            $tax->update($request->validated());
            $activityLogger->log($request, 'tax.updated', 'settings', $tax, $before, $tax->fresh()->toArray());
        });

        return $this->success('Tax updated.', $tax->fresh());
    }

    public function destroy(Request $request, Tax $tax, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $tax->toArray();
        DB::transaction(function () use ($request, $tax, $activityLogger, $before): void {
            $activityLogger->log($request, 'tax.deleted', 'settings', $tax, $before);
            $tax->delete();
        });

        return $this->success('Tax deleted.');
    }
}
