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
        Schema::create('restaurant_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->longText('value')->nullable();
            $table->string('type', 30)->default('string');
            $table->string('group')->index();
            $table->timestamps();
        });

        Schema::create('restaurant_tables', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedSmallInteger('capacity')->default(2);
            $table->uuid('qr_token')->unique();
            $table->string('status', 30)->default('available')->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('logo')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('dishes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku')->unique();
            $table->string('barcode')->nullable()->unique();
            $table->text('description')->nullable();
            $table->string('short_description', 500)->nullable();
            $table->string('image')->nullable();
            $table->decimal('base_price', 14, 2);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->unsignedSmallInteger('preparation_minutes')->default(10);
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_available')->default(true)->index();
            $table->boolean('dine_in_enabled')->default(true);
            $table->boolean('takeaway_enabled')->default(true);
            $table->boolean('delivery_enabled')->default(true);
            $table->boolean('qr_enabled')->default(true);
            $table->boolean('pos_enabled')->default(true)->index();
            $table->boolean('kitchen_enabled')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['category_id', 'is_active', 'is_available']);
        });

        Schema::create('dish_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('dish_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('sku')->unique();
            $table->decimal('price', 14, 2);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['dish_id', 'name']);
        });

        Schema::create('addons', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('price', 14, 2);
            $table->decimal('cost', 14, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('addon_dish', function (Blueprint $table) {
            $table->foreignId('addon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->primary(['addon_id', 'dish_id']);
        });

        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('icon')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('requires_reference')->default(false);
            $table->boolean('works_offline')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('addon_dish');
        Schema::dropIfExists('addons');
        Schema::dropIfExists('dish_variants');
        Schema::dropIfExists('dish_images');
        Schema::dropIfExists('dishes');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('restaurant_tables');
        Schema::dropIfExists('restaurant_settings');
    }
};
