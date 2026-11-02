<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_items', function (Blueprint $table): void {
            $table->decimal('quantity_received', 16, 4)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_items', function (Blueprint $table): void {
            $table->dropColumn('quantity_received');
        });
    }
};
