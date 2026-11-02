<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class AuthenticationApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_valid_credentials_return_token_and_permission_aware_user(): void
    {
        $this->seed();

        $response = $this->postJson('/api/v1/login', [
            'email' => env('SEED_ADMIN_EMAIL'),
            'password' => env('SEED_ADMIN_PASSWORD'),
            'device_name' => 'PHPUnit',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.email', env('SEED_ADMIN_EMAIL'))
            ->assertJsonFragment(['pos.create_sale']);

        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_returns_422_when_account_is_inactive(): void
    {
        User::factory()->create(['email' => 'inactive@example.com', 'password' => 'secret-password', 'is_active' => false]);

        $response = $this->postJson('/api/v1/login', ['email' => 'inactive@example.com', 'password' => 'secret-password']);

        $response->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_returns_401_when_private_endpoint_has_no_token(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }
}
