<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\ActivityLogger;
use App\Services\SettingsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingController extends Controller
{
    use ApiResponse;

    public function index(Request $request, SettingsService $settings): JsonResponse
    {
        $user = $request->user();
        if (! $user?->hasPermission('settings.view') && ! $user?->hasPermission('settings.manage')) {
            abort(403, 'You do not have permission to perform this action.');
        }

        $group = $request->string('group')->toString();

        if ($group !== '') {
            return $this->success('Settings retrieved.', $settings->getGroup($group));
        }

        $flat = $settings->all()->mapWithKeys(
            fn (array $row) => [$row['key'] => $settings->get($row['key'])]
        )->all();

        return $this->success('Settings retrieved.', $flat);
    }

    public function update(Request $request, SettingsService $settings, ActivityLogger $activityLogger): JsonResponse
    {
        if (! $request->user()?->hasPermission('settings.manage')) {
            abort(403, 'You do not have permission to perform this action.');
        }

        $validated = $request->validate([
            'settings' => ['required', 'array', 'min:1'],
            'settings.*.key' => ['required', 'string', 'max:150'],
            'settings.*.value' => ['nullable'],
            'settings.*.type' => ['nullable', 'string', 'in:string,boolean,bool,integer,int,float,double,decimal,number,json,array'],
            'settings.*.group' => ['nullable', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($validated, $settings, $request, $activityLogger): void {
            $before = $settings->all()->keyBy('key')->all();

            $normalized = collect($validated['settings'])->map(function (array $item): array {
                $type = $item['type'] ?? 'string';
                if ($type === 'number') {
                    $type = 'decimal';
                }
                $value = $item['value'] ?? null;
                if (is_bool($value)) {
                    $value = $value ? '1' : '0';
                    $type = 'boolean';
                }

                return [
                    'key' => $item['key'],
                    'value' => $value,
                    'type' => $type,
                    'group' => $item['group'] ?? 'general',
                ];
            })->all();

            $settings->setMany($normalized);
            $after = $settings->all()->keyBy('key')->all();
            $subject = Setting::query()->where('key', $normalized[0]['key'])->first() ?? new Setting;
            $activityLogger->log($request, 'settings.updated', 'settings', $subject, $before, $after);
        });

        $group = $validated['settings'][0]['group'] ?? null;

        return $this->success(
            'Settings updated.',
            $group ? $settings->getGroup($group) : $settings->all()->mapWithKeys(
                fn (array $row) => [$row['key'] => $settings->get($row['key'])]
            )->all()
        );
    }
}
