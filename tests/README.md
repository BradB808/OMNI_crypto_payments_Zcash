# OMNI Crypto Payments - Test Suite

This directory contains unit, integration, and end-to-end tests for the OMNI Crypto Payments system.

## Test Structure

```
tests/
├── unit/                   # Unit tests (isolated, mocked dependencies)
│   ├── services/          # Service layer tests
│   ├── repositories/      # Repository tests
│   └── utils/             # Utility function tests
├── integration/           # Integration tests (real dependencies)
│   ├── bitcoin-monitor.integration.test.ts
│   └── zcash-monitor.integration.test.ts
├── e2e/                   # End-to-end tests (full payment flows)
└── setup.ts               # Global test setup
```

## Prerequisites

### For Unit Tests
- No special requirements, all dependencies are mocked

### For Integration Tests
- **Docker** must be installed and running
- **Docker Compose** services must be running:
  ```bash
  cd docker
  docker-compose up -d
  ```

The integration tests require:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Bitcoin Core regtest (port 18443, ZMQ 28332/28333)
- Zcashd testnet (port 18232)

## Running Tests

### Run all tests
```bash
npm test
```

### Run unit tests only
```bash
npm run test:unit
```

### Run integration tests only
```bash
npm run test:integration
```

### Run end-to-end tests only
```bash
npm run test:e2e
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Integration Test Guide

### Bitcoin Monitor Integration Tests

The Bitcoin integration tests verify:
- RPC client connectivity
- Transaction detection
- Confirmation tracking
- ZMQ real-time notifications
- Payment state transitions

**Setup:**
1. Start Docker services:
   ```bash
   cd docker
   docker-compose up -d
   ```

2. Wait for Bitcoin Core to start (~10 seconds)

3. Run the tests:
   ```bash
   npm run test:integration -- bitcoin-monitor
   ```

**Manual Payment Test:**
To test actual payment detection:

1. Create a payment (via API or database):
   ```typescript
   const payment = await paymentRepository.create({
     merchant_id: 'test-merchant',
     order_id: 'TEST-001',
     amount_fiat: '10.00',
     currency: 'USD',
     crypto_currency: 'BTC',
     crypto_address: '<generated_address>',
     crypto_amount: '0.001',
     exchange_rate: '10000',
   });
   ```

2. Start Bitcoin monitor worker:
   ```bash
   npm run dev:worker:bitcoin
   ```

3. Send Bitcoin to the address:
   ```bash
   docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass sendtoaddress <address> 0.001
   ```

4. Check logs - should see "Payment detected"

5. Generate blocks to confirm:
   ```bash
   docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass generate 6
   ```

6. Check logs - should see confirmation updates

### Zcash Monitor Integration Tests

The Zcash integration tests verify:
- RPC client connectivity
- Transparent address monitoring
- Shielded address monitoring (with view keys)
- Memo field encoding/decoding
- Confirmation tracking
- Payment state transitions

**Setup:**
1. Start Docker services:
   ```bash
   cd docker
   docker-compose up -d
   ```

2. Wait for Zcashd to sync (can take 10-20 minutes for testnet)

3. Check sync status:
   ```bash
   docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass getblockchaininfo
   ```

4. Run the tests:
   ```bash
   npm run test:integration -- zcash-monitor
   ```

**Manual Payment Test (Transparent):**

1. Create a payment with transparent address

2. Start Zcash monitor worker:
   ```bash
   npm run dev:worker:zcash
   ```

3. Get testnet ZEC from faucet:
   - https://faucet.testnet.z.cash/

4. Send to the payment address

5. Wait for detection (polls every 15 seconds)

**Manual Payment Test (Shielded):**

1. Create a payment with shielded z-address

2. Export viewing key:
   ```bash
   docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass z_exportviewingkey <z-address>
   ```

3. Import viewing key:
   ```bash
   docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass z_importviewingkey <viewing_key> no 0
   ```

4. Start Zcash monitor worker

5. Send ZEC to z-address with memo field

6. Monitor should detect and decode memo

## Writing New Tests

### Unit Test Example

```typescript
// tests/unit/services/paymentService.test.ts
import { PaymentService } from '../../../src/services/payment/PaymentService';
import { paymentRepository } from '../../../src/database/repositories/PaymentRepository';

jest.mock('../../../src/database/repositories/PaymentRepository');

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
    jest.clearAllMocks();
  });

  test('should create payment', async () => {
    const mockPayment = { id: '123', status: 'pending' };
    (paymentRepository.create as jest.Mock).mockResolvedValue(mockPayment);

    const result = await service.createPayment({ /* ... */ });

    expect(result).toEqual(mockPayment);
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Test Example

```typescript
// tests/integration/my-feature.integration.test.ts
import { database } from '../../src/database/connection';

describe('My Feature Integration Tests', () => {
  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  test('should work with real database', async () => {
    // Test code with real database
  });
});
```

## Test Coverage

The project aims for:
- **70%** overall code coverage
- **80%** coverage for critical paths (payment processing, blockchain monitoring)
- **100%** coverage for utility functions (crypto, validation)

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Troubleshooting

### Tests failing with "Connection refused"
- Ensure Docker services are running: `docker-compose ps`
- Check service health: `docker-compose logs <service>`

### Bitcoin tests timing out
- Increase test timeout in jest.config.js
- Check Bitcoin Core is responsive: `docker exec omni_bitcoin bitcoin-cli -regtest getblockchaininfo`

### Zcash tests failing
- Zcashd may need time to sync (10-20 minutes initially)
- Check sync status: `docker exec omni_zcashd zcash-cli -testnet getblockchaininfo`
- Ensure `blocks` is close to `headers`

### Database errors
- Reset test database: `npm run db:reset`
- Check PostgreSQL: `docker exec -it omni_postgres psql -U omni -d omni_payments -c "SELECT 1;"`

### Tests hanging
- Check for missing `await` keywords
- Ensure all database connections are closed in `afterAll`
- Check for timers/intervals not being cleared

## CI/CD Integration

For continuous integration, use GitHub Actions or similar:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: omni_payments_test
          POSTGRES_USER: omni
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources in `afterEach`/`afterAll`
3. **Mocking**: Mock external dependencies in unit tests
4. **Assertions**: Use specific assertions, avoid generic `toBeTruthy()`
5. **Naming**: Use descriptive test names: `should do X when Y`
6. **Arrange-Act-Assert**: Structure tests clearly
7. **Test Data**: Use factories or fixtures for consistent test data
8. **Async/Await**: Always await async operations
9. **Error Cases**: Test both success and failure scenarios
10. **Documentation**: Comment complex test setups

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
