<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignShiftRequest;
use App\Http\Requests\UpsertShiftRequest;
use App\Models\Shift;
use App\Models\Staff;
use App\Services\ActivityLogger;
use App\Services\ShiftService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'staff_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $shifts = Shift::query()
            ->withCount('staff')
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search')->value().'%'))
            ->when($request->has('is_active') && $request->input('is_active') !== '', fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('staff_id'), fn ($query) => $query->whereHas('staff', fn ($staff) => $staff->where('staff.id', $request->integer('staff_id'))))
            ->orderBy('start_time')->orderBy('id')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return $this->paginated('Shifts retrieved.', $shifts);
    }

    public function store(UpsertShiftRequest $request, ShiftService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $shift = $service->create($request->validated());
        $activityLogger->log($request, 'shift.created', 'staff', $shift, after: $shift->toArray());

        return $this->success('Shift created.', $shift, 201);
    }

    public function show(Shift $shift): JsonResponse
    {
        return $this->success('Shift retrieved.', $shift->load('staff:id,employee_id,first_name,last_name,designation,status')->loadCount('staff'));
    }

    public function update(UpsertShiftRequest $request, Shift $shift, ShiftService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $shift->toArray();
        $shift = $service->update($shift, $request->validated());
        $activityLogger->log($request, 'shift.updated', 'staff', $shift, $before, $shift->toArray());

        return $this->success('Shift updated.', $shift);
    }

    public function destroy(Request $request, Shift $shift, ShiftService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $shift->toArray();
        $service->delete($shift);
        $activityLogger->log($request, 'shift.deleted', 'staff', $shift, $before);

        return $this->success('Shift deleted.');
    }

    /** Staff assigned to a shift. */
    public function staff(Shift $shift): JsonResponse
    {
        return $this->success('Shift staff retrieved.', $shift->staff()
            ->select('staff.id', 'staff.employee_id', 'staff.first_name', 'staff.last_name', 'staff.designation', 'staff.status')
            ->orderBy('staff.first_name')->get());
    }

    /** Shifts assigned to a staff member. */
    public function forStaff(Staff $staff): JsonResponse
    {
        return $this->success('Staff shifts retrieved.', $staff->shifts()->orderBy('shifts.start_time')->get());
    }

    public function assign(AssignShiftRequest $request, Shift $shift, ShiftService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $staff = Staff::query()->findOrFail($request->integer('staff_id'));
        $shift = $service->assign($shift, $staff, $request->input('effective_from'));
        $activityLogger->log($request, 'shift.assigned', 'staff', $shift, after: ['shift_id' => $shift->id, 'staff_id' => $staff->id, 'effective_from' => $request->input('effective_from')]);

        return $this->success('Staff assigned to shift.', $shift);
    }

    public function unassign(Request $request, Shift $shift, Staff $staff, ShiftService $service, ActivityLogger $activityLogger): JsonResponse
    {
        $service->unassign($shift, $staff);
        $activityLogger->log($request, 'shift.unassigned', 'staff', $shift, before: ['shift_id' => $shift->id, 'staff_id' => $staff->id]);

        return $this->success('Staff removed from shift.');
    }
}
