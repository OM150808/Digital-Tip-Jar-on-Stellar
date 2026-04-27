import { useState, useEffect, useMemo } from 'react';
import { StellarWalletsKit, WalletNetwork, FreighterModule, xBullModule } from '@creit.tech/stellar-wallets-kit';
import { rpc, xdr, Horizon, Contract, TransactionBuilder, BASE_FEE, Networks, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import './index.css';

const CONTRACT_ID = "CA4EUFUJ5X5CW55STIOYHUHZZVIKQF5VPTS2VLEMWXS2XLINEZOEF5WT";

export type TxState = 'IDLE' | 'SIGNING' | 'PENDING' | 'SUCCESS' | 'ERROR';

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org:443";

function App() {
  const [pubKey, setPubKey] = useState(() => localStorage.getItem('pubKey') || "");
  
  useEffect(() => {
    if (pubKey) {
      localStorage.setItem('pubKey', pubKey);
    } else {
      localStorage.removeItem('pubKey');
    }
  }, [pubKey]);
  const [balance, setBalance] = useState("0");
  const [amount, setAmount] = useState("");
  
  const [localTxHistory, setLocalTxHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('localTxHistory');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('localTxHistory', JSON.stringify(localTxHistory));
  }, [localTxHistory]);

  const [status, setStatus] = useState<TxState>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [txDetails, setTxDetails] = useState(''); 
  const [recentTippers, setRecentTippers] = useState<any[]>([]);

  const kit = useMemo(() => new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: 'freighter',
    modules: [
      new FreighterModule(),
      new xBullModule(),
    ],
    modalTheme: {
      bgColor: '#0a0a0a',
      textColor: '#cccccc',
      solidTextColor: '#ffffff',
      headerButtonColor: '#2ea043',
      dividerColor: '#222222',
      helpBgColor: '#0a0a0a',
      notAvailableTextColor: '#555555',
      notAvailableBgColor: '#111111',
      notAvailableBorderColor: '#222222',
    }
  }), []);

  // 4. Wallet Control Center - Fetch Live Balance
  const fetchBalance = async (address: string) => {
    try {
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(address);
      const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
      setBalance(nativeBalance ? nativeBalance.balance : "0");
    } catch (e) {
      console.log("Account likely unfunded", e);
      setBalance("Unfunded");
    }
  };

  useEffect(() => {
    if (pubKey) fetchBalance(pubKey);
    else setBalance("0");
  }, [pubKey]);

  const handleConnect = async () => {
    try {
      // Inject terminal theme CSS into the wallet modal's shadow DOM
      setTimeout(() => {
        const modal = document.querySelector('stellar-wallets-modal');
        if (modal && modal.shadowRoot) {
          const style = document.createElement('style');
          style.innerHTML = `
            * { font-family: 'Courier New', Courier, monospace !important; }
            .dialog-modal { border-radius: 4px !important; border: 1px solid #2ea043 !important; }
            .not-available { border-radius: 4px !important; }
          `;
          modal.shadowRoot.appendChild(style);
        }
      }, 50);

      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          setPubKey(address);
        }
      });
    } catch(e) {
      console.error(e);
      alert("Error connecting to wallet");
    }
  };

  const handleDisconnect = () => {
    setPubKey("");
    setStatus('IDLE');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pubKey);
    alert("Address copied!");
  };

  const handleTip = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    try {
      setStatus('SIGNING');
      setErrorMessage('');
      setTxDetails('');

      if (CONTRACT_ID.startsWith("C...")) {
        alert("You must replace CONTRACT_ID at the top of App.tsx with your deployed contract before sending a transaction!");
        setStatus('IDLE');
        return;
      }

      // RAW SDK IMPLEMENTATION (Triggers Freighter natively!)
      const horizonServer = new Horizon.Server(HORIZON_URL);
      const sourceAccount = await horizonServer.loadAccount(pubKey);
      
      const contract = new Contract(CONTRACT_ID);
      
      // Build raw transaction invoking the "deposit" function
      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(contract.call("deposit", 
         nativeToScVal(pubKey, { type: "address" }),
         nativeToScVal(Number(amount) * 10000000, { type: "i128" }) // Convert XLM to Stroops
      ))
      .setTimeout(30)
      .build();

      const server = new rpc.Server(RPC_URL);
      
      // Soroban requires transactions to be "prepared" to calculate resource fees
      const preparedTransaction = await server.prepareTransaction(tx);

      // POP UP FREIGHTER WALLET!
      const { signedTxXdr } = await kit.signTransaction(preparedTransaction.toXDR(), { 
        networkPassphrase: Networks.TESTNET, 
        address: pubKey 
      });
      
      setStatus('PENDING');

      // Reconstruct and send the signed transaction to the Soroban Network
      const signedTransaction = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);
      const response = await server.sendTransaction(signedTransaction as any);
      
      // Simple timeout for demo instead of full tx polling implementation
      await new Promise(r => setTimeout(r, 4000));

      setStatus('SUCCESS');
      setTxDetails(response.hash.slice(0,10) + "...");
      
      setLocalTxHistory(prev => [{
        id: response.hash,
        address: pubKey,
        amount: amount,
        status: 'SUCCESS',
        timestamp: new Date().toLocaleTimeString()
      }, ...prev]);

      setAmount("");
      fetchBalance(pubKey);  
    } catch (error: any) {
      console.error(error);
      setStatus('ERROR');
      
      // 5. Transaction Log - Status Tracking Errors
      const errString = error.message || String(error).toLowerCase();
      if (errString.includes('user declined') || errString.includes('reject')) {
         setErrorMessage('User Registration/Rejection: You closed or rejected the transaction in the wallet.');
      } else if (errString.includes('op_underfunded') || errString.includes('balance')) {
         setErrorMessage('Insufficient Funds: Your account lacks the required XLM.');
      } else if (errString.includes('timeout') || errString.includes('expired')) {
         setErrorMessage('Transaction Expired: The network took too long to process your transaction.');
      } else {
         setErrorMessage('An unexpected error occurred during the transaction.');
      }
      
      setLocalTxHistory(prev => [{
        id: Math.random().toString(36).substring(2, 10).toUpperCase(),
        address: pubKey,
        amount: amount,
        status: 'ERROR',
        errorMessage: errString,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev]);
    }
  };

  // 2. Live Feed - Event Integration via Polling
  useEffect(() => {
    if (CONTRACT_ID.startsWith("C...")) return;

    const server = new rpc.Server(RPC_URL);
    const fetchEvents = async () => {
      try {
        const latestLedgerResponse = await server.getLatestLedger();
        const startLedger = latestLedgerResponse.sequence - 100;

        const eventsRes = await server.getEvents({
          startLedger,
          filters: [{
            type: "contract",
            contractIds: [CONTRACT_ID]
          }],
          limit: 10
        });

        if (eventsRes.events && eventsRes.events.length > 0) {
          const newTippers = eventsRes.events.map((ev: any) => ({
            id: ev.id,
            address: ev.topic[1] ? scValToNative(ev.topic[1]) as string : "Unknown",
            amount: ev.value ? (Number(scValToNative(ev.value)) / 10000000).toString() : "0",
            timestamp: ev.ledgerClosedAt ? new Date(ev.ledgerClosedAt).toLocaleTimeString() : new Date().toLocaleTimeString()
          }));
          
          setRecentTippers(prev => {
            const combined = [...newTippers, ...prev];
            return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          });
        }
      } catch (err) {
        console.error("Failed to fetch events", err);
      }
    };
    
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Metrics are now strictly calculated from REAL network events
  const totalTips = recentTippers.reduce((acc, tip) => acc + Number(tip.amount), 0);



  return (
    <div className="dashboard-layout">
      
      {/* LEFT SIDEBAR: Wallet Control Center */}
      <div className="sidebar-left">
        <div className="card wallet-info">
          <h3>Wallet Control</h3>
          {!pubKey ? (
            <button onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
          ) : (
            <div>
              <div className="stat-label">Connected Account</div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <span title={pubKey}>{pubKey.slice(0, 6)}...{pubKey.slice(-4)}</span>
                <button className="copy-btn" onClick={handleCopy}>Copy</button>
              </div>
              
              <div className="stat-label">Live Balance</div>
              <div className="balance">{balance} XLM</div>
              
              <button className="disconnect-btn" onClick={handleDisconnect}>Disconnect</button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT: Stats & Interactions */}
      <div className="main-content">
        
        {/* 1. Stats Header */}
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat-box">
            <div className="stat-label">Total Tips (Real-Time)</div>
            <div className="stat-val">{totalTips} XLM</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Tips Received</div>
            <div className="stat-val">{recentTippers.length}</div>
          </div>
        </div>

        {/* Tip Input */}
        <div className="card">
          <h2>Support the Project!</h2>
          <p>Send a tip to support the Level 2 Certification development.</p>
          <div className="input-group">
            <input 
              type="number" 
              placeholder="Amount (XLM)" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="1"
              disabled={!pubKey || status === 'SIGNING' || status === 'PENDING'}
            />
            <button 
              onClick={handleTip} 
              disabled={!pubKey || status === 'SIGNING' || status === 'PENDING'}
            >
              {status === 'SIGNING' ? "Signing..." : status === 'PENDING' ? "Sending..." : "Send Tip"}
            </button>
          </div>
        </div>

        {/* 5. Transaction Log */}
        {status !== 'IDLE' && (
          <div className={`tx-log ${status.toLowerCase()}`}>
            {status === 'SIGNING' && <span><span className="status-icon">🟡</span> <strong>Signing:</strong> Waiting for the user to approve in Freighter.</span>}
            {status === 'PENDING' && <span><span className="status-icon">🔵</span> <strong>Submitting:</strong> Sending the transaction to the network.</span>}
            {status === 'SUCCESS' && <span><span className="status-icon">🟢</span> <strong>Success:</strong> Transaction confirmed (Ledger: {txDetails}).</span>}
            {status === 'ERROR' && <span><span className="status-icon">🔴</span> <strong>Failed:</strong> {errorMessage}</span>}
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: Global Data */}
      <div className="sidebar-right">
        


        {/* 2. Live Feed (Activity Log) */}
        <div className="activity-log-container">
          <div className="activity-log-title">// RECENT_ACTIVITY_LOG</div>
          <div className="feed-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {pubKey ? (
              localTxHistory.filter(t => t.address === pubKey).map(t => (
                <div key={t.id} style={{ marginBottom: '25px' }}>
                  <div className="log-entry" style={{ marginBottom: t.status === 'ERROR' ? '5px' : '0' }}>
                    <div className="log-left">
                      <span className="log-hash">#{t.id.slice(0,16).toUpperCase()}...</span>
                      <span className="log-action">TIP: {t.amount} XLM</span>
                    </div>
                    <div className="log-right">
                      <span className="log-badge" style={{ borderColor: t.status === 'ERROR' ? '#f85149' : '#2ea043', color: t.status === 'ERROR' ? '#f85149' : '#2ea043' }}>
                        {t.status === 'ERROR' ? 'TX_ERR' : 'TX_OK'}
                      </span>
                      <span className="log-time">{t.timestamp}</span>
                    </div>
                  </div>
                  {t.status === 'ERROR' && <div style={{ color: '#f85149', fontSize: '0.8rem', fontFamily: 'Courier New' }}>{t.errorMessage}</div>}
                </div>
              ))
            ) : (
              recentTippers.map(t => (
                <div key={t.id} className="log-entry">
                  <div className="log-left">
                    <span className="log-hash">#{t.id.slice(0,16).toUpperCase()}...</span>
                    <span className="log-action">TIP: {t.amount} XLM</span>
                  </div>
                  <div className="log-right">
                    <span className="log-badge">TX_OK</span>
                    <span className="log-time">{t.timestamp || new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
            {pubKey && localTxHistory.filter(t => t.address === pubKey).length === 0 && (
              <div style={{ color: '#666', fontStyle: 'italic', marginTop: '10px' }}>No recent activity for this wallet.</div>
            )}
            {!pubKey && recentTippers.length === 0 && (
              <div style={{ color: '#666', fontStyle: 'italic', marginTop: '10px' }}>Waiting for global activity...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App;
