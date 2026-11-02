<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertDiscountRequest;
use App\Models\Discount;
use App\Services\ActivityLogger;
use App\Services\DiscountService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiscountController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(Discount::TYPES)],
            'applies_to' => ['nullable', Rule::in(Discount::APPLIES_TO)],
            'is_active' => ['nullable', 'boolean'],
            'current' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $discounts = Discount::query()
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->filled('applies_to'), fn ($query) => $query->where('applies_to', $request->string('applies_to')->value()))
            ->when($request->has('is_active') && $request->input('is_active') !== '', fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->boolean('current'), fn ($query) => $query->current())
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Discounts retrieved.', $discounts);
    }

    public function store(UpsertDiscountRequest $request, DiscountService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $discount = $service->create($request->validated());
        $activityLogger->log($request, 'discount.created', 'promotions', $discount, after: $discount->toArray());

        return $this->success('Discount created.', $discount, 201);
    }

    public function show(Discount $discount): JsonResponse
    {
        return $this->success('Discount retrieved.', $discount);
    }

    public function update(UpsertDiscountRequest $request, Discount $discount, DiscountService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $discount->toArray();
        $updated = $service->update($discount, $request->validated());
        $activityLogger->log($request, 'discount.updated', 'promotions', $updated, $before, $updated->toArray());

        return $this->success('Discount updated.', $updated);
    }

    public function destroy(Request $request, Discount $discount, DiscountService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $discount->toArray();
        $service->delete($discount);
        $activityLogger->log($request, 'discount.deleted', 'promotions', $discount, $before, ['deleted' => true]);

        return $this->success('Discount deleted.');
    }
}
