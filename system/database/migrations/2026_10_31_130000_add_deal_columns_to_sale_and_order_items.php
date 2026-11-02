<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['sale_items', 'order_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('deal_id')->nullable()->after('dish_variant_id')->constrained()->nullOnDelete();
                $table->string('deal_name')->nullable()->after('deal_id');
            });
        }
    }

    public function down(): void
    {
        foreach (['sale_items', 'order_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('deal_id');
                $table->dropColumn('deal_name');
            });
        }
    }
};
