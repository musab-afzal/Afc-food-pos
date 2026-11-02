<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListRiderSettlementsRequest;
use App\Http\Requests\PreviewRiderSettlementRequest;
use App\Http\Requests\SettleRiderSettlementRequest;
use App\Http\Requests\StoreRiderSettlementRequest;
use App\Models\RiderSettlement;
use App\Services\ActivityLogger;
use App\Services\RiderSettlementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiderSettlementController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RiderSettlementService $settlements) {}

    public function index(ListRiderSettlementsRequest $request): JsonResponse
    {
        $paginator = $this->settlements->list($request->validated());

        return $this->paginated('Rider settlements retrieved.', $paginator);
    }

    public function preview(PreviewRiderSettlementRequest $request): JsonResponse
    {
        $data = $request->validated();

        return $this->success('Rider settlement preview retrieved.', $this->settlements->preview(
            (int) $data['rider_id'],
            $data['period_start'],
            $data['period_end'],
        ));
    }

    public function show(RiderSettlement $riderSettlement): JsonResponse
    {
        return $this->success('Rider settlement retrieved.', $this->settlements->find($riderSettlement));
    }

    public function store(StoreRiderSettlementRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $settlement = $this->settlements->create($request->user(), $request->validated());

        $activityLogger->log($request, 'rider_settlement.created', 'rider_settlements', $settlement, after: $this->snapshot($settlement));

        return $this->success('Rider settlement created.', $settlement, 201);
    }

    public function settle(SettleRiderSettlementRequest $request, RiderSettlement $riderSettlement, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $this->snapshot($riderSettlement);
        $paid = $request->validated('paid_to_restaurant');

        $settlement = $this->settlements->settle($riderSettlement, $paid !== null ? (float) $paid : null);

        $activityLogger->log($request, 'rider_settlement.settled', 'rider_settlements', $settlement, $before, $this->snapshot($settlement));

        return $this->success('Rider settlement settled.', $settlement);
    }

    public function cancel(Request $request, RiderSettlement $riderSettlement, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $this->snapshot($riderSettlement);

        $settlement = $this->settlements->cancel($riderSettlement);

        $activityLogger->log($request, 'rider_settlement.cancelled', 'rider_settlements', $settlement, $before, $this->snapshot($settlement));

        return $this->success('Rider settlement cancelled.', $settlement);
    }

    /** @return array<string, mixed> */
    private function snapshot(RiderSettlement $s): array
    {
        return [
            'settlement_number' => $s->settlement_number,
            'rider_id' => $s->rider_id,
            'period_start' => $s->period_start?->toDateString(),
            'period_end' => $s->period_end?->toDateString(),
            'total_cod' => $s->total_cod,
            'commission' => $s->commission,
            'paid_to_restaurant' => $s->paid_to_restaurant,
            'balance' => $s->balance,
            'status' => $s->status,
        ];
    }
}
