<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\FinanceDashboardService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FinanceDashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request, FinanceDashboardService $dashboard): JsonResponse
    {
        $data = $request->validate([
            'period' => ['nullable', 'string', Rule::in(['today', 'yesterday', 'week', 'month', 'custom'])],
            'from' => ['required_if:period,custom', 'nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return $this->success('Finance dashboard retrieved.', $dashboard->summary($data['period'] ?? 'today', $data['from'] ?? null, $data['to'] ?? null));
    }
}
