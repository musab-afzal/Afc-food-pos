<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertDealRequest;
use App\Models\Deal;
use App\Models\Dish;
use App\Services\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DealController extends Controller
{
    use ApiResponse;

    private const WITH_ITEMS = ['items.dish:id,name,base_price', 'items.variant:id,dish_id,name,price'];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:name,price,created_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $request->string('sort')->value() ?: 'name';
        $direction = $request->string('direction')->value() ?: 'asc';

        $deals = Deal::query()
            ->with(self::WITH_ITEMS)
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where('name', 'like', $search);
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Deals retrieved.', $deals);
    }

    /** Active dishes with their active sizes, for the deal builder. */
    public function products(): JsonResponse
    {
        $dishes = Dish::query()
            ->where('is_active', true)
            ->with(['variants' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order')->select('id', 'dish_id', 'name', 'price')])
            ->orderBy('name')
            ->get(['id', 'name', 'base_price']);

        return $this->success('Deal products retrieved.', $dishes);
    }

    public function store(UpsertDealRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        $deal = DB::transaction(function () use ($request, $activityLogger): Deal {
            $data = $request->validated();
            $deal = Deal::query()->create(collect($data)->except('items')->all());
            $deal->items()->createMany($data['items']);
            $activityLogger->log($request, 'deal.created', 'menu', $deal, after: $deal->load('items')->toArray());

            return $deal;
        });

        return $this->success('Deal created.', $deal->fresh(self::WITH_ITEMS), 201);
    }

    public function show(Deal $deal): JsonResponse
    {
        return $this->success('Deal retrieved.', $deal->load(self::WITH_ITEMS));
    }

    public function update(UpsertDealRequest $request, Deal $deal, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $deal->load('items')->toArray();
        DB::transaction(function () use ($request, $deal, $activityLogger, $before): void {
            $data = $request->validated();
            $deal->update(collect($data)->except('items')->all());
            $deal->items()->delete();
            $deal->items()->createMany($data['items']);
            $activityLogger->log($request, 'deal.updated', 'menu', $deal, $before, $deal->fresh('items')->toArray());
        });

        return $this->success('Deal updated.', $deal->fresh(self::WITH_ITEMS));
    }

    public function toggle(Request $request, Deal $deal, ActivityLogger $activityLogger): JsonResponse
    {
        $before = ['is_active' => $deal->is_active];
        $deal->update(['is_active' => ! $deal->is_active]);
        $activityLogger->log($request, $deal->is_active ? 'deal.activated' : 'deal.deactivated', 'menu', $deal, $before, ['is_active' => $deal->is_active]);

        return $this->success($deal->is_active ? 'Deal activated.' : 'Deal deactivated.', $deal->fresh(self::WITH_ITEMS));
    }

    public function destroy(Request $request, Deal $deal, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $deal->load('items')->toArray();
        DB::transaction(function () use ($request, $deal, $activityLogger, $before): void {
            $deal->delete();
            $activityLogger->log($request, 'deal.deleted', 'menu', $deal, $before);
        });

        return $this->success('Deal deleted.');
    }
}
