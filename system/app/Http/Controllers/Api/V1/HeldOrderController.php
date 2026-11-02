<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHeldOrderRequest;
use App\Models\HeldOrder;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HeldOrderController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user->roles()->whereIn('slug', ['super_admin', 'admin', 'manager'])->exists();

        $holds = HeldOrder::query()
            ->with(['cashier:id,name', 'table:id,name,table_number'])
            ->when(! $isAdmin, fn ($query) => $query->where('cashier_id', $user->id))
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get();

        return $this->success('Held orders retrieved.', $holds);
    }

    public function store(StoreHeldOrderRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();

        $held = DB::transaction(function () use ($request, $data, $activityLogger): HeldOrder {
            $existing = HeldOrder::query()->where('uuid', $data['uuid'])->first();
            if ($existing) {
                throw ValidationException::withMessages(['uuid' => ['A held order with this UUID already exists.']]);
            }

            $held = HeldOrder::query()->create([
                'uuid' => $data['uuid'],
                'cashier_id' => $request->user()->id,
                'payload' => $data['payload'],
                'order_type' => $data['order_type'],
                'restaurant_table_id' => $data['restaurant_table_id'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $activityLogger->log($request, 'held_order.created', 'pos', $held, after: [
                'uuid' => $held->uuid,
                'order_type' => $held->order_type,
            ]);

            return $held;
        });

        return $this->success('Held order saved.', $held->load(['cashier:id,name', 'table:id,name,table_number']), 201);
    }

    public function show(Request $request, HeldOrder $heldOrder): JsonResponse
    {
        $this->authorizeHoldAccess($request, $heldOrder);
        $heldOrder->load(['cashier:id,name', 'table:id,name,table_number']);

        return $this->success('Held order retrieved.', $heldOrder);
    }

    public function update(StoreHeldOrderRequest $request, HeldOrder $heldOrder, ActivityLogger $activityLogger): JsonResponse
    {
        $this->authorizeHoldAccess($request, $heldOrder);
        $data = $request->validated();
        $before = $heldOrder->only(['payload', 'order_type', 'restaurant_table_id', 'notes']);

        DB::transaction(function () use ($request, $heldOrder, $data, $activityLogger, $before): void {
            $heldOrder->update([
                'payload' => $data['payload'],
                'order_type' => $data['order_type'],
                'restaurant_table_id' => $data['restaurant_table_id'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $activityLogger->log($request, 'held_order.updated', 'pos', $heldOrder, $before, $heldOrder->fresh()->only([
                'payload', 'order_type', 'restaurant_table_id', 'notes',
            ]));
        });

        return $this->success('Held order updated.', $heldOrder->fresh()->load(['cashier:id,name', 'table:id,name,table_number']));
    }

    public function destroy(Request $request, HeldOrder $heldOrder, ActivityLogger $activityLogger): JsonResponse
    {
        $this->authorizeHoldAccess($request, $heldOrder);
        $before = $heldOrder->toArray();

        DB::transaction(function () use ($request, $heldOrder, $activityLogger, $before): void {
            $heldOrder->delete();
            $activityLogger->log($request, 'held_order.deleted', 'pos', $heldOrder, $before, ['deleted' => true]);
        });

        return $this->success('Held order deleted.');
    }

    private function authorizeHoldAccess(Request $request, HeldOrder $heldOrder): void
    {
        $user = $request->user();
        $isAdmin = $user->roles()->whereIn('slug', ['super_admin', 'admin', 'manager'])->exists();

        if (! $isAdmin && (int) $heldOrder->cashier_id !== (int) $user->id) {
            abort(403, 'You cannot access this held order.');
        }
    }
}
