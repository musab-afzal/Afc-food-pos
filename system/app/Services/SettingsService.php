<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    private const CACHE_KEY = 'restaurant_settings';

    private const CACHE_TTL = 3600;

    public function get(string $key, mixed $default = null): mixed
    {
        $setting = $this->all()->firstWhere('key', $key);

        if (! $setting) {
            return $default;
        }

        return $this->castValue($setting['value'], $setting['type'] ?? 'string');
    }

    /** Order number prefix from `order.prefix` (default ORD), stripped of whitespace and trailing dashes. */
    public function orderPrefix(): string
    {
        $prefix = trim((string) $this->get('order.prefix', 'ORD'), " \t-");

        return $prefix !== '' ? $prefix : 'ORD';
    }

    /** Invoice number prefix from `order.invoice_prefix` (default INV), stripped of whitespace and trailing dashes. */
    public function invoicePrefix(): string
    {
        $prefix = trim((string) $this->get('order.invoice_prefix', 'INV'), " \t-");

        return $prefix !== '' ? $prefix : 'INV';
    }

    /**
     * Daily order number that resets to 01 each calendar day.
     * Format: ORD-20261105-01 (prefix-YYYYMMDD-sequence). Invoice numbers stay continuous.
     * $id is unused but kept for call-site compatibility.
     */
    public function formatOrderNumber(int $id = 0): string
    {
        return $this->allocateDailyOrderNumber();
    }

    /** Allocate the next order number for today (starts at 01 every day). Call inside a DB transaction. */
    public function allocateDailyOrderNumber(): string
    {
        $prefix = $this->orderPrefix();
        $dateKey = now()->format('Ymd');
        $like = $prefix.'-'.$dateKey.'-%';

        $latest = Order::query()
            ->where('order_number', 'like', $like)
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('order_number');

        $sequence = 1;
        if (is_string($latest) && preg_match('/-(\d+)$/', $latest, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return sprintf('%s-%s-%02d', $prefix, $dateKey, $sequence);
    }

    /** Continuous invoice number from sale id: INV-01, INV-12, INV-100. */
    public function formatInvoiceNumber(int $id): string
    {
        return sprintf('%s-%02d', $this->invoicePrefix(), $id);
    }

    /** Kitchen tickets are only created when the kitchen is enabled and orders auto-send to it. */
    public function kitchenAutoSendEnabled(): bool
    {
        return (bool) $this->get('kitchen.enabled', true) && (bool) $this->get('order.auto_kitchen_send', true);
    }

    /**
     * @return array<string, mixed>
     */
    public function getGroup(string $group): array
    {
        return $this->all()
            ->where('group', $group)
            ->mapWithKeys(fn (array $row) => [$row['key'] => $this->castValue($row['value'], $row['type'] ?? 'string')])
            ->all();
    }

    public function set(string $key, mixed $value, string $type = 'string', string $group = 'general'): Setting
    {
        $setting = Setting::query()->updateOrCreate(
            ['key' => $key],
            [
                'value' => is_array($value) || is_object($value) ? json_encode($value) : (string) $value,
                'type' => $type,
                'group' => $group,
            ],
        );

        $this->forgetCache();

        return $setting;
    }

    /**
     * @param  array<int, array{key: string, value: mixed, type?: string, group?: string}>  $items
     */
    public function setMany(array $items): void
    {
        foreach ($items as $item) {
            $this->set(
                $item['key'],
                $item['value'],
                $item['type'] ?? 'string',
                $item['group'] ?? 'general',
            );
        }
    }

    /**
     * @return Collection<int, array{key: string, value: mixed, type: string, group: string}>
     */
    public function all(): Collection
    {
        /** @var list<array{key: string, value: mixed, type: string, group: string}> $rows */
        $rows = Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function (): array {
            return Setting::query()
                ->get(['key', 'value', 'type', 'group'])
                ->map(fn (Setting $setting) => [
                    'key' => $setting->key,
                    'value' => $setting->value,
                    'type' => $setting->type,
                    'group' => $setting->group,
                ])
                ->values()
                ->all();
        });

        return collect($rows);
    }

    public function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function castValue(mixed $value, string $type): mixed
    {
        return match ($type) {
            'boolean', 'bool' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer', 'int' => (int) $value,
            'float', 'double', 'decimal' => (float) $value,
            'json', 'array' => is_string($value) ? json_decode($value, true) : $value,
            default => $value,
        };
    }
}
