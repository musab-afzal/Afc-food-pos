<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateKitchenItemStatusRequest;
use App\Models\KitchenTicket;
use App\Models\KitchenTicketItem;
use App\Services\ActivityLogger;
use App\Services\KitchenService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KitchenController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly KitchenService $kitchen) {}

    public function index(): JsonResponse
    {
        return $this->success('Kitchen tickets retrieved.', $this->kitchen->activeTickets());
    }

    public function history(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:completed,cancelled'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $this->kitchen->history($request->only([
            'search', 'status', 'date_from', 'date_to', 'per_page',
        ]));

        return $this->paginated('Kitchen ticket history retrieved.', $paginator);
    }

    public function show(KitchenTicket $kitchenTicket): JsonResponse
    {
        return $this->success('Kitchen ticket retrieved.', $this->kitchen->findWithRelations($kitchenTicket));
    }

    public function accept(Request $request, KitchenTicket $kitchenTicket, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $kitchenTicket->status];
        $ticket = $this->kitchen->accept($kitchenTicket, $request->user());
        $activityLogger->log($request, 'kitchen.accepted', 'kitchen', $ticket, $before, [
            'status' => $ticket->status,
            'accepted_at' => $ticket->accepted_at,
        ]);

        return $this->success('Kitchen ticket accepted.', $ticket);
    }

    public function preparing(Request $request, KitchenTicket $kitchenTicket, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $kitchenTicket->status];
        $ticket = $this->kitchen->startPreparing($kitchenTicket, $request->user());
        $activityLogger->log($request, 'kitchen.preparing', 'kitchen', $ticket, $before, [
            'status' => $ticket->status,
        ]);

        return $this->success('Kitchen ticket preparing.', $ticket);
    }

    public function ready(Request $request, KitchenTicket $kitchenTicket, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $kitchenTicket->status];
        $ticket = $this->kitchen->markReady($kitchenTicket, $request->user());
        $activityLogger->log($request, 'kitchen.ready', 'kitchen', $ticket, $before, [
            'status' => $ticket->status,
            'ready_at' => $ticket->ready_at,
        ]);

        return $this->success('Kitchen ticket ready.', $ticket);
    }

    public function complete(Request $request, KitchenTicket $kitchenTicket, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $kitchenTicket->status];
        $ticket = $this->kitchen->complete($kitchenTicket, $request->user());
        $activityLogger->log($request, 'kitchen.completed', 'kitchen', $ticket, $before, [
            'status' => $ticket->status,
            'completed_at' => $ticket->completed_at,
        ]);

        return $this->success('Kitchen ticket completed.', $ticket);
    }

    public function updateItemStatus(
        UpdateKitchenItemStatusRequest $request,
        KitchenTicketItem $kitchenTicketItem,
        ActivityLogger $activityLogger,
    ): JsonResponse {
        $before = ['status' => $kitchenTicketItem->status];
        $item = $this->kitchen->bumpItem(
            $kitchenTicketItem,
            $request->string('status')->value(),
            $request->user(),
        );
        $activityLogger->log($request, 'kitchen.item_status_updated', 'kitchen', $item, $before, [
            'status' => $item->status,
            'kitchen_ticket_id' => $item->kitchen_ticket_id,
        ]);

        return $this->success('Kitchen item status updated.', $item);
    }

    public function settings(): JsonResponse
    {
        return $this->success('Kitchen settings retrieved.', $this->kitchen->displaySettings());
    }
}
