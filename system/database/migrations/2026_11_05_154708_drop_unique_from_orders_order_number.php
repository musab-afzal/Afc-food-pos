<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Daily order numbers reuse ORD-1 each day, so a global unique index cannot stay.
     */
    public function up(): void
    {
        $indexes = Schema::getIndexes('orders');
        $hasUnique = false;
        $hasPlain = false;

        foreach ($indexes as $index) {
            $columns = $index['columns'] ?? [];
            if ($columns !== ['order_number']) {
                continue;
            }
            if (! empty($index['unique'])) {
                $hasUnique = true;
                Schema::table('orders', function (Blueprint $table) use ($index): void {
                    $table->dropUnique($index['name']);
                });
            } else {
                $hasPlain = true;
            }
        }

        // Fallback for drivers that still report the old Laravel name.
        if (! $hasUnique) {
            try {
                Schema::table('orders', function (Blueprint $table): void {
                    $table->dropUnique(['order_number']);
                });
            } catch (\Throwable) {
                // Already removed.
            }
        }

        if (! $hasPlain) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->index('order_number');
            });
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $smIndexes = collect(Schema::getIndexes('orders'));
            $plain = $smIndexes->first(fn ($index) => ($index['columns'] ?? []) === ['order_number'] && empty($index['unique']));
            if ($plain) {
                $table->dropIndex($plain['name']);
            }
            $table->unique('order_number');
        });
    }
};
