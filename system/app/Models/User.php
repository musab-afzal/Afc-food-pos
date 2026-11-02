<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'phone', 'avatar', 'password', 'is_active', 'status', 'last_login_at', 'last_login_ip'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function staff(): HasOne
    {
        return $this->hasOne(Staff::class);
    }

    public function isLoginBlocked(): bool
    {
        return ! $this->is_active || in_array($this->status, ['inactive', 'suspended'], true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->roles()
            ->where('roles.is_active', true)
            ->where('roles.slug', 'super_admin')
            ->exists();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->roles()
            ->where('roles.is_active', true)
            ->whereHas('permissions', fn ($query) => $query->where('slug', $permission))
            ->exists();
    }

    /** @return list<string> */
    public function permissionSlugs(): array
    {
        if ($this->isSuperAdmin()) {
            return Permission::query()->orderBy('slug')->pluck('slug')->all();
        }

        return $this->roles()
            ->where('roles.is_active', true)
            ->with('permissions:id,slug')
            ->get()
            ->flatMap->permissions
            ->pluck('slug')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }
}
