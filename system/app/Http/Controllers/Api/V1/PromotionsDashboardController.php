<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PromotionsDashboardService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class PromotionsDashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(PromotionsDashboardService $service): JsonResponse
    {
        return $this->success('Promotions dashboard retrieved.', $service->summary());
    }
}
