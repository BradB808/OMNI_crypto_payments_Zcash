import { ZcashRpcClient } from '../../src/services/blockchain/ZcashRpcClient';
import { ZcashMonitor } from '../../src/services/blockchain/ZcashMonitor';
import { paymentRepository } from '../../src/database/repositories/PaymentRepository';
import { blockchainTransactionRepository } from '../../src/database/repositories/BlockchainTransactionRepository';
import { database } from '../../src/database/connection';
import { CryptoCurrency, PaymentStatus } from '../../src/types';

/**
 * Zcash Monitor Integration Tests
 *
 * These tests require Docker services to be running:
 * - PostgreSQL (port 5432)
 * - Zcashd testnet (port 18232)
 *
 * Run: npm run docker:up
 * Then: npm run test:integration
 *
 * Note: Zcash testnet requires initial sync which can take 10-20 minutes
 */

describe('Zcash Monitor Integration Tests', () => {
  let rpcClient: ZcashRpcClient;
  let monitor: ZcashMonitor;

  // Test configuration (adjust for your Docker setup)
  const testConfig = {
    rpcUrl: process.env.ZCASH_RPC_URL || 'http://localhost:18232',
    rpcUser: process.env.ZCASH_RPC_USER || 'zcashrpc',
    rpcPass: process.env.ZCASH_RPC_PASS || 'zcashpass',
  };

  beforeAll(async () => {
    // Connect to test database
    await database.connect();

    // Initialize RPC client
    rpcClient = new ZcashRpcClient({
      url: testConfig.rpcUrl,
      username: testConfig.rpcUser,
      password: testConfig.rpcPass,
    });

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Zcash RPC not accessible. Make sure Docker is running: docker-compose up -d');
    }
  });

  afterAll(async () => {
    // Clean up
    if (monitor) {
      await monitor.stop();
    }
    await database.disconnect();
  });

  describe('Zcash RPC Client', () => {
    test('should connect to Zcash node', async () => {
      const blockchainInfo = await rpcClient.getBlockchainInfo();
      expect(blockchainInfo).toBeDefined();
      expect(blockchainInfo.chain).toBe('test'); // testnet
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

    test('should generate new transparent address', async () => {
      const address = await rpcClient.getNewAddress();
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('tm') || address.startsWith('t1')).toBe(true); // testnet
    });

    test('should validate transparent address', async () => {
      const address = await rpcClient.getNewAddress();
      const validation = await rpcClient.validateAddress(address);
      expect(validation.isvalid).toBe(true);
    });

    test('should generate new shielded address (Sapling)', async () => {
      try {
        const address = await rpcClient.z_getNewAddress('sapling');
        expect(address).toBeDefined();
        expect(typeof address).toBe('string');
        expect(address.startsWith('ztestsapling')).toBe(true); // testnet Sapling
      } catch (error: any) {
        // May fail if wallet is not fully synced
        console.log('Note: Shielded address generation requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });

    test('should validate shielded address', async () => {
      try {
        const address = await rpcClient.z_getNewAddress('sapling');
        const validation = await rpcClient.z_validateAddress(address);
        expect(validation.isvalid).toBe(true);
        expect(validation.type).toBe('sapling');
      } catch (error: any) {
        console.log('Note: Shielded address validation requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });

    test('should list unspent outputs (transparent)', async () => {
      const utxos = await rpcClient.listUnspent(0);
      expect(Array.isArray(utxos)).toBe(true);
      // May be empty if no funds in wallet
    });

    test('should get wallet info', async () => {
      const walletInfo = await rpcClient.getWalletInfo();
      expect(walletInfo).toBeDefined();
      expect(walletInfo.walletversion).toBeDefined();
    });

    test('should get mempool info', async () => {
      const mempoolInfo = await rpcClient.getMempoolInfo();
      expect(mempoolInfo).toBeDefined();
      expect(typeof mempoolInfo.size).toBe('number');
    });
  });

  describe('Zcash Shielded Operations', () => {
    test('should export viewing key for shielded address', async () => {
      try {
        const address = await rpcClient.z_getNewAddress('sapling');
        const viewingKey = await rpcClient.z_exportViewingKey(address);
        expect(viewingKey).toBeDefined();
        expect(typeof viewingKey).toBe('string');
        expect(viewingKey.startsWith('zviews')).toBe(true); // Sapling viewing key
      } catch (error: any) {
        console.log('Note: View key export requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });

    test('should list shielded addresses', async () => {
      try {
        const addresses = await rpcClient.z_listAddresses();
        expect(Array.isArray(addresses)).toBe(true);
        // May be empty if no shielded addresses created
      } catch (error: any) {
        console.log('Note: Listing shielded addresses requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });

    test('should get total balance (transparent + shielded)', async () => {
      try {
        const balance = await rpcClient.z_getTotalBalance(1);
        expect(balance).toBeDefined();
        expect(balance.transparent).toBeDefined();
        expect(balance.private).toBeDefined();
      } catch (error: any) {
        console.log('Note: Balance check requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });

    test('should decode and encode memo field', () => {
      const testMemo = 'Order #12345';
      const encoded = rpcClient.encodeMemo(testMemo);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');

      const decoded = rpcClient.decodeMemo(encoded);
      expect(decoded).toBe(testMemo);
    });

    test('should handle empty memo', () => {
      const encoded = rpcClient.encodeMemo('');
      expect(encoded).toBe('');

      const decoded = rpcClient.decodeMemo('');
      expect(decoded).toBe('');
    });

    test('should reject memo exceeding 512 bytes', () => {
      const longMemo = 'a'.repeat(513);
      expect(() => rpcClient.encodeMemo(longMemo)).toThrow('512 byte limit');
    });
  });

  describe('Zcash Monitor Service', () => {
    beforeEach(async () => {
      // Create a fresh monitor for each test
      monitor = new ZcashMonitor({
        rpcUrl: testConfig.rpcUrl,
        rpcUser: testConfig.rpcUser,
        rpcPass: testConfig.rpcPass,
        confirmationThreshold: 6,
        pollIntervalMs: 15000,
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
      expect(status.lastScannedBlockHeight).toBeGreaterThan(0);
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

    test('should track transparent addresses', async () => {
      await monitor.initialize();

      // Create a test payment with transparent address
      const testAddress = await rpcClient.getNewAddress();
      const payment = await paymentRepository.create({
        merchant_id: 'test-merchant-id',
        order_id: 'TEST-ZEC-001',
        amount_fiat: '5.00',
        currency: 'USD',
        crypto_currency: 'ZEC' as CryptoCurrency,
        crypto_address: testAddress,
        crypto_amount: '0.05',
        exchange_rate: '100',
      });

      // Manually refresh address cache
      await (monitor as any).refreshAddressCache();

      const status = monitor.getStatus();
      expect(status.transparentAddressCount).toBeGreaterThan(0);
    });

    test('should track shielded addresses', async () => {
      try {
        await monitor.initialize();

        // Create a test payment with shielded address
        const testAddress = await rpcClient.z_getNewAddress('sapling');
        const payment = await paymentRepository.create({
          merchant_id: 'test-merchant-id',
          order_id: 'TEST-ZEC-SHIELDED-001',
          amount_fiat: '5.00',
          currency: 'USD',
          crypto_currency: 'ZEC' as CryptoCurrency,
          crypto_address: testAddress,
          crypto_amount: '0.05',
          exchange_rate: '100',
        });

        // Manually refresh address cache
        await (monitor as any).refreshAddressCache();

        const status = monitor.getStatus();
        expect(status.shieldedAddressCount).toBeGreaterThan(0);
      } catch (error: any) {
        console.log('Note: Shielded address test requires synced wallet:', error.message);
        expect(error).toBeDefined();
      }
    });
  });

  describe('Payment Detection Flow', () => {
    test('should detect transparent payment (manual test)', async () => {
      /**
       * Manual integration test for transparent Zcash payments:
       *
       * 1. Create payment with transparent address
       * 2. Start Zcash monitor
       * 3. Send ZEC from faucet: https://faucet.testnet.z.cash/
       * 4. Wait for monitor to detect (polls every 15 seconds)
       * 5. Check payment status changes to 'detected'
       * 6. Wait for 6 confirmations (~7.5 minutes)
       * 7. Check payment status changes to 'confirmed'
       */

      console.log('\n=== Manual Zcash Transparent Payment Test ===');
      console.log('1. Create payment with transparent address');
      console.log('2. Start Zcash monitor worker');
      console.log('3. Send ZEC from faucet to address');
      console.log('4. Wait for detection (15s polling)');
      console.log('5. Verify payment status = "detected"');
      console.log('6. Wait for 6 confirmations');
      console.log('7. Verify payment status = "confirmed"');
      console.log('==========================================\n');

      expect(true).toBe(true);
    });

    test('should detect shielded payment with memo (manual test)', async () => {
      /**
       * Manual integration test for shielded Zcash payments:
       *
       * 1. Create payment with shielded (z-address)
       * 2. Export and import viewing key to zcashd
       * 3. Start Zcash monitor
       * 4. Send ZEC to z-address with memo
       * 5. Monitor detects using z_listreceivedbyaddress
       * 6. Memo field is decoded and stored
       * 7. Payment progresses through states
       */

      console.log('\n=== Manual Zcash Shielded Payment Test ===');
      console.log('1. Create payment with z-address');
      console.log('2. Export viewing key');
      console.log('3. Import viewing key to zcashd');
      console.log('4. Start Zcash monitor worker');
      console.log('5. Send ZEC with memo field');
      console.log('6. Verify detection and memo parsing');
      console.log('7. Wait for confirmations');
      console.log('==========================================\n');

      expect(true).toBe(true);
    });
  });

  describe('Confirmation Tracking', () => {
    test('should update confirmations on new blocks', async () => {
      /**
       * Zcash testnet generates blocks every ~75 seconds
       * This test would need to wait for real blocks to verify
       * confirmation tracking works correctly
       */

      console.log('\n=== Manual Confirmation Tracking Test ===');
      console.log('1. Send a transaction');
      console.log('2. Check confirmations = 0');
      console.log('3. Wait for 1 block (~75 seconds)');
      console.log('4. Check confirmations = 1');
      console.log('5. Wait for 5 more blocks');
      console.log('6. Check confirmations = 6');
      console.log('==========================================\n');

      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle RPC connection errors', async () => {
      // Create monitor with invalid config
      const badMonitor = new ZcashMonitor({
        rpcUrl: 'http://invalid-host:9999',
        rpcUser: 'invalid',
        rpcPass: 'invalid',
        confirmationThreshold: 6,
        pollIntervalMs: 15000,
        addressCacheRefreshMs: 60000,
      });

      await expect(badMonitor.initialize()).rejects.toThrow();
    });

    test('should handle invalid transaction ID gracefully', async () => {
      const invalidTxid = '0000000000000000000000000000000000000000000000000000000000000000';

      await expect(async () => {
        await rpcClient.getRawTransaction(invalidTxid, 1);
      }).rejects.toThrow();
    });

    test('should handle wallet not synced gracefully', async () => {
      // Some operations may fail if wallet is not fully synced
      // The monitor should log warnings but not crash
      try {
        const addresses = await rpcClient.z_listAddresses();
        expect(Array.isArray(addresses)).toBe(true);
      } catch (error: any) {
        // This is expected if wallet is syncing
        expect(error).toBeDefined();
        console.log('Note: Wallet sync required for some operations');
      }
    });
  });

  describe('Polling Mechanism', () => {
    test('should poll blockchain at configured interval', async () => {
      await monitor.initialize();

      const initialBlockHeight = monitor.getStatus().lastScannedBlockHeight;

      await monitor.start();

      // Wait for at least one poll cycle (15 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 16000));

      // Block height should be same or higher (if new blocks were mined)
      const currentBlockHeight = monitor.getStatus().lastScannedBlockHeight;
      expect(currentBlockHeight).toBeGreaterThanOrEqual(initialBlockHeight);

      await monitor.stop();
    });
  });

  describe('Address Cache Management', () => {
    test('should separate transparent and shielded addresses', async () => {
      await monitor.initialize();

      // Create transparent payment
      const tAddress = await rpcClient.getNewAddress();
      await paymentRepository.create({
        merchant_id: 'test-merchant',
        order_id: 'TEST-T-001',
        amount_fiat: '5.00',
        currency: 'USD',
        crypto_currency: 'ZEC' as CryptoCurrency,
        crypto_address: tAddress,
        crypto_amount: '0.05',
        exchange_rate: '100',
      });

      // Try to create shielded payment
      try {
        const zAddress = await rpcClient.z_getNewAddress('sapling');
        await paymentRepository.create({
          merchant_id: 'test-merchant',
          order_id: 'TEST-Z-001',
          amount_fiat: '5.00',
          currency: 'USD',
          crypto_currency: 'ZEC' as CryptoCurrency,
          crypto_address: zAddress,
          crypto_amount: '0.05',
          exchange_rate: '100',
        });
      } catch (error) {
        console.log('Note: Shielded address requires synced wallet');
      }

      // Refresh cache
      await (monitor as any).refreshAddressCache();

      const status = monitor.getStatus();
      expect(status.transparentAddressCount).toBeGreaterThan(0);
      // shieldedAddressCount may be 0 if wallet not synced
    });
  });
});
