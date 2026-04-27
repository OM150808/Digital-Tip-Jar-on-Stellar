const { rpc, xdr } = require('@stellar/stellar-sdk');
async function test() {
  const server = new rpc.Server('https://soroban-testnet.stellar.org');
  const latestLedger = await server.getLatestLedger();
  const startLedger = latestLedger.sequence - 10000;
  
  const e1 = await server.getEvents({
    startLedger,
    filters: [{
      type: 'contract',
      contractIds: ['CA4EUFUJ5X5CW55STIOYHUHZZVIKQF5VPTS2VLEMWXS2XLINEZOEF5WT'],
      topics: ['*', '*']
    }],
    limit: 10
  });
  console.log('Result with ["*", "*"]:', e1.events.length);
  
  const e2 = await server.getEvents({
    startLedger,
    filters: [{
      type: 'contract',
      contractIds: ['CA4EUFUJ5X5CW55STIOYHUHZZVIKQF5VPTS2VLEMWXS2XLINEZOEF5WT'],
      topics: [xdr.ScVal.scvSymbol('TIP').toXDR('base64'), '*']
    }],
    limit: 10
  });
  console.log('Result with [TIP, "*"]:', e2.events.length);
}
test().catch(console.error);
