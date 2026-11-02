<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Leave;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    private const MAX_LEAVE_DAYS = 366;

    public function __construct(private readonly AttendanceService $attendance) {}

    /** @param array<string, mixed> $data */
    public function request(User $user, array $data): Leave
    {
        return DB::transaction(function () use ($user, $data): Leave {
            $staff = $this->attendance->resolveStaff($user, isset($data['staff_id']) ? (int) $data['staff_id'] : null);
            $start = Carbon::parse($data['start_date'])->startOfDay();
            $end = Carbon::parse($data['end_date'])->startOfDay();

            if ($start->diffInDays($end) >= self::MAX_LEAVE_DAYS) {
                throw ValidationException::withMessages(['end_date' => ['A leave request cannot span more than '.self::MAX_LEAVE_DAYS.' days.']]);
            }

            // Serialise concurrent requests for the same staff member before the overlap check.
            $staff->newQuery()->whereKey($staff->id)->lockForUpdate()->first();

            $overlap = Leave::query()
                ->where('staff_id', $staff->id)
                ->whereIn('status', ['pending', 'approved'])
                ->whereDate('start_date', '<=', $end)->whereDate('end_date', '>=', $start)
                ->exists();
            if ($overlap) {
                throw ValidationException::withMessages(['start_date' => ['A pending or approved leave already overlaps these dates.']]);
            }

            $leave = Leave::query()->create([
                'staff_id' => $staff->id,
                'leave_type' => $data['leave_type'],
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'reason' => $data['reason'] ?? null,
                'status' => 'pending',
            ]);

            return $this->present($leave);
        });
    }

    /** Approve a pending leave and mark the covered days as "leave" in attendance (never overwriting real check-ins). */
    public function approve(User $user, Leave $leave): Leave
    {
        return DB::transaction(function () use ($user, $leave): Leave {
            $leave = $this->lockPending($leave);
            $leave->update(['status' => 'approved', 'approved_by' => $user->id]);

            $day = $leave->start_date->copy();
            while ($day->lessThanOrEqualTo($leave->end_date)) {
                $record = Attendance::query()->where('staff_id', $leave->staff_id)->whereDate('date', $day)->lockForUpdate()->first();

                if (! $record) {
                    Attendance::query()->create([
                        'staff_id' => $leave->staff_id, 'date' => $day->toDateString(), 'status' => 'leave',
                        'notes' => 'Approved '.$leave->leave_type.' leave #'.$leave->id,
                    ]);
                } elseif (! $record->check_in) {
                    $record->update(['status' => 'leave', 'notes' => $record->notes ?: 'Approved '.$leave->leave_type.' leave #'.$leave->id]);
                }

                $day->addDay();
            }

            return $this->present($leave);
        });
    }

    public function reject(User $user, Leave $leave): Leave
    {
        return DB::transaction(function () use ($user, $leave): Leave {
            $leave = $this->lockPending($leave);
            $leave->update(['status' => 'rejected', 'approved_by' => $user->id]);

            return $this->present($leave);
        });
    }

    private function lockPending(Leave $leave): Leave
    {
        $leave = Leave::query()->lockForUpdate()->findOrFail($leave->id);

        if ($leave->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending leave requests can be approved or rejected (current status: '.$leave->status.').']]);
        }

        return $leave;
    }

    private function present(Leave $leave): Leave
    {
        return $leave->fresh()->load(['staff:id,employee_id,first_name,last_name', 'approver:id,name']);
    }
}
