<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\StaffOpsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffOpsController extends Controller
{
    use ApiResponse;

    public function dashboard(Request $request, StaffOpsService $service): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return $this->success('Staff operations dashboard retrieved.', $service->dashboard($request->input('date')));
    }
}
