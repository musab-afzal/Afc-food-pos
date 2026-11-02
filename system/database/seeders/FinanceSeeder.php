<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class FinanceSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Utilities', 'Rent', 'Supplies', 'Misc'] as $name) {
            ExpenseCategory::query()->updateOrCreate(['name' => $name], ['is_active' => true]);
        }

        // Opening balance is only applied when the account is first created.
        foreach ([
            ['code' => 'CASH-01', 'name' => 'Cash Drawer', 'type' => 'cash'],
            ['code' => 'BANK-01', 'name' => 'Main Bank Account', 'type' => 'bank'],
        ] as $account) {
            $existing = Account::query()->where('code', $account['code'])->first();

            if ($existing) {
                $existing->update(['name' => $account['name'], 'type' => $account['type'], 'is_active' => true]);

                continue;
            }

            Account::query()->create($account + ['opening_balance' => 0, 'current_balance' => 0, 'is_active' => true]);
        }
    }
}
