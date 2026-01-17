# Critical Bugs Found - Phase 3 (Blockchain Monitoring)

Following a review of the Phase 3 implementation, the following critical bugs and deficiencies were identified. These issues primarily concern **data loss risks during service downtime** and **misleading test coverage**.

## 1. Bitcoin Monitor Misses Payments During Downtime (Critical)
**File:** `src/services/blockchain/BitcoinMonitor.ts`

The `BitcoinMonitor` relies exclusively on real-time ZMQ events (`hashblock`, `rawtx`) and assumes it is running continuously. It initializes by connecting to ZMQ and waiting for *future* events.

**The Bug:**
If the `worker:bitcoin` process is offline (crashed, deploying, or maintenance) when a user sends a payment:
1. The transaction enters the mempool (no `rawtx` event received by offline monitor).
2. The transaction is mined into a block (no `hashblock` event received).
3. When the monitor restarts, it listens for *new* blocks/txs only.
4. **Result:** The payment remains in `pending` status indefinitely.

**Remediation:**
On startup, `BitcoinMonitor` must:
1. Scan the `getRawMempool` for all monitored addresses to catch pending transactions.
2. Scan the last `N` blocks (e.g., last 1-2 hours) to catch confirmed transactions missed during downtime.

## 2. Zcash Shielded Payments Missed During Downtime (Critical)
**File:** `src/services/blockchain/ZcashMonitor.ts`

The `ZcashMonitor` manages the importing of view keys into `zcashd` for shielded address scanning.

**The Bug:**
If a user creates a payment (generating a view key) while the monitor is offline:
1. The view key is NOT yet imported into `omni_zcashd`.
2. The user sends the payment. `zcashd` sees the transaction but cannot decode it (no key).
3. The transaction is mined.
4. The monitor starts up and calls `ensureViewKeysImported`.
5. It imports the key using `z_importViewingKey(key, rescan: 'no', startHeight: currentTip)`.
6. **Result:** `zcashd` creates the watch-only address but *only scans forward from the current tip*. The transaction in the previous block is permanently missed.

**Remediation:**
When importing view keys, the `startHeight` should be set to the payment's `created_at` block height (or 0/older height if unknown), and a rescan should be triggered (or handled via a more robust `rescan` strategy) to ensure historical transactions are detected. Note: `z_importViewingKey` with rescan can be slow, so a background queue or "birthday height" strategy is needed.

## 3. Lack of Persistent Block Cursor (Major)
**File:** `src/services/blockchain/ZcashMonitor.ts`

`ZcashMonitor` stores `lastScannedBlockHeight` in memory, initializing it to `blockchainInfo.blocks` (current tip) on startup.

**The Bug:**
If the monitor crashes and restarts:
1. `lastScannedBlockHeight` is reset to the current tip.
2. Any blocks mined while the monitor was down are **never polled**.
3. Transparent payments included in those blocks will be missed (until they are spent or found via other means, but the `scanTransparentAddresses` relies on `listUnspent` which is safer, but relying on `lastScannedBlockHeight` for "New Zcash blocks detected" logic implies we skip processing "missed" blocks).

**Remediation:**
Store `lastScannedBlockHeight` in the database (e.g., in a `settings` table or Redis). On startup, resume from the stored height to process all intermediate blocks.

## 4. Integration Tests are Placeholders (Major)
**Files:** `tests/integration/bitcoin-monitor.integration.test.ts`, `tests/integration/zcash-monitor.integration.test.ts`

The user success criteria claimed "Comprehensive test suite" and "Integration tests created".

**The Finding:**
The integration tests contain **empty manual verification steps** that programmatically pass without testing anything.
Example:
```typescript
test('should detect payment when Bitcoin is sent (manual test)', async () => {
  // ... logs instructions ...
  expect(true).toBe(true);
});
```
This gives a false sense of security in CI/CD pipelines.

**Remediation:**
Implement actual integration tests that:
1. Generate a generic address.
2. Send funds using the `rpcClient` (mining blocks if needed).
3. Poll the database until the payment status changes to `detected`/`confirmed`.
4. Assert the state change programmatically.
