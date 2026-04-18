# Digital Tip Jar - Code Reference

This provides the requested code for your Level 2 certification project, structured to keep the smart contract modular and the frontend well-typed.

## 1. Smart Contract (Rust)

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, token};

#[contracttype]
pub enum DataKey {
    TotalTips,
    TokenAddress, // We need the token address for native XLM
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
```

## 2. & 3. Frontend (TypeScript & StellarWalletsKit with UI States)

Here is a modular React hook encapsulating both the transaction management and the event polling logic:

```typescript
import { useState, useEffect } from 'react';
import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';
import { rpc, xdr } from '@stellar/stellar-sdk';
// Assume tipJarClient is your generated binding abstraction
// import * as tipJarClient from 'tip-jar-client';

export type TxState = 'IDLE' | 'SIGNING' | 'PENDING' | 'SUCCESS' | 'ERROR';

export function useDigitalTipJar(contractId: string) {
  // UI States
  const [status, setStatus] = useState<TxState>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentTippers, setRecentTippers] = useState<any[]>([]);

  // Initialize StellarWalletsKit supporting multiple wallets
  const kit = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: 'freighter', // or 'xbull'
    modules: allowAllModules(),
  });

  const handleTip = async (tipperAddress: string, amount: string) => {
    try {
      setStatus('SIGNING');
      setErrorMessage('');

      // Build your transaction using generated bindings
      // Example generated binding usage:
      // const tx = await tipJarClient.deposit({ tipper: tipperAddress, amount: BigInt(amount) });
      
      // Simulate signing through Stellar Wallets Kit:
      // const signedTx = await kit.signTx({ xdr: tx.toXDR(), publicKey: tipperAddress });
      
      setStatus('PENDING');

      // Note: Submission to RPC server happens here:
      // const response = await server.sendTransaction(signedTx);
      // Wait for the final status (success)

      setStatus('SUCCESS');
    } catch (error: any) {
      console.error(error);
      setStatus('ERROR');
      
      // Error Handling matching specific requirements
      const errString = error.message || String(error).toLowerCase();
      
      if (errString.includes('user declined') || errString.includes('reject')) {
         setErrorMessage('User Registration/Rejection: You closed or rejected the transaction in the wallet.');
      } else if (errString.includes('op_underfunded') || errString.includes('balance')) {
         setErrorMessage('Insufficient Balance: Your account lacks the required XLM.');
      } else if (errString.includes('timeout') || errString.includes('expired')) {
         setErrorMessage('Transaction Expired/Timeout: The network took too long to process your transaction.');
      } else {
         setErrorMessage('An unexpected error occurred during the transaction.');
      }
    }
  };

  // Event Sync: Poll for the "TIP" event to update UI without page refresh
  useEffect(() => {
    // Assuming Testnet; use the new combined Stellar SDK RPC Client
    const server = new rpc.Server("https://soroban-testnet.stellar.org:443");
    
    const fetchEvents = async () => {
      try {
        const eventsRes = await server.getEvents({
          startLedger: await getStartLedger(server), // Define a function to get currentLedger - 100
          filters: [
            {
              type: "contract",
              contractIds: [contractId],
              topics: [
                // Filter by our primary topic: Symbol("TIP")
                xdr.ScVal.scvSymbol("TIP").toXDR("base64")
              ]
            }
          ],
          limit: 10
        });

        if (eventsRes.events && eventsRes.events.length > 0) {
          const newTippers = eventsRes.events.map(ev => ({
            id: ev.id,
            // Topics array: [0] is "TIP", [1] is the user_address
            address: ev.topic[1],
            amount: ev.value, 
          }));
          
          setRecentTippers(prev => {
            // Keep unique events based on ID
            const combined = [...newTippers, ...prev];
            const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            return unique;
          });
        }
      } catch (err) {
        console.error("Failed to fetch events from Soroban RPC", err);
      }
    };
    
    // Poll every 5 seconds
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [contractId]);

  return { handleTip, status, errorMessage, recentTippers };
}

// Helper to calculate a safe start ledger for polling events
async function getStartLedger(server: rpc.Server): Promise<number> {
  const latestLedgerResponse = await server.getLatestLedger();
  return latestLedgerResponse.sequence - 100; // Looking back ~100 ledgers
}
```
