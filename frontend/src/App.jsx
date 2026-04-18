import { useState, useEffect } from 'react'
import {
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import './index.css'

// IMPORTANT: Replace with actual deployed contract ID and token ID
const CONTRACT_ID = "C... (To be deployed)";
const TOKEN_ID = "C... (e.g., Native XLM Token ID on testnet)";
const NETWORK = "TESTNET";

function App() {
  const [hasWallet, setHasWallet] = useState(false);
  const [pubKey, setPubKey] = useState("");
  const [raised, setRaised] = useState(0);
  const [target, setTarget] = useState(5000); // Default to 5000 XLM for example
  const [donateAmount, setDonateAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWallet();
    // Normally, here we'd simulate fetching from Soroban RPC
    // Since we don't have the contract deployed yet, we simulate initial data
    setRaised(1250); 
  }, []);

  const checkWallet = async () => {
    if (await isConnected()) {
      setHasWallet(true);
    }
  };

  const handleConnect = async () => {
    try {
      const access = await requestAccess();
      if (access) {
        setPubKey(access);
      }
    } catch(e) {
      console.error(e);
      alert("Error connecting to wallet");
    }
  };

  const handleDonate = async () => {
    if (!donateAmount || isNaN(donateAmount) || Number(donateAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    setLoading(true);
    try {
      // In a real application, you would:
      // 1. Build a transaction using Soroban/Stellar SDK calling the 'donate' function
      // 2. Sign it via `signTransaction(xdr, { network: NETWORK })`
      // 3. Submit it to Soroban RPC server
      
      // Simulating a successful transaction delay and local state update:
      await new Promise(r => setTimeout(r, 2000));
      
      setRaised(prev => prev + Number(donateAmount));
      setDonateAmount("");
      alert("Donation successful!");
    } catch(e) {
      console.error(e);
      alert("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.min((raised / target) * 100, 100).toFixed(1);

  return (
    <div className="container">
      <div className="network-badge">Stellar Testnet</div>
      <h1>🌍 Global Tech Fund</h1>
      <p>Help us reach our goal to support open-source developers worldwide!</p>
      
      <div className="progress-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progressPercent}%` }}
        >
          {progressPercent}%
        </div>
      </div>
      
      <div className="stats">
        <strong>{raised} XLM</strong> raised of {target} XLM goal
      </div>

      {!hasWallet ? (
        <div style={{ marginTop: '2rem' }}>
          <p>Please install the Freighter Wallet extension to continue.</p>
          <a href="https://freighter.app/" target="_blank" rel="noreferrer">
            <button>Install Freighter</button>
          </a>
        </div>
      ) : !pubKey ? (
        <button onClick={handleConnect} style={{ marginTop: '1rem' }}>Connect Wallet</button>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <p style={{fontSize: '0.9em', color: '#8b949e'}}>Connected: {pubKey.slice(0, 6)}...{pubKey.slice(-4)}</p>
          <div className="input-group">
            <input 
              type="number" 
              placeholder="Amount (XLM)" 
              value={donateAmount}
              onChange={e => setDonateAmount(e.target.value)}
              min="1"
            />
            <button onClick={handleDonate} disabled={loading}>
              {loading ? "Processing..." : "Donate XLM"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
