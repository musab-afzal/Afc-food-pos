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
        Schema::create('wastages', function (Blueprint $table) {
            $table->id();
            $table->string('wastage_number')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('reason', 40);
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->date('wastage_date')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('wastage_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wastage_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 16, 4);
            $table->string('unit', 30);
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('total_cost', 14, 2);
            $table->timestamps();
        });

        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_number')->unique();
            $table->foreignId('expense_category_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('expense_date')->index();
            $table->string('reference')->nullable();
            $table->text('description')->nullable();
            $table->string('attachment')->nullable();
            $table->timestamps();
        });

        Schema::create('incomes', function (Blueprint $table) {
            $table->id();
            $table->string('income_number')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category');
            $table->decimal('amount', 14, 2);
            $table->date('income_date')->index();
            $table->string('reference')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status', 20)->default('open')->index();
            $table->decimal('opening_amount', 14, 2);
            $table->decimal('expected_closing', 14, 2)->nullable();
            $table->decimal('actual_closing', 14, 2)->nullable();
            $table->decimal('difference', 14, 2)->nullable();
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('refund_number')->unique();
            $table->foreignId('sale_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('reason');
            $table->boolean('restore_inventory')->default(false);
            $table->timestamp('refunded_at')->index();
            $table->timestamps();
        });

        Schema::create('refund_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('amount', 14, 2);
            $table->timestamps();
        });

        Schema::create('riders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('phone', 30);
            $table->string('vehicle_number')->nullable();
            $table->string('status', 30)->default('available')->index();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rider_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('rider_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->string('status', 30)->default('assigned')->index();
            $table->timestamp('assigned_at');
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->decimal('cod_amount', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action')->index();
            $table->string('module')->index();
            $table->nullableMorphs('subject');
            $table->json('before_data')->nullable();
            $table->json('after_data')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('sync_records', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('status', 30)->index();
            $table->json('metadata')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_records');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('rider_assignments');
        Schema::dropIfExists('riders');
        Schema::dropIfExists('refund_items');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('incomes');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('wastage_items');
        Schema::dropIfExists('wastages');
    }
};
