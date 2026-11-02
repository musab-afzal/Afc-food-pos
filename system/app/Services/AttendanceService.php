<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Leave;
use App\Models\Staff;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public const STATUSES = ['present', 'late', 'absent', 'leave', 'half_day'];

    /** Staff statuses that may be rostered, clock in/out or request leave. */
    public const CLOCKABLE_STATUSES = ['active', 'on_leave'];

    /** Clock events more than this many minutes ahead of the server clock are rejected. */
    private const FUTURE_TOLERANCE_MINUTES = 5;

    /**
     * Resolve the target staff member: explicit staff_id, else the profile linked to the authenticated user.
     */
    public function resolveStaff(User $user, ?int $staffId, string $field = 'staff_id'): Staff
    {
        $staff = $staffId
            ? Staff::query()->find($staffId)
            : Staff::query()->where('user_id', $user->id)->first();

        if (! $staff) {
            throw ValidationException::withMessages([
                $field => [$staffId ? 'Staff member not found.' : 'staff_id is required because your account has no staff profile.'],
            ]);
        }

        if (! in_array($staff->status, self::CLOCKABLE_STATUSES, true)) {
            throw ValidationException::withMessages([$field => ['This staff member is not active.']]);
        }

        return $staff;
    }

    public function checkIn(Staff $staff, ?string $at = null, ?string $notes = null): Attendance
    {
        return DB::transaction(function () use ($staff, $at, $notes): Attendance {
            $staff = Staff::query()->lockForUpdate()->findOrFail($staff->id);
            $time = $this->clockTime($at);
            $window = $this->shiftWindow($staff, $time);
            $date = $this->attendanceDate($time, $window);

            $onLeave = Leave::query()
                ->where('staff_id', $staff->id)->where('status', 'approved')
                ->whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date)
                ->exists();
            if ($onLeave) {
                throw ValidationException::withMessages(['attendance' => ['Staff member is on approved leave on '.$date.'.']]);
            }

            $attendance = Attendance::query()->where('staff_id', $staff->id)->whereDate('date', $date)->lockForUpdate()->first();
            if ($attendance?->check_in) {
                throw ValidationException::withMessages(['attendance' => ['Staff member has already checked in for '.$date.'.']]);
            }

            $stillOpen = Attendance::query()
                ->where('staff_id', $staff->id)->whereNotNull('check_in')->whereNull('check_out')
                ->where('check_in', '>', $time->copy()->subDay())
                ->when($attendance, fn ($query) => $query->whereKeyNot($attendance->id))
                ->exists();
            if ($stillOpen) {
                throw ValidationException::withMessages(['attendance' => ['Staff member has an open attendance record. Check out first.']]);
            }

            $metrics = $this->metrics($time, null, $window);
            $attributes = [
                'check_in' => $time,
                'check_out' => null,
                'working_minutes' => 0,
                'late_minutes' => $metrics['late_minutes'],
                'overtime_minutes' => 0,
                'status' => $metrics['late_minutes'] > 0 ? 'late' : 'present',
                'notes' => $notes ?? $attendance?->notes,
            ];

            $attendance ??= new Attendance(['staff_id' => $staff->id, 'date' => $date]);
            $attendance->fill($attributes)->save();

            return $this->present($attendance);
        });
    }

    public function checkOut(Staff $staff, ?string $at = null, ?string $notes = null): Attendance
    {
        return DB::transaction(function () use ($staff, $at, $notes): Attendance {
            $staff = Staff::query()->lockForUpdate()->findOrFail($staff->id);
            $attendance = Attendance::query()
                ->where('staff_id', $staff->id)->whereNotNull('check_in')->whereNull('check_out')
                ->orderByDesc('check_in')->lockForUpdate()->first();

            if (! $attendance) {
                throw ValidationException::withMessages(['attendance' => ['No open check-in found for this staff member.']]);
            }

            $time = $this->clockTime($at);
            if ($time->lt($attendance->check_in)) {
                throw ValidationException::withMessages(['at' => ['Check-out cannot be earlier than check-in.']]);
            }

            $window = $this->shiftWindow($staff, $attendance->check_in);
            $metrics = $this->metrics($attendance->check_in, $time, $window);

            $attendance->fill([
                'check_out' => $time,
                'working_minutes' => $metrics['working_minutes'],
                'overtime_minutes' => $metrics['overtime_minutes'],
                'late_minutes' => $metrics['late_minutes'],
                'notes' => $notes ?? $attendance->notes,
            ])->save();

            return $this->present($attendance);
        });
    }

    /**
     * Manual entry. Without $attendance this upserts on (staff_id, date); with it, the record is edited in place.
     *
     * @param  array<string, mixed>  $data
     */
    public function upsert(?Attendance $attendance, array $data): Attendance
    {
        return DB::transaction(function () use ($attendance, $data): Attendance {
            if ($attendance) {
                $attendance = Attendance::query()->lockForUpdate()->findOrFail($attendance->id);
                $staffId = (int) ($data['staff_id'] ?? $attendance->staff_id);
                $date = isset($data['date']) ? Carbon::parse($data['date'])->toDateString() : $attendance->date->toDateString();

                $conflict = Attendance::query()->where('staff_id', $staffId)->whereDate('date', $date)->whereKeyNot($attendance->id)->exists();
                if ($conflict) {
                    throw ValidationException::withMessages(['date' => ['An attendance record already exists for this staff member and date.']]);
                }
            } else {
                $staffId = (int) $data['staff_id'];
                $date = Carbon::parse($data['date'])->toDateString();
                $attendance = Attendance::query()->where('staff_id', $staffId)->whereDate('date', $date)->lockForUpdate()->first();
            }

            $staff = Staff::query()->findOrFail($staffId);
            $exists = $attendance !== null;
            $attendance ??= new Attendance();

            $checkIn = array_key_exists('check_in', $data)
                ? ($data['check_in'] ? Carbon::parse($data['check_in']) : null)
                : $attendance->check_in;
            $checkOut = array_key_exists('check_out', $data)
                ? ($data['check_out'] ? Carbon::parse($data['check_out']) : null)
                : $attendance->check_out;
            $status = $data['status'] ?? null;

            if ($checkOut && ! $checkIn) {
                throw ValidationException::withMessages(['check_in' => ['check_in is required when check_out is set.']]);
            }
            if ($checkIn && $checkOut && $checkOut->lt($checkIn)) {
                throw ValidationException::withMessages(['check_out' => ['check_out cannot be earlier than check_in.']]);
            }
            if ($checkIn && in_array($status, ['absent', 'leave'], true)) {
                throw ValidationException::withMessages(['status' => ['An absent or leave record cannot have a check-in time.']]);
            }

            $window = $checkIn ? $this->shiftWindow($staff, $checkIn) : null;
            $metrics = $checkIn ? $this->metrics($checkIn, $checkOut, $window) : ['late_minutes' => 0, 'working_minutes' => 0, 'overtime_minutes' => 0];

            if ($status === null) {
                $unchanged = $exists && $attendance->check_in?->equalTo($checkIn) === true && $attendance->status !== null;
                $status = $unchanged
                    ? $attendance->status
                    : ($checkIn ? ($metrics['late_minutes'] > 0 ? 'late' : 'present') : ($exists ? $attendance->status : 'absent'));
            }

            $attendance->fill([
                'staff_id' => $staffId,
                'date' => $date,
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'working_minutes' => $metrics['working_minutes'],
                'late_minutes' => $metrics['late_minutes'],
                'overtime_minutes' => $metrics['overtime_minutes'],
                'status' => $status,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $attendance->notes,
            ])->save();

            return $this->present($attendance);
        });
    }

    /**
     * Pick the active assigned shift whose start is nearest to $at and return its concrete window.
     *
     * @return array{shift: \App\Models\Shift, start: Carbon, end: Carbon}|null
     */
    public function shiftWindow(Staff $staff, CarbonInterface $at): ?array
    {
        $date = $at->toDateString();
        $shifts = $staff->shifts()
            ->where('shifts.is_active', true)
            ->where(fn ($query) => $query->whereNull('employee_shifts.effective_from')->orWhere('employee_shifts.effective_from', '<=', $date))
            ->get();

        $best = null;
        $bestDistance = PHP_INT_MAX;

        foreach ($shifts as $shift) {
            foreach ([-1, 0, 1] as $offset) {
                $start = Carbon::instance($at)->startOfDay()->addDays($offset)->setTimeFromTimeString($shift->start_time);
                $end = $start->copy()->setTimeFromTimeString($shift->end_time);
                if ($end->lessThanOrEqualTo($start)) {
                    $end->addDay();
                }

                $distance = abs($at->getTimestamp() - $start->getTimestamp());
                if ($distance < $bestDistance) {
                    $bestDistance = $distance;
                    $best = ['shift' => $shift, 'start' => $start, 'end' => $end];
                }
            }
        }

        return $best;
    }

    /**
     * late_minutes: minutes past (shift start + grace); working_minutes: check-out minus check-in;
     * overtime_minutes: minutes past shift end.
     *
     * @param  array{shift: \App\Models\Shift, start: Carbon, end: Carbon}|null  $window
     * @return array{late_minutes: int, working_minutes: int, overtime_minutes: int}
     */
    public function metrics(CarbonInterface $checkIn, ?CarbonInterface $checkOut, ?array $window): array
    {
        $late = 0;
        $overtime = 0;

        if ($window) {
            $threshold = $window['start']->getTimestamp() + ((int) $window['shift']->grace_minutes * 60);
            $late = max(0, intdiv($checkIn->getTimestamp() - $threshold, 60));

            if ($checkOut) {
                $overtime = max(0, intdiv($checkOut->getTimestamp() - $window['end']->getTimestamp(), 60));
            }
        }

        return [
            'late_minutes' => $late,
            'working_minutes' => $checkOut ? max(0, intdiv($checkOut->getTimestamp() - $checkIn->getTimestamp(), 60)) : 0,
            'overtime_minutes' => $overtime,
        ];
    }

    private function clockTime(?string $at): Carbon
    {
        $time = $at ? Carbon::parse($at) : now();

        if ($time->gt(now()->addMinutes(self::FUTURE_TOLERANCE_MINUTES))) {
            throw ValidationException::withMessages(['at' => ['The time cannot be in the future.']]);
        }

        return $time;
    }

    /** Overnight shifts started the previous evening belong to the previous calendar date. */
    private function attendanceDate(Carbon $time, ?array $window): string
    {
        if ($window && $window['start']->toDateString() < $time->toDateString()) {
            return $window['start']->toDateString();
        }

        return $time->toDateString();
    }

    private function present(Attendance $attendance): Attendance
    {
        return $attendance->fresh()->load('staff:id,employee_id,first_name,last_name');
    }
}
