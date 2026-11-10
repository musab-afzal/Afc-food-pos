<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('inventory_items', 'auto_minus')) {
                $table->boolean('auto_minus')->default(false)->after('is_active')->index();
            }
        });

        Schema::create('dish_auto_minus_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dish_id')->constrained('dishes')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->decimal('quantity', 16, 4)->default(1);
            $table->timestamps();

            $table->unique(['dish_id', 'inventory_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dish_auto_minus_items');

        Schema::table('inventory_items', function (Blueprint $table): void {
            if (Schema::hasColumn('inventory_items', 'auto_minus')) {
                $table->dropColumn('auto_minus');
            }
        });
    }
};
