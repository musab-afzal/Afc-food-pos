<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLeaveRequest;
use App\Models\Leave;
use App\Services\ActivityLogger;
use App\Services\LeaveService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeaveController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'staff_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', Rule::in(['pending', 'approved', 'rejected'])],
            'leave_type' => ['nullable', 'string', 'max:40'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $leaves = Leave::query()
            ->with(['staff:id,employee_id,first_name,last_name', 'approver:id,name'])
            ->when($request->filled('staff_id'), fn ($query) => $query->where('staff_id', $request->integer('staff_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('leave_type'), fn ($query) => $query->where('leave_type', $request->string('leave_type')->value()))
            // from/to select leaves overlapping the window.
            ->when($request->filled('from'), fn ($query) => $query->whereDate('end_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('start_date', '<=', $request->date('to')))
            ->orderByDesc('start_date')->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Leaves retrieved.', $leaves);
    }

    public function show(Leave $leave): JsonResponse
    {
        return $this->success('Leave retrieved.', $leave->load(['staff:id,employee_id,first_name,last_name', 'approver:id,name']));
    }

    public function store(StoreLeaveRequest $request, LeaveService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $leave = $service->request($request->user(), $request->validated());
        $activityLogger->log($request, 'leave.requested', 'attendance', $leave, after: $leave->toArray());

        return $this->success('Leave requested.', $leave, 201);
    }

    public function approve(Request $request, Leave $leave, LeaveService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $leave->toArray();
        $leave = $service->approve($request->user(), $leave);
        $activityLogger->log($request, 'leave.approved', 'attendance', $leave, $before, $leave->toArray());

        return $this->success('Leave approved.', $leave);
    }

    public function reject(Request $request, Leave $leave, LeaveService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $leave->toArray();
        $leave = $service->reject($request->user(), $leave);
        $activityLogger->log($request, 'leave.rejected', 'attendance', $leave, $before, $leave->toArray());

        return $this->success('Leave rejected.', $leave);
    }
}
