<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffMeal;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StaffMealController extends Controller
{
    use ApiResponse;

    public function payroll(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'staff_id' => ['nullable', 'integer', 'exists:staff,id'],
        ]);

        $month = $data['month'] ?? now()->format('Y-m');
        $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $staffQuery = Staff::query()
            ->orderBy('first_name')
            ->orderBy('last_name');

        if (! empty($data['staff_id'])) {
            $staffQuery->whereKey((int) $data['staff_id']);
        } else {
            $staffQuery->where(function ($query) use ($start): void {
                $query->where('status', 'active')
                    ->orWhereHas('meals', fn ($meals) => $meals->whereBetween('meal_date', [
                        $start->toDateString(),
                        $start->copy()->endOfMonth()->toDateString(),
                    ]));
            });
        }

        $staffRows = $staffQuery->get();
        $meals = StaffMeal::query()
            ->with(['sale:id,invoice_number,sold_at', 'creator:id,name'])
            ->whereIn('staff_id', $staffRows->pluck('id'))
            ->whereBetween('meal_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('meal_date')
            ->orderBy('id')
            ->get()
            ->groupBy('staff_id');

        $employees = $staffRows->map(function (Staff $staff) use ($meals) {
            $mealRows = ($meals->get($staff->id) ?? collect())->values()->map(fn (StaffMeal $meal) => [
                'id' => $meal->id,
                'meal_date' => $meal->meal_date?->toDateString(),
                'description' => $meal->description,
                'items' => $meal->items,
                'amount' => (float) $meal->amount,
                'notes' => $meal->notes,
                'invoice_number' => $meal->sale?->invoice_number,
                'created_by' => $meal->creator?->name,
            ])->all();

            $deductions = collect($mealRows)->sum('amount');
            $salary = (float) $staff->salary;

            return [
                'id' => $staff->id,
                'employee_id' => $staff->employee_id,
                'name' => trim($staff->first_name.' '.$staff->last_name),
                'designation' => $staff->designation,
                'status' => $staff->status,
                'salary' => $salary,
                'meal_deductions' => round($deductions, 2),
                'net_pay' => round($salary - $deductions, 2),
                'meals' => $mealRows,
            ];
        })->values()->all();

        return $this->success('Staff payroll retrieved.', [
            'month' => $month,
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'employees' => $employees,
            'totals' => [
                'salary' => round(collect($employees)->sum('salary'), 2),
                'meal_deductions' => round(collect($employees)->sum('meal_deductions'), 2),
                'net_pay' => round(collect($employees)->sum('net_pay'), 2),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staff,id'],
            'meal_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string', 'max:500'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['nullable', 'array'],
        ]);

        $staff = Staff::query()->findOrFail((int) $data['staff_id']);
        if ($staff->status !== 'active') {
            throw ValidationException::withMessages([
                'staff_id' => ['Only active employees can receive meal deductions.'],
            ]);
        }

        $meal = StaffMeal::query()->create([
            'staff_id' => $staff->id,
            'sale_id' => null,
            'meal_date' => $data['meal_date'] ?? now()->toDateString(),
            'description' => $data['description'] ?? 'Manual staff meal deduction',
            'items' => $data['items'] ?? null,
            'amount' => $data['amount'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        return $this->success('Staff meal deduction recorded.', $meal->fresh(), 201);
    }

    public function destroy(StaffMeal $staffMeal): JsonResponse
    {
        $staffMeal->delete();

        return $this->success('Staff meal deduction removed.');
    }
}
