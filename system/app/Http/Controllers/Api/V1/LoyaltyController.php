<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustLoyaltyRequest;
use App\Models\LoyaltyTransaction;
use App\Services\ActivityLogger;
use App\Services\LoyaltyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoyaltyController extends Controller
{
    use ApiResponse;

    public function transactions(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'type' => ['nullable', Rule::in(LoyaltyTransaction::TYPES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = LoyaltyTransaction::query()
            ->with(['customer:id,name,phone,customer_code,loyalty_points', 'creator:id,name'])
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->value()))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('created_at', '<=', $request->date('to')))
            ->latest('created_at')->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Loyalty transactions retrieved.', $transactions);
    }

    public function adjust(AdjustLoyaltyRequest $request, LoyaltyService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $result = $service->adjust(
            $request->user(),
            $request->integer('customer_id'),
            $request->integer('points'),
            $request->input('notes'),
        );

        $activityLogger->log($request, 'loyalty.adjusted', 'promotions', $result['transaction'], after: [
            'customer_id' => $result['customer']->id,
            'points' => $result['transaction']->points,
            'balance_after' => $result['transaction']->balance_after,
            'notes' => $result['transaction']->notes,
        ]);

        return $this->success('Loyalty points adjusted.', [
            'transaction' => $result['transaction'],
            'customer' => [
                'id' => $result['customer']->id,
                'name' => $result['customer']->name,
                'loyalty_points' => $result['customer']->loyalty_points,
            ],
        ], 201);
    }
}
