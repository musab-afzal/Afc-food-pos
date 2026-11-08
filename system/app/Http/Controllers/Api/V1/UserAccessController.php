<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignUserRoleRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\RoleService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UserAccessController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'status' => ['nullable', 'string', 'max:30'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $users = User::query()
            ->with(['roles:id,name,slug,is_active', 'staff:id,user_id,employee_id,status'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(function ($nested) use ($search): void {
                    $nested->where('name', 'like', $search)
                        ->orWhere('email', 'like', $search)
                        ->orWhereHas('staff', fn ($q) => $q->where('employee_id', 'like', $search));
                });
            })
            ->when($request->filled('role_id'), fn ($q) => $q->whereHas('roles', fn ($r) => $r->where('roles.id', $request->integer('role_id'))))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->value()))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 25))
            ->withQueryString();

        $items = collect($users->items())->map(function (User $user) {
            $role = $user->roles->first();

            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'employee_id' => $user->staff?->employee_id,
                'status' => $user->status,
                'is_active' => $user->is_active,
                'last_login_at' => $user->last_login_at,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                    'is_active' => $role->is_active,
                ] : null,
                'is_super_admin' => $role?->slug === 'super_admin',
            ];
        })->all();

        return $this->success('User access retrieved.', $items, 200, null, [
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
            'per_page' => $users->perPage(),
            'total' => $users->total(),
            'from' => $users->firstItem(),
            'to' => $users->lastItem(),
        ]);
    }

    public function assignRole(AssignUserRoleRequest $request, User $user, ActivityLogger $activityLogger): JsonResponse
    {
        $role = Role::query()->findOrFail($request->integer('role_id'));

        if ($role->slug === 'super_admin' && ! $request->boolean('confirm_super_admin')) {
            return $this->error('Confirm granting unrestricted Super Admin access.', 422, [
                'confirm_super_admin' => ['Confirmation required to assign Super Admin.'],
            ]);
        }

        $beforeRoles = $user->roles->pluck('name')->all();

        try {
            $user = $this->roles->assignUserRole($request->user(), $user, $role);
            $activityLogger->log(
                $request,
                'user.role_changed',
                'roles',
                $user,
                ['roles' => $beforeRoles],
                ['roles' => $user->roles->pluck('name')->all(), 'role_id' => $role->id],
            );
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('User role updated.', [
            'id' => $user->id,
            'name' => $user->name,
            'roles' => $user->roles->pluck('name')->values(),
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
            ],
        ]);
    }

    public function setStatus(Request $request, User $user, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:active,inactive'],
        ]);

        $status = $data['status'];
        $isActive = $status === 'active';

        if (! $isActive) {
            // Nobody can lock themselves out — including Super Admin.
            if ($request->user()?->id === $user->id) {
                return $this->error('You cannot deactivate your own account.', 422, [
                    'status' => ['You cannot deactivate your own account.'],
                ]);
            }

            try {
                $this->roles->assertNotLastSuperAdmin($user);
            } catch (ValidationException $e) {
                return $this->error(
                    collect($e->errors())->flatten()->first() ?: 'Cannot deactivate the final Super Admin.',
                    422,
                    $e->errors(),
                );
            }
        }

        $before = [
            'status' => $user->status,
            'is_active' => $user->is_active,
        ];

        $user->update([
            'status' => $status,
            'is_active' => $isActive,
        ]);

        // Do not rewrite employment status here — login access is independent of "on leave" / job status.
        if (! $isActive) {
            $user->tokens()->delete();
        }

        $activityLogger->log(
            $request,
            $isActive ? 'user.activated' : 'user.deactivated',
            'users',
            $user,
            $before,
            ['status' => $user->status, 'is_active' => $user->is_active],
        );

        return $this->success($isActive ? 'User account activated.' : 'User account deactivated.', [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'is_active' => $user->is_active,
        ]);
    }

    public function update(Request $request, User $user, ActivityLogger $activityLogger): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'confirm_super_admin' => ['sometimes', 'boolean'],
            'status' => ['nullable', 'string', 'in:active,inactive,suspended'],
        ]);

        $before = $user->only(['name', 'email', 'phone', 'status', 'is_active']);

        try {
            if (isset($data['role_id'])) {
                $role = Role::query()->findOrFail((int) $data['role_id']);
                if ($role->slug === 'super_admin' && ! $request->boolean('confirm_super_admin')) {
                    return $this->error('Confirm granting unrestricted Super Admin access.', 422, [
                        'confirm_super_admin' => ['Confirmation required to assign Super Admin.'],
                    ]);
                }
                $this->roles->assignUserRole($request->user(), $user, $role);
            }

            $updates = [
                'name' => trim($data['name']),
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
            ];
            if (! empty($data['password'])) {
                $updates['password'] = $data['password'];
            }
            if (isset($data['status'])) {
                if ($data['status'] !== 'active') {
                    if ($request->user()?->id === $user->id) {
                        return $this->error('You cannot deactivate your own account.', 422, [
                            'status' => ['You cannot deactivate your own account.'],
                        ]);
                    }
                    $this->roles->assertNotLastSuperAdmin($user);
                    $updates['status'] = $data['status'];
                    $updates['is_active'] = false;
                } else {
                    $updates['status'] = 'active';
                    $updates['is_active'] = true;
                }
            }

            $user->update($updates);
            if (isset($updates['is_active']) && $updates['is_active'] === false) {
                $user->tokens()->delete();
            }

            if ($user->staff) {
                $parts = preg_split('/\s+/', trim($user->name), 2) ?: [$user->name];
                $user->staff->update([
                    'first_name' => $parts[0] ?? $user->name,
                    'last_name' => $parts[1] ?? '',
                    'email' => $user->email,
                    'phone' => $user->phone,
                ]);
            }

            $activityLogger->log($request, 'user.updated', 'users', $user, $before, $user->fresh()->only(['name', 'email', 'phone', 'status', 'is_active']));
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        $user->load(['roles:id,name,slug,is_active', 'staff:id,user_id,employee_id,status']);
        $role = $user->roles->first();

        return $this->success('User updated.', [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'employee_id' => $user->staff?->employee_id,
            'status' => $user->status,
            'is_active' => $user->is_active,
            'role' => $role ? [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
            ] : null,
        ]);
    }

    public function destroy(Request $request, User $user, ActivityLogger $activityLogger): JsonResponse
    {
        if ($request->user()?->id === $user->id) {
            return $this->error('You cannot delete your own account.', 422, [
                'user' => ['You cannot delete your own account.'],
            ]);
        }

        try {
            $this->roles->assertNotLastSuperAdmin($user);
        } catch (ValidationException $e) {
            return $this->error(
                collect($e->errors())->flatten()->first() ?: 'Cannot delete the final Super Admin.',
                422,
                $e->errors(),
            );
        }

        $before = $user->only(['name', 'email', 'status', 'is_active']);
        $user->update(['is_active' => false, 'status' => 'inactive']);
        $user->tokens()->delete();
        $user->roles()->detach();
        if ($user->staff && $user->staff->status === 'active') {
            $user->staff->update(['status' => 'inactive']);
        }
        $user->delete();

        $activityLogger->log($request, 'user.deleted', 'users', $user, $before, [
            'deleted' => true,
            'is_active' => false,
        ]);

        return $this->success('User deleted. Historical sales remain intact.');
    }

    public function effectivePermissions(User $user): JsonResponse
    {
        $roles = $user->roles()->where('roles.is_active', true)->with('permissions:id,name,slug,module')->get();
        $isSuperAdmin = $user->isSuperAdmin();

        if ($isSuperAdmin) {
            $permissions = Permission::query()->orderBy('module')->orderBy('name')->get(['id', 'name', 'slug', 'module']);
        } else {
            $permissions = $roles->flatMap->permissions->unique('id')->values();
        }

        $grouped = $permissions->groupBy('module')->map(fn ($items) => $items->values())->all();

        return $this->success('Effective permissions retrieved.', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'roles' => $roles->pluck('name')->values(),
            'is_super_admin' => $isSuperAdmin,
            'permission_count' => $permissions->count(),
            'permissions' => $permissions->pluck('slug')->values(),
            'grouped' => $grouped,
        ]);
    }
}
