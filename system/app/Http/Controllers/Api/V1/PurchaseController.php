<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReceivePurchaseRequest;
use App\Http\Requests\UpsertPurchaseRequest;
use App\Models\Purchase;
use App\Services\ActivityLogger;
use App\Services\PurchaseService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:30'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $purchases = Purchase::query()
            ->with(['supplier:id,name,phone', 'user:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('purchase_number', 'like', $search)
                    ->orWhere('invoice_reference', 'like', $search));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('supplier_id'), fn ($query) => $query->where('supplier_id', $request->integer('supplier_id')))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('purchase_date', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('purchase_date', '<=', $request->date('date_to')))
            ->orderByDesc('purchase_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Purchases retrieved.', $purchases);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        $purchase->load([
            'supplier',
            'user:id,name',
            'items.inventoryItem:id,name,sku,unit,current_stock',
            'receipts.items',
            'receipts.user:id,name',
        ]);

        return $this->success('Purchase retrieved.', $purchase);
    }

    public function store(UpsertPurchaseRequest $request, PurchaseService $purchaseService, ActivityLogger $activityLogger): JsonResponse
    {
        $purchase = $purchaseService->create($request->user(), $request->validated());
        $activityLogger->log($request, 'purchase.created', 'purchases', $purchase, after: [
            'purchase_number' => $purchase->purchase_number,
            'total' => $purchase->total,
        ]);

        return $this->success('Purchase created.', $purchase, 201);
    }

    public function update(UpsertPurchaseRequest $request, Purchase $purchase, PurchaseService $purchaseService, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $purchase->only(['supplier_id', 'total', 'status']);
        $purchase = $purchaseService->update($purchase, $request->validated());
        $activityLogger->log($request, 'purchase.updated', 'purchases', $purchase, $before, [
            'supplier_id' => $purchase->supplier_id,
            'total' => $purchase->total,
            'status' => $purchase->status,
        ]);

        return $this->success('Purchase updated.', $purchase);
    }

    public function submit(Request $request, Purchase $purchase, PurchaseService $purchaseService, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $purchase->status];
        $purchase = $purchaseService->submit($purchase);
        $activityLogger->log($request, 'purchase.submitted', 'purchases', $purchase, $before, ['status' => $purchase->status]);

        return $this->success('Purchase submitted.', $purchase);
    }

    public function cancel(Request $request, Purchase $purchase, PurchaseService $purchaseService, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $purchase->status];
        $purchase = $purchaseService->cancel($purchase);
        $activityLogger->log($request, 'purchase.cancelled', 'purchases', $purchase, $before, ['status' => $purchase->status]);

        return $this->success('Purchase cancelled.', $purchase);
    }

    public function receive(ReceivePurchaseRequest $request, Purchase $purchase, PurchaseService $purchaseService, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['status' => $purchase->status];
        $purchase = $purchaseService->receive($purchase, $request->user(), $request->validated());
        $activityLogger->log($request, 'purchase.received', 'purchases', $purchase, $before, ['status' => $purchase->status]);

        return $this->success('Stock received against purchase.', $purchase);
    }
}
