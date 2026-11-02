<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertSupplierRequest;
use App\Models\Supplier;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $suppliers = Supplier::query()
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('phone', 'like', $search)
                    ->orWhere('email', 'like', $search)
                    ->orWhere('contact_person', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Suppliers retrieved.', $suppliers);
    }

    public function store(UpsertSupplierRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validated();
        $data['opening_balance'] = $data['opening_balance'] ?? 0;
        $data['current_payable'] = $data['opening_balance'];
        $data['is_active'] = $data['is_active'] ?? true;

        $supplier = Supplier::query()->create($data);
        $activityLogger->log($request, 'supplier.created', 'suppliers', $supplier, after: $supplier->toArray());

        return $this->success('Supplier created.', $supplier, 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->loadCount('purchases');

        return $this->success('Supplier retrieved.', $supplier);
    }

    public function update(UpsertSupplierRequest $request, Supplier $supplier, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $supplier->toArray();
        $supplier->update($request->validated());
        $activityLogger->log($request, 'supplier.updated', 'suppliers', $supplier, $before, $supplier->fresh()->toArray());

        return $this->success('Supplier updated.', $supplier->fresh());
    }

    public function destroy(Request $request, Supplier $supplier, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $supplier->toArray();
        $supplier->update(['is_active' => false]);
        $supplier->delete();
        $activityLogger->log($request, 'supplier.deleted', 'suppliers', $supplier, $before, ['deleted' => true]);

        return $this->success('Supplier archived.');
    }
}
