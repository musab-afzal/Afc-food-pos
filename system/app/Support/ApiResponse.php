<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    /**
     * @param  mixed  $data
     * @param  array<string, mixed>|null  $errors
     * @param  array<string, mixed>|null  $meta
     */
    protected function success(string $message = 'OK', mixed $data = null, int $status = 200, ?array $errors = null, ?array $meta = null): JsonResponse
    {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'errors' => $errors,
        ];

        if ($meta !== null) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    /**
     * @param  array<string, mixed>|null  $errors
     * @param  mixed  $data
     */
    protected function error(string $message = 'Error', int $status = 400, ?array $errors = null, mixed $data = null): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => $data,
            'errors' => $errors,
        ], $status);
    }

    protected function paginated(string $message, LengthAwarePaginator $paginator): JsonResponse
    {
        return $this->success($message, $paginator->items(), 200, null, [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ]);
    }
}
