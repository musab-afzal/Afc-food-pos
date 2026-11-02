<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertCouponRequest;
use App\Http\Requests\ValidateCouponRequest;
use App\Models\Coupon;
use App\Services\ActivityLogger;
use App\Services\CouponService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(Coupon::TYPES)],
            'is_active' => ['nullable', 'boolean'],
            'current' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $coupons = Coupon::query()
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested->where('code', 'like', $search)->orWhere('name', 'like', $search));
            })
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->has('is_active') && $request->input('is_active') !== '', fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->boolean('current'), fn ($query) => $query->current())
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Coupons retrieved.', $coupons);
    }

    public function store(UpsertCouponRequest $request, CouponService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $coupon = $service->create($request->validated());
        $activityLogger->log($request, 'coupon.created', 'promotions', $coupon, after: $coupon->toArray());

        return $this->success('Coupon created.', $coupon, 201);
    }

    public function show(Coupon $coupon): JsonResponse
    {
        return $this->success('Coupon retrieved.', $coupon);
    }

    public function update(UpsertCouponRequest $request, Coupon $coupon, CouponService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $coupon->toArray();
        $updated = $service->update($coupon, $request->validated());
        $activityLogger->log($request, 'coupon.updated', 'promotions', $updated, $before, $updated->toArray());

        return $this->success('Coupon updated.', $updated);
    }

    public function destroy(Request $request, Coupon $coupon, CouponService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $coupon->toArray();
        $service->delete($coupon);
        $activityLogger->log($request, 'coupon.deleted', 'promotions', $coupon, $before, ['deleted' => true]);

        return $this->success('Coupon deleted.');
    }

    public function validateCode(ValidateCouponRequest $request, CouponService $service): JsonResponse
    {
        $result = $service->validate(
            $request->string('code')->value(),
            $request->input('order_total'),
            $request->filled('customer_id') ? $request->integer('customer_id') : null,
        );

        return $this->success('Coupon is valid.', $result);
    }
}
