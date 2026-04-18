#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, token};

#[contracttype]
pub enum DataKey {
    TotalTips,
    TokenAddress, // Store the native token address
}

#[contract]
pub struct DigitalTipJar;

#[contractimpl]
impl DigitalTipJar {
    /// Initialize with the exact native token address for the network
    pub fn init(env: Env, token_address: Address) {
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::TotalTips, &0i128);
    }

    /// Deposit function taking Address and i128
    pub fn deposit(env: Env, tipper: Address, amount: i128) {
        // Enforce the tipper has authorized this call
        tipper.require_auth();

        let token_addr: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let contract_address = env.current_contract_address();

        // Use token::Client's transfer method to move native XLM from tipper to contract
        token_client.transfer(&tipper, &contract_address, &amount);

        // Update the running total using instance storage
        let mut total_tips: i128 = env.storage().instance().get(&DataKey::TotalTips).unwrap_or(0);
        total_tips += amount;
        env.storage().instance().set(&DataKey::TotalTips, &total_tips);

        // Event Emission Logic
        // `env.events().publish` accepts a tuple of topics and the data value.
        // We create a Symbol for "TIP", followed by the user's address to create a 2-topic event.
        // The amount is passed separately as the data payload.
        let topics = (Symbol::new(&env, "TIP"), tipper);
        env.events().publish(topics, amount);
    }

    pub fn get_total_tips(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalTips).unwrap_or(0)
    }
}
