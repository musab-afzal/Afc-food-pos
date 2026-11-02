<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('purchase_items', 'quantity_received')) {
            Schema::table('purchase_items', function (Blueprint $table): void {
                $table->decimal('quantity_received', 16, 4)->default(0)->after('quantity');
            });
        }

        if (! Schema::hasTable('purchase_receipts')) {
            Schema::create('purchase_receipts', function (Blueprint $table): void {
                $table->id();
                $table->string('receipt_number')->unique();
                $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->date('received_at')->index();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('purchase_receipt_items')) {
            Schema::create('purchase_receipt_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('purchase_receipt_id')->constrained()->cascadeOnDelete();
                $table->foreignId('purchase_item_id')->constrained()->restrictOnDelete();
                $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
                $table->decimal('quantity', 16, 4);
                $table->string('unit', 30);
                $table->decimal('unit_cost', 14, 4);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipt_items');
        Schema::dropIfExists('purchase_receipts');
    }
};
