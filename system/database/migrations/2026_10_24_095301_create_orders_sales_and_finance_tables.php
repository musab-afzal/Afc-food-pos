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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone', 30)->nullable()->index();
            $table->string('email')->nullable()->index();
            $table->text('address')->nullable();
            $table->unsignedInteger('loyalty_points')->default(0);
            $table->decimal('credit_limit', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('order_number')->unique();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('restaurant_table_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 30)->default('pos')->index();
            $table->string('order_type', 30)->index();
            $table->string('status', 30)->default('pending')->index();
            $table->text('delivery_address')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('subtotal', 14, 2);
            $table->decimal('discount_total', 14, 2)->default(0);
            $table->decimal('tax_total', 14, 2)->default(0);
            $table->decimal('service_charge', 14, 2)->default(0);
            $table->decimal('delivery_charge', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2);
            $table->timestamp('ordered_at')->index();
            $table->timestamps();
            $table->index(['status', 'ordered_at']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('dish_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('dish_name');
            $table->string('variant_name')->nullable();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('total', 14, 2);
            $table->text('notes')->nullable();
            $table->string('kitchen_status', 30)->default('pending')->index();
            $table->timestamps();
        });

        Schema::create('order_item_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('addon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('price', 14, 2);
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('total', 14, 2);
            $table->timestamps();
        });

        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('invoice_number')->unique();
            $table->foreignId('order_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('restaurant_table_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete();
            $table->string('order_type', 30)->index();
            $table->string('status', 30)->default('completed')->index();
            $table->boolean('was_offline')->default(false)->index();
            $table->decimal('subtotal', 14, 2);
            $table->decimal('discount_total', 14, 2)->default(0);
            $table->decimal('tax_total', 14, 2)->default(0);
            $table->decimal('service_charge', 14, 2)->default(0);
            $table->decimal('delivery_charge', 14, 2)->default(0);
            $table->decimal('rounding', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2);
            $table->decimal('paid_total', 14, 2);
            $table->decimal('change_total', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('sold_at')->index();
            $table->timestamps();
            $table->index(['cashier_id', 'sold_at']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('dish_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('dish_name');
            $table->string('sku');
            $table->string('variant_name')->nullable();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('unit_cost', 14, 4)->default(0);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('total', 14, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_item_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('addon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('price', 14, 2);
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('total', 14, 2);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('reference')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('sale_item_addons');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('order_item_addons');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('customers');
    }
};
