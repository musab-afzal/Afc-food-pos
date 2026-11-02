<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ApiResponse;

    /** Report section => permission required to see it in the overview. */
    private const OVERVIEW_SECTIONS = [
        'sales' => 'reports.sales',
        'finance' => 'reports.finance',
        'inventory' => 'reports.inventory',
        'purchases' => 'reports.purchases',
        'staff' => 'reports.staff',
        'delivery' => 'reports.delivery',
    ];

    /** Export type => report permission (products is an alias of dishes). */
    private const EXPORT_PERMISSIONS = [
        'sales' => 'reports.sales',
        'dishes' => 'reports.sales',
        'products' => 'reports.sales',
        'finance' => 'reports.finance',
        'inventory' => 'reports.inventory',
        'purchases' => 'reports.purchases',
        'staff' => 'reports.staff',
        'waiters' => 'reports.staff,reports.sales',
        'delivery' => 'reports.delivery',
        'kitchen' => 'reports.kitchen',
        'customers' => 'reports.customers',
    ];

    public function __construct(private readonly ReportService $reports) {}

    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Sales report retrieved.', $this->reports->sales($from, $to));
    }

    public function dishes(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $extra = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100']]);
        $limit = (int) ($extra['limit'] ?? 10);

        return $this->success('Dishes report retrieved.', $this->reports->dishes($from, $to, $limit));
    }

    public function inventory(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Inventory report retrieved.', $this->reports->inventory($from, $to));
    }

    public function purchases(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Purchases report retrieved.', $this->reports->purchases($from, $to));
    }

    public function finance(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Finance report retrieved.', $this->reports->finance($from, $to));
    }

    public function staff(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Staff report retrieved.', $this->reports->staff($from, $to));
    }

    public function waiters(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $extra = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100']]);

        return $this->success('Waiters report retrieved.', $this->reports->waiters($from, $to, (int) ($extra['limit'] ?? 10)));
    }

    public function delivery(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Delivery report retrieved.', $this->reports->delivery($from, $to));
    }

    public function kitchen(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->success('Kitchen report retrieved.', $this->reports->kitchen($from, $to));
    }

    public function customers(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $extra = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100']]);

        return $this->success('Customers report retrieved.', $this->reports->customers($from, $to, (int) ($extra['limit'] ?? 10)));
    }

    /** CSV download of any report. Requires reports.export AND the report's own permission. */
    public function export(Request $request, string $type): StreamedResponse|JsonResponse
    {
        $permission = self::EXPORT_PERMISSIONS[$type] ?? null;
        if ($permission === null) {
            return $this->error('Unknown report type.', 404);
        }

        $user = $request->user();
        // A comma-separated value means "any of these permissions".
        $hasReportPermission = collect(explode(',', $permission))->contains(fn (string $slug): bool => $user->hasPermission($slug));
        if (! $user->hasPermission('reports.export') || ! $hasReportPermission) {
            return $this->error('You do not have permission to perform this action.', 403);
        }

        [$from, $to] = $this->period($request);
        $extra = $request->validate([
            'format' => ['nullable', 'in:csv'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $export = $this->reports->export($type, $from, $to, (int) ($extra['limit'] ?? 10));

        return response()->streamDownload(function () use ($export): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel opens non-ASCII names correctly
            foreach ($export['rows'] as $row) {
                fputcsv($out, array_map($this->safeCell(...), $row), ',', '"', '');
            }
            fclose($out);
        }, $export['filename'], ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Neutralise spreadsheet formula injection in text cells (numbers are left untouched). */
    private function safeCell(mixed $value): mixed
    {
        if (is_string($value) && $value !== '' && ! is_numeric($value) && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }

    public function overview(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $user = $request->user();

        $sections = array_keys(array_filter(
            self::OVERVIEW_SECTIONS,
            fn (string $permission): bool => $user->hasPermission($permission),
        ));

        return $this->success('Reports overview retrieved.', $this->reports->overview($from, $to, $sections));
    }

    /** @return array{0: ?string, 1: ?string} */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return [$data['from'] ?? null, $data['to'] ?? null];
    }
}
