<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', 'string', 'max:100'],
            'grouped' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:200'],
        ]);

        $query = Permission::query()
            ->when($request->filled('search'), function ($builder) use ($request): void {
                $search = '%'.$request->string('search')->value().'%';
                $builder->where(fn ($nested) => $nested->where('name', 'like', $search)->orWhere('slug', 'like', $search));
            })
            ->when($request->filled('module'), fn ($builder) => $builder->where('module', $request->string('module')->value()))
            ->orderBy('module')
            ->orderBy('name');

        if ($request->boolean('grouped')) {
            $permissions = $query->get()->groupBy('module');

            return $this->success('Permissions retrieved.', $permissions);
        }

        if ($request->integer('per_page', 0) > 0) {
            return $this->paginated('Permissions retrieved.', $query->paginate($request->integer('per_page', 50))->withQueryString());
        }

        return $this->success('Permissions retrieved.', $query->get());
    }

    public function show(Permission $permission): JsonResponse
    {
        return $this->success('Permission retrieved.', $permission->load('roles:id,name,slug'));
    }
}
