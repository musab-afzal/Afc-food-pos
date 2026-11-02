<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 30)->default('active')->index()->after('is_active');
        });

        Schema::create('areas', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->foreignId('area_id')->nullable()->after('id')->constrained('areas')->nullOnDelete();
            $table->string('table_number', 30)->nullable()->after('name');
            $table->string('shape', 30)->default('square')->after('capacity');
            $table->unsignedInteger('sort_order')->default(0)->after('status');
        });

        Schema::create('customer_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_code')->nullable()->unique()->after('id');
            $table->foreignId('customer_group_id')->nullable()->after('customer_code')->constrained()->nullOnDelete();
            $table->string('alternate_mobile', 30)->nullable()->after('phone');
            $table->date('date_of_birth')->nullable()->after('email');
            $table->string('gender', 20)->nullable()->after('date_of_birth');
            $table->string('city', 100)->nullable()->after('address');
        });

        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name');
            $table->string('phone', 30)->nullable();
            $table->unsignedSmallInteger('guests')->default(1);
            $table->date('reservation_date')->index();
            $table->time('reservation_time');
            $table->foreignId('restaurant_table_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->text('special_request')->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['reservation_date', 'status']);
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('short_name')->unique();
            $table->string('type', 40)->index();
            $table->foreignId('base_unit_id')->nullable()->constrained('units')->nullOnDelete();
            $table->decimal('conversion_factor', 16, 6)->default(1);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('modifier_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('is_required')->default(false);
            $table->unsignedSmallInteger('min_selections')->default(0);
            $table->unsignedSmallInteger('max_selections')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('modifiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modifier_group_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('additional_price', 14, 2)->default(0);
            $table->decimal('additional_cost', 14, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['modifier_group_id', 'is_active']);
        });

        Schema::create('dish_modifier_group', function (Blueprint $table) {
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->foreignId('modifier_group_id')->constrained()->cascadeOnDelete();
            $table->primary(['dish_id', 'modifier_group_id']);
        });

        Schema::create('kitchen_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('ticket_number')->unique();
            $table->string('status', 30)->default('new')->index();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'status']);
        });

        Schema::create('kitchen_ticket_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kitchen_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->string('status', 30)->default('pending')->index();
            $table->timestamps();
        });

        Schema::create('held_orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete();
            $table->json('payload');
            $table->string('order_type', 30)->index();
            $table->foreignId('restaurant_table_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('taxes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('percentage', 8, 4)->default(0);
            $table->boolean('is_inclusive')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('charges', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('type', 20)->default('fixed');
            $table->decimal('value', 14, 4)->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->string('apply_to', 40)->default('all');
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('type', 30)->default('cash')->index();
            $table->decimal('opening_balance', 14, 2)->default(0);
            $table->decimal('current_balance', 14, 2)->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_number')->unique();
            $table->date('date')->index();
            $table->string('type', 30)->index();
            $table->string('category')->nullable()->index();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->nullableMorphs('reference');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['type', 'date']);
        });

        Schema::create('cash_register_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40)->index();
            $table->decimal('amount', 14, 2);
            $table->nullableMorphs('reference');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });

        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 20);
            $table->decimal('value', 14, 4);
            $table->string('applies_to', 40)->default('order')->index();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('min_order', 14, 2)->default(0);
            $table->decimal('max_discount', 14, 2)->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('type', 20);
            $table->decimal('value', 14, 4);
            $table->decimal('min_order', 14, 2)->default(0);
            $table->decimal('max_discount', 14, 2)->nullable();
            $table->date('start_date')->index();
            $table->date('expiry_date')->index();
            $table->unsignedInteger('total_usage_limit')->nullable();
            $table->unsignedInteger('per_customer_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('coupon_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('discount_amount', 14, 2);
            $table->timestamp('used_at');
            $table->timestamps();
            $table->index(['coupon_id', 'customer_id']);
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('type', 30)->index();
            $table->integer('points');
            $table->integer('balance_after');
            $table->nullableMorphs('reference');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['customer_id', 'created_at']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 60)->index();
            $table->string('title');
            $table->text('message');
            $table->string('link')->nullable();
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamps();
            $table->index(['user_id', 'read_at']);
        });

        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('grace_minutes')->default(15);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('employee_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->foreignId('shift_id')->constrained()->cascadeOnDelete();
            $table->date('effective_from')->nullable();
            $table->timestamps();
            $table->unique(['staff_id', 'shift_id']);
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->date('date');
            $table->timestamp('check_in')->nullable();
            $table->timestamp('check_out')->nullable();
            $table->unsignedInteger('working_minutes')->default(0);
            $table->unsignedInteger('late_minutes')->default(0);
            $table->unsignedInteger('overtime_minutes')->default(0);
            $table->string('status', 30)->default('present')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['staff_id', 'date']);
        });

        Schema::create('leaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->string('leave_type', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->text('reason')->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['staff_id', 'start_date', 'end_date']);
        });

        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->text('address');
            $table->string('phone', 30);
            $table->foreignId('rider_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('delivery_charge', 14, 2)->default(0);
            $table->decimal('cod_amount', 14, 2)->default(0);
            $table->string('status', 40)->default('awaiting_assignment')->index();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('on_the_way_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('rider_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rider_id')->constrained()->restrictOnDelete();
            $table->string('settlement_number')->unique();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('total_cod', 14, 2)->default(0);
            $table->decimal('commission', 14, 2)->default(0);
            $table->decimal('paid_to_restaurant', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->string('status', 30)->default('draft')->index();
            $table->timestamp('settled_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['rider_id', 'period_start', 'period_end']);
        });

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('type', 20)->index();
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->date('adjustment_date')->index();
            $table->timestamps();
        });

        Schema::create('stock_adjustment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_adjustment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 16, 4);
            $table->string('unit', 30);
            $table->decimal('unit_cost', 14, 4)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustment_items');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('rider_settlements');
        Schema::dropIfExists('deliveries');
        Schema::dropIfExists('leaves');
        Schema::dropIfExists('attendance');
        Schema::dropIfExists('employee_shifts');
        Schema::dropIfExists('shifts');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('coupon_usages');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('discounts');
        Schema::dropIfExists('cash_register_transactions');
        Schema::dropIfExists('financial_transactions');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('charges');
        Schema::dropIfExists('taxes');
        Schema::dropIfExists('held_orders');
        Schema::dropIfExists('kitchen_ticket_items');
        Schema::dropIfExists('kitchen_tickets');
        Schema::dropIfExists('dish_modifier_group');
        Schema::dropIfExists('modifiers');
        Schema::dropIfExists('modifier_groups');
        Schema::dropIfExists('units');
        Schema::dropIfExists('reservations');

        Schema::table('customers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_group_id');
            $table->dropColumn(['customer_code', 'alternate_mobile', 'date_of_birth', 'gender', 'city']);
        });

        Schema::dropIfExists('customer_groups');

        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->dropConstrainedForeignId('area_id');
            $table->dropColumn(['table_number', 'shape', 'sort_order']);
        });

        Schema::dropIfExists('areas');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
