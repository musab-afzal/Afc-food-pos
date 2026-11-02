<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\Staff;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShiftService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): Shift
    {
        return DB::transaction(fn (): Shift => Shift::query()->create([
            'name' => $data['name'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'grace_minutes' => $data['grace_minutes'] ?? 15,
            'is_active' => $data['is_active'] ?? true,
        ])->fresh()->loadCount('staff'));
    }

    /** @param array<string, mixed> $data */
    public function update(Shift $shift, array $data): Shift
    {
        return DB::transaction(function () use ($shift, $data): Shift {
            $shift = Shift::query()->lockForUpdate()->findOrFail($shift->id);
            $shift->update(collect($data)
                ->only(['name', 'start_time', 'end_time', 'grace_minutes', 'is_active'])
                ->reject(fn (mixed $value): bool => $value === null)
                ->all());

            return $shift->fresh()->loadCount('staff');
        });
    }

    public function delete(Shift $shift): void
    {
        DB::transaction(function () use ($shift): void {
            $shift = Shift::query()->lockForUpdate()->findOrFail($shift->id);

            if ($shift->assignments()->exists()) {
                throw ValidationException::withMessages([
                    'shift' => ['This shift still has staff assigned. Unassign them or deactivate the shift instead.'],
                ]);
            }

            $shift->delete();
        });
    }

    public function assign(Shift $shift, Staff $staff, ?string $effectiveFrom = null): Shift
    {
        return DB::transaction(function () use ($shift, $staff, $effectiveFrom): Shift {
            $shift = Shift::query()->lockForUpdate()->findOrFail($shift->id);

            if (! $shift->is_active) {
                throw ValidationException::withMessages(['shift' => ['Inactive shifts cannot receive new assignments.']]);
            }

            if (! in_array($staff->status, AttendanceService::CLOCKABLE_STATUSES, true)) {
                throw ValidationException::withMessages(['staff_id' => ['Only active staff can be assigned to a shift.']]);
            }

            // Unique (staff_id, shift_id): re-assigning simply refreshes the effective date.
            $shift->staff()->syncWithoutDetaching([
                $staff->id => ['effective_from' => $effectiveFrom ?: now()->toDateString()],
            ]);

            return $shift->load('staff:id,employee_id,first_name,last_name,designation,status')->loadCount('staff');
        });
    }

    public function unassign(Shift $shift, Staff $staff): void
    {
        DB::transaction(function () use ($shift, $staff): void {
            if ($shift->staff()->detach($staff->id) === 0) {
                throw ValidationException::withMessages(['staff' => ['This staff member is not assigned to the shift.']]);
            }
        });
    }
}
