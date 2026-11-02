<?php

namespace App\Services;

use App\Models\KitchenTicket;
use App\Models\KitchenTicketItem;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class KitchenService
{
    private const ACTIVE_STATUSES = ['new', 'accepted', 'preparing', 'ready'];

    private const HISTORY_STATUSES = ['completed', 'cancelled'];

    private const ITEM_STATUSES = ['pending', 'preparing', 'ready'];

    public function __construct(private readonly SettingsService $settings) {}

    /**
     * @return Collection<int, KitchenTicket>
     */
    public function activeTickets(): Collection
    {
        $tickets = KitchenTicket::query()
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->with([
                'order.table:id,name,table_number,status,area_id',
                'order.customer:id,name,phone',
                'order.creator:id,name',
                'items.orderItem.addons',
            ])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $warningMinutes = (int) $this->settings->get('kitchen.warning_minutes', 10);
        $delayMinutes = (int) $this->settings->get('kitchen.delay_minutes', 20);

        return $tickets->map(function (KitchenTicket $ticket) use ($warningMinutes, $delayMinutes): KitchenTicket {
            $this->decorateTicket($ticket, $warningMinutes, $delayMinutes);

            return $ticket;
        });
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function history(array $filters = []): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);

        $paginator = KitchenTicket::query()
            ->whereIn('status', self::HISTORY_STATUSES)
            ->with([
                'order.table:id,name,table_number,status',
                'order.customer:id,name,phone',
                'order.creator:id,name',
                'items.orderItem.addons',
            ])
            ->when(! empty($filters['search']), function ($query) use ($filters): void {
                $search = '%'.$filters['search'].'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('ticket_number', 'like', $search)
                        ->orWhereHas('order', fn ($order) => $order
                            ->where('order_number', 'like', $search)
                            ->orWhereHas('customer', fn ($customer) => $customer
                                ->where('name', 'like', $search)
                                ->orWhere('phone', 'like', $search)));
                });
            })
            ->when(! empty($filters['status']), fn ($query) => $query->where('status', $filters['status']))
            ->when(! empty($filters['date_from']), fn ($query) => $query->whereDate('completed_at', '>=', $filters['date_from']))
            ->when(! empty($filters['date_to']), fn ($query) => $query->whereDate('completed_at', '<=', $filters['date_to']))
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        $warningMinutes = (int) $this->settings->get('kitchen.warning_minutes', 10);
        $delayMinutes = (int) $this->settings->get('kitchen.delay_minutes', 20);

        $paginator->getCollection()->transform(function (KitchenTicket $ticket) use ($warningMinutes, $delayMinutes): KitchenTicket {
            $this->decorateTicket($ticket, $warningMinutes, $delayMinutes);

            return $ticket;
        });

        return $paginator;
    }

    public function findWithRelations(KitchenTicket $ticket): KitchenTicket
    {
        $ticket->load([
            'order.table:id,name,table_number,status,area_id',
            'order.customer:id,name,phone',
            'order.creator:id,name,email',
            'items.orderItem.addons',
        ]);

        $this->decorateTicket(
            $ticket,
            (int) $this->settings->get('kitchen.warning_minutes', 10),
            (int) $this->settings->get('kitchen.delay_minutes', 20),
        );

        return $ticket;
    }

    /**
     * @return array{
     *     warning_minutes: int,
     *     delay_minutes: int,
     *     sound_notification: bool,
     *     auto_refresh: int
     * }
     */
    public function displaySettings(): array
    {
        return [
            'enabled' => (bool) $this->settings->get('kitchen.enabled', true),
            'warning_minutes' => (int) $this->settings->get('kitchen.warning_minutes', 10),
            'delay_minutes' => (int) $this->settings->get('kitchen.delay_minutes', 20),
            'sound_notification' => (bool) $this->settings->get('kitchen.sound_notification', true),
            'auto_refresh' => (int) $this->settings->get('kitchen.auto_refresh', 10),
        ];
    }

    public function accept(KitchenTicket $ticket, User $user): KitchenTicket
    {
        $this->assertTicketStatus($ticket, ['new']);

        return DB::transaction(function () use ($ticket, $user): KitchenTicket {
            $ticket->update([
                'status' => 'accepted',
                'accepted_at' => now(),
            ]);

            $order = Order::query()->lockForUpdate()->findOrFail($ticket->order_id);
            if (in_array($order->status, ['pending', 'confirmed'], true)) {
                $this->bumpOrderStatus($order, 'preparing', $user, 'Kitchen ticket accepted');
            }

            return $this->findWithRelations($ticket->fresh());
        }, 3);
    }

    public function startPreparing(KitchenTicket $ticket, User $user): KitchenTicket
    {
        $this->assertTicketStatus($ticket, ['accepted']);

        return DB::transaction(function () use ($ticket): KitchenTicket {
            $ticket->update(['status' => 'preparing']);

            $ticket->items()
                ->where('status', 'pending')
                ->get()
                ->each(function (KitchenTicketItem $item): void {
                    $this->applyItemStatus($item, 'preparing');
                });

            return $this->findWithRelations($ticket->fresh());
        }, 3);
    }

    public function markReady(KitchenTicket $ticket, User $user): KitchenTicket
    {
        $this->assertTicketStatus($ticket, ['preparing', 'accepted']);

        return DB::transaction(function () use ($ticket, $user): KitchenTicket {
            return $this->markTicketReady($ticket, $user);
        }, 3);
    }

    public function complete(KitchenTicket $ticket, User $user): KitchenTicket
    {
        $this->assertTicketStatus($ticket, ['ready']);

        return DB::transaction(function () use ($ticket): KitchenTicket {
            $ticket->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            return $this->findWithRelations($ticket->fresh());
        }, 3);
    }

    public function bumpItem(KitchenTicketItem $item, string $status, User $user): KitchenTicketItem
    {
        $status = strtolower($status);

        if (! in_array($status, self::ITEM_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Item status must be pending, preparing, or ready.'],
            ]);
        }

        return DB::transaction(function () use ($item, $status, $user): KitchenTicketItem {
            $item = KitchenTicketItem::query()->lockForUpdate()->findOrFail($item->id);
            $ticket = KitchenTicket::query()->lockForUpdate()->findOrFail($item->kitchen_ticket_id);

            if (in_array($ticket->status, ['completed', 'cancelled'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot update items on a completed or cancelled ticket.'],
                ]);
            }

            $this->applyItemStatus($item, $status);

            if ($status === 'ready') {
                $pending = $ticket->items()->where('status', '!=', 'ready')->exists();
                if (! $pending && in_array($ticket->status, ['new', 'accepted', 'preparing'], true)) {
                    if ($ticket->status === 'new') {
                        $ticket->update([
                            'status' => 'accepted',
                            'accepted_at' => $ticket->accepted_at ?? now(),
                        ]);
                        $ticket->refresh();
                    }
                    $this->markTicketReady($ticket->fresh(), $user);
                }
            }

            return $item->fresh(['orderItem.addons', 'ticket']);
        }, 3);
    }

    private function markTicketReady(KitchenTicket $ticket, User $user): KitchenTicket
    {
        $ticket->update([
            'status' => 'ready',
            'ready_at' => now(),
            'accepted_at' => $ticket->accepted_at ?? now(),
        ]);

        $ticket->items()->get()->each(function (KitchenTicketItem $item): void {
            $this->applyItemStatus($item, 'ready');
        });

        $order = Order::query()->lockForUpdate()->findOrFail($ticket->order_id);
        if (! in_array($order->status, ['ready', 'served', 'out_for_delivery', 'completed', 'cancelled', 'refunded', 'partially_refunded'], true)) {
            $this->bumpOrderStatus($order, 'ready', $user, 'Kitchen ticket ready');
        }

        return $this->findWithRelations($ticket->fresh());
    }

    private function applyItemStatus(KitchenTicketItem $item, string $status): void
    {
        $item->update(['status' => $status]);

        if ($item->order_item_id) {
            $item->orderItem()?->update(['kitchen_status' => $status]);
        }
    }

    private function bumpOrderStatus(Order $order, string $to, User $user, string $notes): void
    {
        $from = $order->status;
        if ($from === $to) {
            return;
        }

        $order->update(['status' => $to]);

        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => $notes,
        ]);
    }

    /**
     * @param  list<string>  $allowed
     */
    private function assertTicketStatus(KitchenTicket $ticket, array $allowed): void
    {
        if (! in_array($ticket->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => [
                    sprintf(
                        'Ticket must be %s (current: %s).',
                        implode(' or ', $allowed),
                        $ticket->status
                    ),
                ],
            ]);
        }
    }

    private function decorateTicket(KitchenTicket $ticket, int $warningMinutes, int $delayMinutes): void
    {
        $reference = $ticket->accepted_at ?? $ticket->created_at;
        $elapsedSeconds = max(0, (int) $reference->diffInSeconds(now()));

        $warningSeconds = max(0, $warningMinutes) * 60;
        $delaySeconds = max(0, $delayMinutes) * 60;

        $alertLevel = 'normal';
        if ($delaySeconds > 0 && $elapsedSeconds >= $delaySeconds) {
            $alertLevel = 'delayed';
        } elseif ($warningSeconds > 0 && $elapsedSeconds >= $warningSeconds) {
            $alertLevel = 'warning';
        }

        $ticket->setAttribute('elapsed_seconds', $elapsedSeconds);
        $ticket->setAttribute('alert_level', $alertLevel);
    }
}
