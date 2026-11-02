<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AttendanceClockRequest;
use App\Http\Requests\UpsertAttendanceRequest;
use App\Models\Attendance;
use App\Services\ActivityLogger;
use App\Services\AttendanceService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'staff_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', Rule::in(AttendanceService::STATUSES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $records = Attendance::query()
            ->with('staff:id,employee_id,first_name,last_name,designation')
            ->when($request->filled('staff_id'), fn ($query) => $query->where('staff_id', $request->integer('staff_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('date', '<=', $request->date('to')))
            ->orderByDesc('date')->orderByDesc('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return $this->paginated('Attendance retrieved.', $records);
    }

    public function show(Attendance $attendance): JsonResponse
    {
        return $this->success('Attendance retrieved.', $attendance->load('staff:id,employee_id,first_name,last_name,designation'));
    }

    public function checkIn(AttendanceClockRequest $request, AttendanceService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $staff = $service->resolveStaff($request->user(), $request->filled('staff_id') ? $request->integer('staff_id') : null);
        $attendance = $service->checkIn($staff, $request->input('at'), $request->input('notes'));
        $activityLogger->log($request, 'attendance.check_in', 'attendance', $attendance, after: $attendance->toArray());

        return $this->success('Checked in.', $attendance, 201);
    }

    public function checkOut(AttendanceClockRequest $request, AttendanceService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $staff = $service->resolveStaff($request->user(), $request->filled('staff_id') ? $request->integer('staff_id') : null);
        $attendance = $service->checkOut($staff, $request->input('at'), $request->input('notes'));
        $activityLogger->log($request, 'attendance.check_out', 'attendance', $attendance, after: $attendance->toArray());

        return $this->success('Checked out.', $attendance);
    }

    /** Manual entry: upsert on (staff_id, date). */
    public function store(UpsertAttendanceRequest $request, AttendanceService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $existing = Attendance::query()
            ->where('staff_id', $request->integer('staff_id'))->whereDate('date', $request->date('date'))->first();
        $before = $existing?->toArray();

        $attendance = $service->upsert(null, $request->validated());
        $activityLogger->log($request, $existing ? 'attendance.updated' : 'attendance.created', 'attendance', $attendance, $before, $attendance->toArray());

        return $this->success($existing ? 'Attendance updated.' : 'Attendance recorded.', $attendance, $existing ? 200 : 201);
    }

    public function update(UpsertAttendanceRequest $request, Attendance $attendance, AttendanceService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $attendance->toArray();
        $attendance = $service->upsert($attendance, $request->validated());
        $activityLogger->log($request, 'attendance.updated', 'attendance', $attendance, $before, $attendance->toArray());

        return $this->success('Attendance updated.', $attendance);
    }
}
