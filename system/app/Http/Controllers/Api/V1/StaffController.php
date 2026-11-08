<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertStaffRequest;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\RoleService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class StaffController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:30'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $staff = Staff::query()
            ->with(['user.roles:id,name,slug'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('first_name', 'like', $search)
                        ->orWhere('last_name', 'like', $search)
                        ->orWhere('employee_id', 'like', $search)
                        ->orWhere('phone', 'like', $search)
                        ->orWhere('email', 'like', $search);
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->orderBy('first_name')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        $items = collect($staff->items())->map(function (Staff $row) {
            $data = $row->toArray();
            $data['role_id'] = $row->user?->roles?->first()?->id;

            return $data;
        })->all();

        return $this->success('Staff retrieved.', $items, 200, null, [
            'current_page' => $staff->currentPage(),
            'last_page' => $staff->lastPage(),
            'per_page' => $staff->perPage(),
            'total' => $staff->total(),
            'from' => $staff->firstItem(),
            'to' => $staff->lastItem(),
        ]);
    }

    public function store(UpsertStaffRequest $request, ActivityLogger $activityLogger, RoleService $roleService): JsonResponse
    {
        try {
            $staff = DB::transaction(function () use ($request, $activityLogger, $roleService): Staff {
                $data = $request->safe()->except(['role_ids', 'role_id', 'password']);
                $data['employment_type'] = $data['employment_type'] ?? 'full_time';

                $roleId = $request->input('role_id') ?: collect($request->input('role_ids', []))->first();
                $password = $request->input('password');

                if ($roleId && $request->filled('email')) {
                    $role = Role::query()->findOrFail((int) $roleId);
                    // New logins are always active. Employment status must not control User Access.
                    $user = User::query()->create([
                        'name' => trim($data['first_name'].' '.$data['last_name']),
                        'email' => $data['email'],
                        'phone' => $data['phone'] ?? null,
                        'password' => $password ?: Hash::make(str()->random(16)),
                        'is_active' => true,
                        'status' => 'active',
                    ]);
                    $roleService->assignUserRole($request->user(), $user, $role);
                    $data['user_id'] = $user->id;
                }

                $staff = Staff::query()->create($data);
                $activityLogger->log($request, 'staff.created', 'staff', $staff, after: $staff->toArray());

                return $staff;
            });
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Staff created.', $staff->load(['user.roles']), 201);
    }

    public function show(Staff $staff): JsonResponse
    {
        return $this->success('Staff retrieved.', $staff->load(['user.roles', 'shifts']));
    }

    public function update(UpsertStaffRequest $request, Staff $staff, ActivityLogger $activityLogger, RoleService $roleService): JsonResponse
    {
        $before = $staff->toArray();
        try {
            DB::transaction(function () use ($request, $staff, $activityLogger, $before, $roleService): void {
                $data = $request->safe()->except(['role_ids', 'role_id', 'password']);
                $staff->update($data);

                $roleId = $request->input('role_id') ?: collect($request->input('role_ids', []))->first();
                $password = $request->input('password');

                if ($staff->user_id) {
                    $user = $staff->user;
                    // Employment status must NEVER rewrite login access.
                    // Editing an employee (including status) used to force is_active=false and looked like "auto deactivate".
                    // Login activate/deactivate is only via User Access (or staff archive below).
                    $user?->update([
                        'name' => trim($staff->first_name.' '.$staff->last_name),
                        'email' => $staff->email ?: $user->email,
                        'phone' => $staff->phone,
                        ...($password ? ['password' => $password] : []),
                    ]);
                    if ($roleId && $user) {
                        $role = Role::query()->findOrFail((int) $roleId);
                        $roleService->assignUserRole($request->user(), $user, $role);
                    }
                } elseif ($roleId && $request->filled('email')) {
                    $role = Role::query()->findOrFail((int) $roleId);
                    $user = User::query()->create([
                        'name' => trim($staff->first_name.' '.$staff->last_name),
                        'email' => $staff->email,
                        'phone' => $staff->phone,
                        'password' => $password ?: Hash::make(str()->random(16)),
                        'is_active' => true,
                        'status' => 'active',
                    ]);
                    $roleService->assignUserRole($request->user(), $user, $role);
                    $staff->update(['user_id' => $user->id]);
                }

                $activityLogger->log($request, 'staff.updated', 'staff', $staff, $before, $staff->fresh()->toArray());
            });
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Staff updated.', $staff->fresh()->load(['user.roles', 'shifts']));
    }

    public function destroy(Request $request, Staff $staff, ActivityLogger $activityLogger, RoleService $roleService): JsonResponse
    {
        $before = $staff->toArray();
        DB::transaction(function () use ($request, $staff, $activityLogger, $before): void {
            // Employment only — never touch login is_active/status here.
            // Disabling an employee used to deactivate User Access (and locked Super Admin out of live).
            $staff->update(['status' => 'inactive']);
            $activityLogger->log($request, 'staff.archived', 'staff', $staff, $before, $staff->fresh()->toArray());
        });

        return $this->success('Employee disabled. Login access is unchanged — manage that from User Access.');
    }
}
