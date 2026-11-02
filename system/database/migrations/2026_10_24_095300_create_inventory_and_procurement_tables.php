<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('inventory_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact_person')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->decimal('opening_balance', 14, 2)->default(0);
            $table->decimal('current_payable', 14, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_category_id')->constrained()->restrictOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('preferred_supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('barcode')->nullable()->unique();
            $table->string('unit', 30);
            $table->decimal('current_stock', 16, 4)->default(0);
            $table->decimal('minimum_stock', 16, 4)->default(0);
            $table->decimal('reorder_level', 16, 4)->default(0);
            $table->decimal('average_cost', 14, 4)->default(0);
            $table->decimal('latest_purchase_cost', 14, 4)->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_active', 'current_stock']);
        });

        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_variant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->timestamps();
            $table->unique(['dish_id', 'dish_variant_id']);
        });

        Schema::create('recipe_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 16, 4);
            $table->string('unit', 30);
            $table->decimal('wastage_percent', 5, 2)->default(0);
            $table->timestamps();
            $table->unique(['recipe_id', 'inventory_item_id']);
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('purchase_number')->unique();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->date('purchase_date')->index();
            $table->string('invoice_reference')->nullable();
            $table->string('status', 30)->default('draft')->index();
            $table->string('payment_status', 30)->default('unpaid')->index();
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('other_charges', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->decimal('paid', 14, 2)->default(0);
            $table->decimal('remaining', 14, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 16, 4);
            $table->string('unit', 30);
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('total', 14, 2);
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 40)->index();
            $table->decimal('quantity', 16, 4);
            $table->decimal('before_quantity', 16, 4);
            $table->decimal('after_quantity', 16, 4);
            $table->decimal('unit_cost', 14, 4)->default(0);
            $table->nullableMorphs('reference');
            $table->text('notes')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
            $table->index(['inventory_item_id', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('recipe_items');
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('inventory_categories');
    }
};
