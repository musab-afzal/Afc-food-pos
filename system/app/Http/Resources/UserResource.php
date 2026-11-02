<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'is_active' => $this->is_active,
            'status' => $this->status,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()),
            'role_slugs' => $this->whenLoaded('roles', fn () => $this->roles->pluck('slug')->values()),
            'permissions' => $this->permissionSlugs(),
            'is_super_admin' => $this->isSuperAdmin(),
            'last_login_at' => $this->last_login_at,
        ];
    }
}
