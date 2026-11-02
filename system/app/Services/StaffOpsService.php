<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Leave;
use App\Models\Shift;
use App\Models\Staff;
use Illuminate\Support\Carbon;

class StaffOpsService
{
    /** @return array<string, mixed> */
    public function dashboard(?string $date = null): array
    {
        $day = ($date ? Carbon::parse($date) : now())->startOfDay();
        $dayString = $day->toDateString();

        $roster = Staff::query()
            ->whereIn('status', AttendanceService::CLOCKABLE_STATUSES)
            ->get(['id', 'employee_id', 'first_name', 'last_name', 'designation'])
            ->keyBy('id');

        $records = Attendance::query()->whereDate('date', $dayString)->whereIn('staff_id', $roster->keys())->get();
        $present = $records->whereNotNull('check_in');
        $presentIds = $present->pluck('staff_id')->all();

        $onLeaveIds = Leave::query()
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $dayString)->whereDate('end_date', '>=', $dayString)
            ->whereIn('staff_id', $roster->keys())
            ->pluck('staff_id')->unique()->values()->all();

        $absent = $roster->except(array_merge($presentIds, $onLeaveIds));
        $label = fn (Staff $staff): array => [
            'id' => $staff->id, 'employee_id' => $staff->employee_id,
            'name' => trim($staff->first_name.' '.$staff->last_name), 'designation' => $staff->designation,
        ];

        $shifts = Shift::query()->where('is_active', true)->with('staff:id')->orderBy('start_time')->get()
            ->map(function (Shift $shift) use ($roster, $present, $day): array {
                $assigned = $shift->staff->pluck('id')->filter(fn (int $id): bool => $roster->has($id));
                $shiftPresent = $present->whereIn('staff_id', $assigned->all());

                return [
                    'id' => $shift->id,
                    'name' => $shift->name,
                    'start_time' => $shift->start_time,
                    'end_time' => $shift->end_time,
                    'grace_minutes' => $shift->grace_minutes,
                    'assigned_count' => $assigned->count(),
                    'present_count' => $shiftPresent->count(),
                    'checked_in_now' => $shiftPresent->whereNull('check_out')->count(),
                    'is_open_now' => $day->isToday() && $this->isRunning($shift),
                ];
            })->values();

        return [
            'date' => $dayString,
            'roster_total' => $roster->count(),
            'present' => count($presentIds),
            'late' => $present->where('status', 'late')->count(),
            'absent' => $absent->count(),
            'on_leave' => count($onLeaveIds),
            'checked_in_now' => $present->whereNull('check_out')->count(),
            'pending_leave_requests' => Leave::query()->where('status', 'pending')->count(),
            'total_overtime_minutes' => (int) $records->sum('overtime_minutes'),
            'total_late_minutes' => (int) $records->sum('late_minutes'),
            'open_shifts' => $shifts->where('is_open_now', true)->values(),
            'shifts' => $shifts,
            'absent_staff' => $absent->take(50)->map($label)->values(),
            'on_leave_staff' => $roster->only($onLeaveIds)->map($label)->values(),
        ];
    }

    private function isRunning(Shift $shift): bool
    {
        $now = now();

        foreach ([-1, 0] as $offset) {
            $start = $now->copy()->startOfDay()->addDays($offset)->setTimeFromTimeString($shift->start_time);
            $end = $start->copy()->setTimeFromTimeString($shift->end_time);
            if ($end->lessThanOrEqualTo($start)) {
                $end->addDay();
            }
            if ($now->greaterThanOrEqualTo($start) && $now->lessThan($end)) {
                return true;
            }
        }

        return false;
    }
}
