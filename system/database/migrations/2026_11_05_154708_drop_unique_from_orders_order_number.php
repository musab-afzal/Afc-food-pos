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
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique(['order_number']);
            $table->index('order_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['order_number']);
            $table->unique('order_number');
        });
    }
};
