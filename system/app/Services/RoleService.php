<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RoleService
{
    public function isSuperAdminRole(Role $role): bool
    {
        return $role->slug === 'super_admin';
    }

    public function assertCanModifyRole(Role $role, bool $deleting = false): void
    {
        if ($this->isSuperAdminRole($role)) {
            if ($deleting) {
                throw ValidationException::withMessages(['role' => ['Super Admin role cannot be deleted.']]);
            }
        }
    }

    public function assertCanDisableRole(Role $role): void
    {
        if ($this->isSuperAdminRole($role)) {
            throw ValidationException::withMessages(['role' => ['Super Admin role cannot be disabled.']]);
        }
    }

    public function assertNotLastSuperAdmin(User $user): void
    {
        if (! $user->isSuperAdmin()) {
            return;
        }

        $activeSuperAdmins = User::query()
            ->where('is_active', true)
            ->where('status', 'active')
            ->whereHas('roles', fn ($q) => $q->where('slug', 'super_admin')->where('roles.is_active', true))
            ->count();

        if ($activeSuperAdmins <= 1) {
            throw ValidationException::withMessages([
                'role' => ['You cannot remove or downgrade the final active Super Admin.'],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $permissionIds
     */
    public function create(array $data, array $permissionIds = []): Role
    {
        return DB::transaction(function () use ($data, $permissionIds): Role {
            $slug = $data['slug'] ?? Str::slug($data['name']);
            if ($slug === 'super_admin') {
                throw ValidationException::withMessages(['slug' => ['Cannot create another Super Admin role.']]);
            }

            $role = Role::query()->create([
                'name' => $data['name'],
                'slug' => $slug,
                'description' => $data['description'] ?? null,
                'max_discount_percent' => $data['max_discount_percent'] ?? 0,
                'is_system' => false,
                'is_active' => $data['is_active'] ?? true,
            ]);

            $role->permissions()->sync($this->sanitizePermissionIds($permissionIds));

            return $role->load('permissions')->loadCount('users');
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>|null  $permissionIds
     */
    public function update(Role $role, array $data, ?array $permissionIds = null): Role
    {
        return DB::transaction(function () use ($role, $data, $permissionIds): Role {
            $this->assertCanModifyRole($role);

            if ($this->isSuperAdminRole($role)) {
                // Super Admin role: allow description/discount display only; keep active + slug.
                $role->update([
                    'description' => $data['description'] ?? $role->description,
                    'max_discount_percent' => 100,
                    'is_active' => true,
                    'name' => 'Super Admin',
                    'slug' => 'super_admin',
                ]);
                $role->permissions()->sync(Permission::query()->pluck('id')->all());

                return $role->fresh()->load('permissions')->loadCount('users');
            }

            if (array_key_exists('is_active', $data) && ! $data['is_active']) {
                $this->assertCanDisableRole($role);
            }

            $payload = [
                'name' => $data['name'] ?? $role->name,
                'description' => $data['description'] ?? $role->description,
                'max_discount_percent' => $data['max_discount_percent'] ?? $role->max_discount_percent,
                'is_active' => $data['is_active'] ?? $role->is_active,
            ];

            if (! empty($data['slug']) && ! $role->is_system) {
                $slug = Str::slug($data['slug']);
                if ($slug === 'super_admin') {
                    throw ValidationException::withMessages(['slug' => ['Cannot rename a role to Super Admin.']]);
                }
                $payload['slug'] = $slug;
            }

            $role->update($payload);

            if ($permissionIds !== null) {
                $role->permissions()->sync($this->sanitizePermissionIds($permissionIds));
            }

            return $role->fresh()->load('permissions')->loadCount('users');
        });
    }

    public function archive(Role $role): void
    {
        DB::transaction(function () use ($role): void {
            $this->assertCanModifyRole($role, deleting: true);
            if ($role->is_system) {
                throw ValidationException::withMessages(['role' => ['System roles cannot be deleted.']]);
            }
            if ($role->users()->exists()) {
                throw ValidationException::withMessages([
                    'role' => ['Role is assigned to users. Reassign them before deleting.'],
                ]);
            }
            $role->permissions()->detach();
            $role->delete();
        });
    }

    /**
     * Soft-disable without deleting.
     */
    public function setActive(Role $role, bool $active): Role
    {
        if (! $active) {
            $this->assertCanDisableRole($role);
        }

        $role->update(['is_active' => $active]);

        return $role->fresh()->loadCount('users');
    }

    /**
     * @param  list<int>  $permissionIds
     */
    public function syncPermissions(Role $role, array $permissionIds): Role
    {
        return DB::transaction(function () use ($role, $permissionIds): Role {
            if ($this->isSuperAdminRole($role)) {
                $role->permissions()->sync(Permission::query()->pluck('id')->all());

                return $role->fresh()->load('permissions')->loadCount('users');
            }

            $role->permissions()->sync($this->sanitizePermissionIds($permissionIds));

            return $role->fresh()->load('permissions')->loadCount('users');
        });
    }

    public function clone(Role $source, string $name, ?string $slug = null): Role
    {
        return DB::transaction(function () use ($source, $name, $slug): Role {
            $newSlug = $slug ? Str::slug($slug) : Str::slug($name);
            if ($newSlug === 'super_admin') {
                throw ValidationException::withMessages(['slug' => ['Cannot clone into Super Admin.']]);
            }

            $role = Role::query()->create([
                'name' => $name,
                'slug' => $newSlug,
                'description' => $source->description,
                'max_discount_percent' => $source->max_discount_percent,
                'is_system' => false,
                'is_active' => true,
            ]);

            $role->permissions()->sync($source->permissions()->pluck('permissions.id')->all());

            return $role->load('permissions')->loadCount('users');
        });
    }

    public function assignUserRole(User $actor, User $target, Role $role): User
    {
        return DB::transaction(function () use ($actor, $target, $role): User {
            if (! $role->is_active) {
                throw ValidationException::withMessages(['role_id' => ['Cannot assign an inactive role.']]);
            }

            if ($this->isSuperAdminRole($role) && ! $actor->isSuperAdmin()) {
                throw ValidationException::withMessages(['role_id' => ['Only Super Admin can assign the Super Admin role.']]);
            }

            $wasSuperAdmin = $target->isSuperAdmin();
            if ($wasSuperAdmin && ! $this->isSuperAdminRole($role)) {
                $this->assertNotLastSuperAdmin($target);
            }

            $target->roles()->sync([$role->id]);

            return $target->fresh()->load('roles.permissions');
        });
    }

    /**
     * @param  list<int>  $permissionIds
     * @return list<int>
     */
    private function sanitizePermissionIds(array $permissionIds): array
    {
        $ids = collect($permissionIds)->map(fn ($id) => (int) $id)->filter()->unique()->values()->all();

        $valid = Permission::query()->whereIn('id', $ids)->pluck('id')->all();
        if (count($valid) !== count($ids)) {
            throw ValidationException::withMessages(['permission_ids' => ['One or more permissions are invalid.']]);
        }

        return $valid;
    }
}
