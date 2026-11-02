<?php

namespace Database\Seeders;

use App\Models\EmployeeShift;
use App\Models\Shift;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Seeder;

class StaffOperationsSeeder extends Seeder
{
    public function run(): void
    {
        if (Shift::query()->doesntExist()) {
            foreach ([
                ['name' => 'Morning', 'start_time' => '06:00:00', 'end_time' => '14:00:00'],
                ['name' => 'Evening', 'start_time' => '14:00:00', 'end_time' => '22:00:00'],
                ['name' => 'Night', 'start_time' => '22:00:00', 'end_time' => '06:00:00'],
            ] as $shift) {
                Shift::query()->create($shift + ['grace_minutes' => 15, 'is_active' => true]);
            }
        }

        // Make sure at least one active staff member exists and is rostered.
        $staff = Staff::query()->where('status', 'active')->orderBy('id')->first();
        if (! $staff) {
            $admin = User::query()->where('email', env('SEED_ADMIN_EMAIL', 'admin@example.com'))->first();
            $staff = Staff::query()->create([
                'employee_id' => 'EMP-0001',
                'user_id' => $admin?->id,
                'first_name' => 'Restaurant',
                'last_name' => 'Admin',
                'phone' => '0000000000',
                'email' => $admin?->email,
                'designation' => 'Manager',
                'joining_date' => now()->toDateString(),
                'employment_type' => 'full_time',
                'status' => 'active',
            ]);
        }

        if (EmployeeShift::query()->doesntExist()) {
            $morning = Shift::query()->where('name', 'Morning')->first() ?? Shift::query()->where('is_active', true)->orderBy('start_time')->first();
            $morning?->staff()->syncWithoutDetaching([$staff->id => ['effective_from' => now()->toDateString()]]);
        }
    }
}
