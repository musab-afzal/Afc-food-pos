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
