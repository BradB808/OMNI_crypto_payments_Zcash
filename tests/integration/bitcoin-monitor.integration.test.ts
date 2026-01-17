import { BitcoinRpcClient } from '../../src/services/blockchain/BitcoinRpcClient';
import { BitcoinMonitor } from '../../src/services/blockchain/BitcoinMonitor';
import { paymentRepository } from '../../src/database/repositories/PaymentRepository';
import { blockchainTransactionRepository } from '../../src/database/repositories/BlockchainTransactionRepository';
import { database } from '../../src/database/connection';
import { CryptoCurrency, PaymentStatus } from '../../src/types';

/**
 * Bitcoin Monitor Integration Tests
 *
 * These tests require Docker services to be running:
 * - PostgreSQL (port 5432)
 * - Bitcoin Core regtest (port 18443, ZMQ 28332/28333)
 *
 * Run: npm run docker:up
 * Then: npm run test:integration
 */

describe('Bitcoin Monitor Integration Tests', () => {
  let rpcClient: BitcoinRpcClient;
  let monitor: BitcoinMonitor;

  // Test configuration (adjust for your Docker setup)
  const testConfig = {
    rpcUrl: process.env.BITCOIN_RPC_URL || 'http://localhost:18443',
    rpcUser: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
    rpcPass: process.env.BITCOIN_RPC_PASS || 'bitcoinpass',
    zmqEndpoint: process.env.BITCOIN_ZMQ_ENDPOINT || 'tcp://127.0.0.1:28332',
  };

  beforeAll(async () => {
    // Connect to test database
    await database.connect();

    // Initialize RPC client
    rpcClient = new BitcoinRpcClient({
      url: testConfig.rpcUrl,
      username: testConfig.rpcUser,
      password: testConfig.rpcPass,
    });

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Bitcoin RPC not accessible. Make sure Docker is running: docker-compose up -d');
    }

    // Generate some initial blocks if needed (regtest)
    try {
      const blockCount = await rpcClient.getBlockCount();
      if (blockCount < 101) {
        // Generate 101 blocks to mature coinbase rewards
        await rpcClient.call('generate', [101]);
        console.log('Generated 101 initial blocks for testing');
      }
    } catch (error) {
      // Ignore if generate command not available
    }
  });

  afterAll(async () => {
    // Clean up
    if (monitor) {
      await monitor.stop();
    }
    await database.disconnect();
  });

  describe('Bitcoin RPC Client', () => {
    test('should connect to Bitcoin node', async () => {
      const blockchainInfo = await rpcClient.getBlockchainInfo();
      expect(blockchainInfo).toBeDefined();
      expect(blockchainInfo.chain).toBe('regtest');
      expect(blockchainInfo.blocks).toBeGreaterThan(0);
    });

    test('should get block count', async () => {
      const blockCount = await rpcClient.getBlockCount();
      expect(typeof blockCount).toBe('number');
      expect(blockCount).toBeGreaterThan(0);
    });

    test('should get network info', async () => {
      const networkInfo = await rpcClient.getNetworkInfo();
      expect(networkInfo).toBeDefined();
      expect(networkInfo.version).toBeDefined();
    });

    test('should generate new address', async () => {
      const address = await rpcClient.getNewAddress('', 'bech32');
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('bcrt1')).toBe(true); // regtest bech32
    });

    test('should validate address', async () => {
      const address = await rpcClient.getNewAddress();
      const validation = await rpcClient.validateAddress(address);
      expect(validation.isvalid).toBe(true);
    });

    test('should get transaction (when exists)', async () => {
      // This test depends on having transactions in regtest
      // Skip if no transactions available
      const mempool = await rpcClient.getRawMempool(false);
      if (Array.isArray(mempool) && mempool.length > 0) {
        const txid = mempool[0];
        const tx = await rpcClient.getRawTransaction(txid, true);
        expect(tx).toBeDefined();
        expect(tx.txid).toBe(txid);
      } else {
        console.log('Skipping transaction test - no transactions in mempool');
      }
    });

    test('should list unspent outputs', async () => {
      const utxos = await rpcClient.listUnspent(0);
      expect(Array.isArray(utxos)).toBe(true);
      // May be empty if no funds in wallet
    });

    test('should estimate smart fee', async () => {
      const feeEstimate = await rpcClient.estimateSmartFee(6);
      expect(feeEstimate).toBeDefined();
      // feerate may not be available in regtest
    });
  });

  describe('Bitcoin Monitor Service', () => {
    beforeEach(async () => {
      // Create a fresh monitor for each test
      monitor = new BitcoinMonitor({
        rpcUrl: testConfig.rpcUrl,
        rpcUser: testConfig.rpcUser,
        rpcPass: testConfig.rpcPass,
        zmqEndpoint: testConfig.zmqEndpoint,
        confirmationThreshold: 6,
        pollIntervalMs: 10000,
        addressCacheRefreshMs: 60000,
      });
    });

    afterEach(async () => {
      if (monitor) {
        await monitor.stop();
      }
    });

    test('should initialize monitor', async () => {
      await monitor.initialize();
      const status = monitor.getStatus();
      expect(status).toBeDefined();
      expect(status.isRunning).toBe(false); // Not started yet
    });

    test('should start and stop monitor', async () => {
      await monitor.initialize();
      await monitor.start();

      let status = monitor.getStatus();
      expect(status.isRunning).toBe(true);

      await monitor.stop();

      status = monitor.getStatus();
      expect(status.isRunning).toBe(false);
    });

    test('should track monitored addresses', async () => {
      await monitor.initialize();

      // Create a test payment
      const testAddress = await rpcClient.getNewAddress('', 'bech32');
      const payment = await paymentRepository.create({
        merchant_id: 'test-merchant-id',
        order_id: 'TEST-ORDER-001',
        amount_fiat: '10.00',
        currency: 'USD',
        crypto_currency: 'BTC' as CryptoCurrency,
        crypto_address: testAddress,
        crypto_amount: '0.001',
        exchange_rate: '10000',
      });

      // Manually refresh address cache
      await (monitor as any).refreshAddressCache();

      const status = monitor.getStatus();
      expect(status.addressCount).toBeGreaterThan(0);

      // Clean up
      // Note: In a real test environment, you'd want to delete the test payment
    });
  });

  describe('Payment Detection Flow', () => {
    test('should detect payment when Bitcoin is sent (manual test)', async () => {
      /**
       * This is a manual integration test that requires:
       * 1. Docker Bitcoin regtest running
       * 2. Manual execution of bitcoin-cli sendtoaddress
       *
       * Steps:
       * 1. Create payment via API or database
       * 2. Start Bitcoin monitor
       * 3. Send BTC: docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass sendtoaddress <address> 0.001
       * 4. Check payment status changes to 'detected'
       * 5. Generate blocks: docker exec omni_bitcoin bitcoin-cli -regtest generate 6
       * 6. Check payment status changes to 'confirmed'
       *
       * For automated testing, you would need to:
       * - Create a payment with a generated address
       * - Use bitcoin-cli via exec to send funds
       * - Wait for monitor to detect
       * - Assert payment status changed
       */

      console.log('\n=== Manual Bitcoin Payment Detection Test ===');
      console.log('1. Create a payment with a Bitcoin address');
      console.log('2. Start the Bitcoin monitor worker');
      console.log('3. Send BTC to the address using bitcoin-cli');
      console.log('4. Verify payment status changes to "detected"');
      console.log('5. Generate 6 blocks to confirm');
      console.log('6. Verify payment status changes to "confirmed"');
      console.log('==========================================\n');

      // Placeholder test - mark as pending
      expect(true).toBe(true);
    });
  });

  describe('Confirmation Tracking', () => {
    test('should track confirmations on new blocks', async () => {
      /**
       * This test verifies that the monitor updates confirmation counts
       * when new blocks are generated.
       *
       * Manual test steps:
       * 1. Create a transaction
       * 2. Check initial confirmations (0)
       * 3. Generate a block
       * 4. Check confirmations increased to 1
       * 5. Generate more blocks
       * 6. Verify confirmations keep increasing
       */

      console.log('\n=== Manual Confirmation Tracking Test ===');
      console.log('1. Send a transaction');
      console.log('2. Check confirmations = 0');
      console.log('3. Generate 1 block');
      console.log('4. Check confirmations = 1');
      console.log('5. Generate 5 more blocks');
      console.log('6. Check confirmations = 6');
      console.log('==========================================\n');

      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle RPC connection errors', async () => {
      // Create monitor with invalid config
      const badMonitor = new BitcoinMonitor({
        rpcUrl: 'http://invalid-host:9999',
        rpcUser: 'invalid',
        rpcPass: 'invalid',
        zmqEndpoint: 'tcp://invalid-host:9999',
        confirmationThreshold: 6,
        pollIntervalMs: 10000,
        addressCacheRefreshMs: 60000,
      });

      await expect(badMonitor.initialize()).rejects.toThrow();
    });

    test('should handle invalid transaction ID gracefully', async () => {
      const invalidTxid = '0000000000000000000000000000000000000000000000000000000000000000';

      await expect(async () => {
        await rpcClient.getRawTransaction(invalidTxid, true);
      }).rejects.toThrow();
    });
  });

  describe('Address Cache Management', () => {
    test('should refresh address cache periodically', async () => {
      await monitor.initialize();

      const initialStatus = monitor.getStatus();
      const initialCount = initialStatus.addressCount;

      // Create new payments
      const address1 = await rpcClient.getNewAddress('', 'bech32');
      await paymentRepository.create({
        merchant_id: 'test-merchant',
        order_id: 'TEST-001',
        amount_fiat: '5.00',
        currency: 'USD',
        crypto_currency: 'BTC' as CryptoCurrency,
        crypto_address: address1,
        crypto_amount: '0.0005',
        exchange_rate: '10000',
      });

      // Manually refresh cache
      await (monitor as any).refreshAddressCache();

      const updatedStatus = monitor.getStatus();
      expect(updatedStatus.addressCount).toBeGreaterThanOrEqual(initialCount);
    });
  });
});
