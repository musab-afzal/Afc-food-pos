<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloneRoleRequest;
use App\Http\Requests\UpdateRolePermissionsRequest;
use App\Http\Requests\UpsertRoleRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\RoleService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoleController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'type' => ['nullable', 'string', 'in:system,custom'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $roles = Role::query()
            ->with('permissions:id,name,slug,module')
            ->withCount('users')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $query->where(fn ($nested) => $nested
                    ->where('name', 'like', $search)
                    ->orWhere('slug', 'like', $search)
                    ->orWhere('description', 'like', $search));
            })
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->string('type')->value() === 'system', fn ($query) => $query->where('is_system', true))
            ->when($request->string('type')->value() === 'custom', fn ($query) => $query->where('is_system', false))
            ->orderByRaw("CASE WHEN slug = 'super_admin' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50))
            ->withQueryString();

        return $this->paginated('Roles retrieved.', $roles);
    }

    /**
     * Slim list for staff forms — not role administration.
     */
    public function options(Request $request): JsonResponse
    {
        $actor = $request->user();

        $roles = Role::query()
            ->where('is_active', true)
            ->when(! $actor?->isSuperAdmin(), fn ($q) => $q->where('slug', '!=', 'super_admin'))
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);

        return $this->success('Role options retrieved.', $roles);
    }

    public function store(UpsertRoleRequest $request, ActivityLogger $activityLogger): JsonResponse
    {
        try {
            $role = $this->roles->create(
                $request->safe()->except('permission_ids'),
                $request->input('permission_ids', []),
            );
            $activityLogger->log($request, 'role.created', 'roles', $role, after: $role->toArray());
        } catch (ValidationException $e) {
            return $this->error($e->getMessage() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Role created.', $role, 201);
    }

    public function show(Role $role): JsonResponse
    {
        return $this->success('Role retrieved.', $role->load('permissions')->loadCount('users'));
    }

    public function update(UpsertRoleRequest $request, Role $role, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $role->load('permissions')->toArray();

        try {
            $role = $this->roles->update(
                $role,
                $request->safe()->except('permission_ids'),
                $request->has('permission_ids') ? $request->input('permission_ids', []) : null,
            );
            $activityLogger->log($request, 'role.updated', 'roles', $role, $before, $role->toArray());
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Role updated.', $role);
    }

    public function syncPermissions(UpdateRolePermissionsRequest $request, Role $role, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $role->load('permissions')->toArray();

        try {
            $role = $this->roles->syncPermissions($role, $request->input('permission_ids', []));
            $activityLogger->log($request, 'role.permissions_updated', 'roles', $role, $before, $role->toArray());
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Role permissions updated.', $role);
    }

    public function clone(CloneRoleRequest $request, Role $role, ActivityLogger $activityLogger): JsonResponse
    {
        try {
            $cloned = $this->roles->clone(
                $role,
                $request->string('name')->value(),
                $request->input('slug'),
            );
            if ($request->boolean('copy_permissions', true) === false) {
                $cloned->permissions()->sync([]);
                $cloned = $cloned->fresh()->load('permissions')->loadCount('users');
            }
            $activityLogger->log($request, 'role.cloned', 'roles', $cloned, before: ['source_role_id' => $role->id], after: $cloned->toArray());
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Role cloned.', $cloned, 201);
    }

    public function setActive(Request $request, Role $role, ActivityLogger $activityLogger): JsonResponse
    {
        $request->validate(['is_active' => ['required', 'boolean']]);
        $before = $role->toArray();

        try {
            $role = $this->roles->setActive($role, $request->boolean('is_active'));
            $activityLogger->log(
                $request,
                $request->boolean('is_active') ? 'role.enabled' : 'role.disabled',
                'roles',
                $role,
                $before,
                $role->toArray(),
            );
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success($request->boolean('is_active') ? 'Role enabled.' : 'Role disabled.', $role);
    }

    public function destroy(Request $request, Role $role, ActivityLogger $activityLogger): JsonResponse
    {
        $before = $role->loadCount('users')->toArray();

        try {
            $this->roles->archive($role);
            $activityLogger->log($request, 'role.deleted', 'roles', $role, $before, null);
        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first() ?: 'Validation failed.', 422, $e->errors());
        }

        return $this->success('Role deleted.');
    }

    public function users(Role $role): JsonResponse
    {
        $users = $role->users()
            ->with('staff:id,user_id,employee_id,first_name,last_name,status')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'is_active' => $user->is_active,
                'employee_id' => $user->staff?->employee_id,
                'assigned_since' => $user->pivot?->created_at,
                'last_login_at' => $user->last_login_at,
            ]);

        return $this->success('Role users retrieved.', $users);
    }

    public function activity(Request $request, Role $role): JsonResponse
    {
        $logs = DB::table('activity_logs')
            ->where('module', 'roles')
            ->where(function ($query) use ($role): void {
                $query->where(function ($inner) use ($role): void {
                    $inner->where('subject_type', Role::class)->where('subject_id', $role->id);
                })->orWhere('after_data', 'like', '%"id":'.$role->id.'%')
                    ->orWhere('before_data', 'like', '%"id":'.$role->id.'%');
            })
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $userIds = $logs->pluck('user_id')->filter()->unique()->values();
        $users = User::query()->whereIn('id', $userIds)->get(['id', 'name'])->keyBy('id');

        $items = $logs->map(fn ($log) => [
            'id' => $log->id,
            'action' => $log->action,
            'module' => $log->module,
            'actor' => $users->get($log->user_id)?->name,
            'actor_user_id' => $log->user_id,
            'before' => $log->before_data ? json_decode($log->before_data, true) : null,
            'after' => $log->after_data ? json_decode($log->after_data, true) : null,
            'ip_address' => $log->ip_address,
            'created_at' => $log->created_at,
        ]);

        return $this->success('Role activity retrieved.', $items);
    }
}
