<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealItem;
use Illuminate\Database\Eloquent\Collection;

class DealService
{
    /**
     * Active deals whose every product can currently be sold, with the deal price split per component.
     *
     * @return Collection<int, Deal>
     */
    public function sellable(): Collection
    {
        return Deal::query()
            ->where('is_active', true)
            ->with(['items.dish', 'items.variant'])
            ->orderBy('name')
            ->get()
            ->filter(fn (Deal $deal): bool => $this->isSellable($deal))
            ->values();
    }

    public function isSellable(Deal $deal): bool
    {
        return $deal->is_active
            && $deal->items->isNotEmpty()
            && $deal->items->every(fn (DealItem $item): bool => $item->dish
                && $item->dish->is_active
                && $item->dish->is_available
                && (! $item->dish_variant_id || ($item->variant && $item->variant->is_active)));
    }

    /**
     * Split one unit of the deal price across its components, weighted by each component's regular price.
     * The last component absorbs rounding so the shares always add up to the deal price exactly.
     *
     * @return list<array{item: DealItem, share_cents: int}>
     */
    public function allocate(Deal $deal): array
    {
        $dealCents = $this->toCents($deal->price);
        $regular = $deal->items->map(fn (DealItem $item): int => $this->toCents($item->variant?->price ?? $item->dish?->base_price ?? 0) * $item->quantity);
        $regularTotal = $regular->sum();
        $count = $deal->items->count();

        $shares = [];
        $allocated = 0;
        foreach ($deal->items->values() as $index => $item) {
            if ($index === $count - 1) {
                $share = $dealCents - $allocated;
            } elseif ($regularTotal > 0) {
                $share = (int) round($dealCents * $regular[$index] / $regularTotal);
            } else {
                $share = intdiv($dealCents, $count);
            }
            $allocated += $share;
            $shares[] = ['item' => $item, 'share_cents' => $share];
        }

        return $shares;
    }

    /** @return array<string, mixed> */
    public function toCatalog(Deal $deal): array
    {
        return [
            'id' => $deal->id,
            'name' => $deal->name,
            'description' => $deal->description,
            'price' => $deal->price,
            'regular_price' => $deal->regular_price,
            'components' => collect($this->allocate($deal))->map(fn (array $row): array => [
                'dish_id' => $row['item']->dish_id,
                'dish_name' => $row['item']->dish->name,
                'variant_name' => $row['item']->variant?->name,
                'quantity' => $row['item']->quantity,
                'share_cents' => $row['share_cents'],
                'tax_percent' => (float) $row['item']->dish->tax_percent,
                'image' => $row['item']->dish->image,
            ])->all(),
        ];
    }

    private function toCents(int|float|string|null $amount): int
    {
        return (int) round((float) $amount * 100);
    }
}
