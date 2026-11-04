<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Services\SettingsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'order_type' => ['nullable', 'in:dine_in,takeaway,delivery'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sales = Sale::query()
            ->with([
                'cashier:id,name',
                'customer:id,name,phone',
                'table:id,name,table_number',
            ])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('invoice_number', 'like', $search)
                    ->orWhere('notes', 'like', $search));
            })
            ->when($request->filled('order_type'), fn ($query) => $query->where('order_type', $request->string('order_type')->value()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('sold_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('sold_at', '<=', $request->date('date_to')))
            ->orderByDesc('sold_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Sales retrieved.', $sales);
    }

    public function show(Sale $sale): JsonResponse
    {
        $sale->load([
            'items.addons',
            'payments.method',
            'order',
            'cashier:id,name,email',
            'customer',
            'table',
        ]);

        $meta = $sale->posMeta();
        $sale->setAttribute('notes', $sale->displayNotes()); // in-memory only; hides the structured suffix

        return $this->success('Sale retrieved.', [...$sale->toArray(), ...$meta]);
    }

    public function receipt(Sale $sale, SettingsService $settings): JsonResponse
    {
        $sale->load([
            'items.addons',
            'payments.method',
            'order:id,order_number,status,payment_status,created_by,delivery_address,notes',
            'order.creator:id,name',
            'cashier:id,name',
            'customer:id,name,phone,address,city',
            'table:id,name,table_number',
        ]);

        $meta = $sale->posMeta();
        $displayNotes = $sale->displayNotes();
        $sale->setAttribute('notes', $displayNotes); // in-memory only; hides the structured suffix

        $paper = (string) $settings->get('receipt.paper_size', '80mm');
        if (! in_array($paper, ['58mm', '80mm', 'A4'], true)) {
            $paper = '80mm';
        }

        $logo = (string) $settings->get('restaurant.logo', '');
        $showLogo = (bool) $settings->get('receipt.show_logo', true);

        return $this->success('Sale receipt retrieved.', [
            'restaurant' => [
                'name' => (string) $settings->get('restaurant.name', 'AFC'),
                'tagline' => (string) $settings->get('restaurant.tagline', ''),
                'address' => (string) $settings->get('restaurant.address', ''),
                'phone' => (string) $settings->get('restaurant.phone', ''),
                'email' => (string) $settings->get('restaurant.email', ''),
                'website' => (string) $settings->get('restaurant.website', ''),
                'tax_number' => (string) $settings->get('restaurant.tax_number', ''),
                'logo' => ($showLogo && $logo !== '') ? $logo : null,
                'header' => (string) $settings->get('receipt.header', ''),
                'footer' => (string) $settings->get('receipt.footer', 'Thank you for dining with us.'),
            ],
            'options' => [
                'paper_size' => $paper,
                'show_logo' => $showLogo,
                'show_tax' => (bool) $settings->get('receipt.show_tax', true),
                'show_cashier' => (bool) $settings->get('receipt.show_cashier', true),
                'show_customer' => (bool) $settings->get('receipt.show_customer', true),
                'show_review_qr' => (bool) $settings->get('receipt.show_review_qr', false),
                'google_review_url' => (string) $settings->get('receipt.google_review_url', ''),
                'website_review_url' => (string) $settings->get('receipt.website_review_url', $settings->get('restaurant.website', '')),
            ],
            'currency' => [
                'code' => (string) $settings->get('currency.code', 'PKR'),
                'symbol' => (string) $settings->get('currency.symbol', 'Rs.'),
                'position' => (string) $settings->get('currency.position', 'before'),
            ],
            'sale' => $sale,
            'invoice_number' => $sale->invoice_number,
            'order_number' => $sale->order?->order_number,
            'sold_at' => $sale->sold_at,
            'order_type' => $sale->order_type,
            'payment_status' => $sale->order?->payment_status,
            'cashier' => $sale->cashier,
            'waiter' => $sale->order?->creator,
            'customer' => $sale->customer,
            'table' => $sale->table,
            'delivery_address' => $sale->order?->delivery_address ?: $sale->customer?->address,
            'items' => $sale->items,
            'payments' => $sale->payments,
            'totals' => [
                'subtotal' => $sale->subtotal,
                'discount_total' => $sale->discount_total,
                'tax_total' => $sale->tax_total,
                'service_charge' => $sale->service_charge,
                'delivery_charge' => $sale->delivery_charge,
                'grand_total' => $sale->grand_total,
                'paid_total' => $sale->paid_total,
                'change_total' => $sale->change_total,
            ],
            'notes' => $displayNotes,
            ...$meta,
        ]);
    }
}
