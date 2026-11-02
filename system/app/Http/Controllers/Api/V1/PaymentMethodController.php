<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertPaymentMethodRequest;
use App\Models\PaymentMethod;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentMethodController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate(['is_active' => ['nullable', 'boolean']]);

        $methods = PaymentMethod::query()
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return $this->success('Payment methods retrieved.', $methods);
    }

    public function store(UpsertPaymentMethodRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $data['code'] = strtolower($data['code']);
        $method = PaymentMethod::query()->create($data + [
            'is_active' => true, 'requires_reference' => false, 'works_offline' => false,
            'sort_order' => (int) PaymentMethod::query()->max('sort_order') + 1,
        ]);
        $activityLogger->log($request, 'payment_method.created', 'finance', $method, after: $method->toArray());

        return $this->success('Payment method created.', $method, 201);
    }

    public function update(UpsertPaymentMethodRequest $request, PaymentMethod $paymentMethod, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        if (isset($data['code'])) {
            $data['code'] = strtolower($data['code']);
        }

        // Finance and POS flows identify the cash drawer method by its code.
        if ($paymentMethod->code === 'cash' && (isset($data['code']) && $data['code'] !== 'cash' || (array_key_exists('is_active', $data) && ! $data['is_active']))) {
            return $this->error('The cash payment method cannot be renamed or deactivated.', 422);
        }

        $before = $paymentMethod->toArray();
        $paymentMethod->update($data);
        $activityLogger->log($request, 'payment_method.updated', 'finance', $paymentMethod, $before, $paymentMethod->fresh()->toArray());

        return $this->success('Payment method updated.', $paymentMethod->fresh());
    }
}
