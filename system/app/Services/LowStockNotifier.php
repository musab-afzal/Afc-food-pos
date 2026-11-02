<?php

namespace App\Services;

use App\Models\InventoryItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Raises a "Low stock" notification when an item's stock crosses from above its reorder level to at/below it.
 *
 * Dedupe: only the crossing (before > reorder >= after) fires, so an item that stays low never re-notifies
 * until it is replenished above the reorder level and drops again. Dispatch is deferred until the surrounding
 * DB transaction commits (discarded on rollback) and is failure-tolerant.
 */
class LowStockNotifier
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly NotificationService $notifications,
    ) {}

    public function check(InventoryItem $item, float $before, float $after): void
    {
        if ($after >= $before || ! $this->enabled()) {
            return;
        }

        $reorder = (float) $item->reorder_level;
        if (! ($before > $reorder && $after <= $reorder)) {
            return;
        }

        $itemId = $item->id;
        $name = $item->name;
        $unit = $item->unit;

        DB::afterCommit(function () use ($itemId, $name, $unit, $after, $reorder): void {
            try {
                $this->notifications->tryNotifyPermission(
                    ['inventory.view', 'inventory.adjust'],
                    'low_stock',
                    "Low stock: {$name}",
                    sprintf(
                        '%s is down to %s %s (reorder level %s).',
                        $name,
                        rtrim(rtrim(number_format($after, 4, '.', ''), '0'), '.') ?: '0',
                        $unit,
                        rtrim(rtrim(number_format($reorder, 4, '.', ''), '0'), '.') ?: '0',
                    ),
                    '/inventory/stock?filter=low',
                );
            } catch (\Throwable $e) {
                Log::warning("Low stock notification failed for item {$itemId}: ".$e->getMessage());
            }
        });
    }

    private function enabled(): bool
    {
        return (bool) $this->settings->get('inventory.low_stock_notification', true)
            && (bool) $this->settings->get('system.low_stock_threshold_notify', true);
    }
}
