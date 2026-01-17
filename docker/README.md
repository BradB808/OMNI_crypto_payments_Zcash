# OMNI Crypto Payments - Docker Setup

This directory contains Docker configuration for local development and testing.

## Services

The Docker Compose setup includes the following services:

- **PostgreSQL** (port 5432): Database for storing payments, merchants, transactions
- **Redis** (port 6379): Cache and job queue
- **Bitcoin Core** (port 18443): Bitcoin node in regtest mode for local testing
- **Zcashd** (port 18232): Zcash node in testnet mode
- **Adminer** (port 8080): Web-based database admin UI (optional)

## Quick Start

### 1. Start all services

```bash
cd docker
docker-compose up -d
```

### 2. Check service status

```bash
docker-compose ps
```

Wait for all services to be healthy (especially Bitcoin and Zcash, which can take 1-2 minutes).

### 3. View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f bitcoin-core
docker-compose logs -f zcashd
```

### 4. Setup environment

```bash
# Copy Docker environment file to project root
cp docker/.env.docker .env

# Run database migrations
npm run db:migrate

# Setup wallet (generate master seed)
npm run wallet:setup
```

### 5. Start workers

In separate terminal windows:

```bash
# Bitcoin monitor
npm run worker:bitcoin

# Zcash monitor
npm run worker:zcash
```

### 6. Start API server

```bash
npm run dev
```

## Bitcoin Core (Regtest) Commands

Bitcoin Core runs in regtest mode for instant block generation and testing.

### Generate blocks

```bash
# Generate 101 blocks to mature coinbase rewards
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass generate 101

# Generate 1 block
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass generate 1
```

### Get wallet address

```bash
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass getnewaddress
```

### Send Bitcoin

```bash
# Send 0.1 BTC to address
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass sendtoaddress <address> 0.1

# Then generate a block to confirm
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass generate 1
```

### Get blockchain info

```bash
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass getblockchaininfo
```

### Check balance

```bash
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass getbalance
```

## Zcash (Testnet) Commands

Zcashd runs in testnet mode and connects to the real Zcash testnet.

### Get testnet funds

Use the Zcash testnet faucet:
- https://faucet.testnet.z.cash/

### Get blockchain info

```bash
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass getblockchaininfo
```

### Get new transparent address

```bash
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass getnewaddress
```

### Get new shielded address (Sapling)

```bash
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass z_getnewaddress sapling
```

### Check balance

```bash
# Transparent balance
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass getbalance

# Shielded balance
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass z_gettotalbalance
```

### Send ZEC

```bash
# Send to transparent address
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass sendtoaddress <address> 0.1

# Send to shielded address
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass z_sendmany <from_address> '[{"address":"<to_address>","amount":0.1}]'
```

## Database Management

### Access Adminer UI

Open http://localhost:8080 in your browser:

- System: PostgreSQL
- Server: postgres
- Username: omni
- Password: development
- Database: omni_payments

### Connect with psql

```bash
docker exec -it omni_postgres psql -U omni -d omni_payments
```

### Run SQL query

```bash
docker exec -it omni_postgres psql -U omni -d omni_payments -c "SELECT * FROM payments;"
```

## Redis Management

### Connect to Redis CLI

```bash
docker exec -it omni_redis redis-cli
```

### Common Redis commands

```bash
# List all keys
KEYS *

# Get value
GET omni:key_name

# Delete key
DEL omni:key_name

# Flush all data (careful!)
FLUSHALL
```

## Troubleshooting

### Services not starting

Check logs:
```bash
docker-compose logs <service_name>
```

### Bitcoin/Zcash taking too long to sync

For Bitcoin regtest, it should start instantly.
For Zcash testnet, initial sync can take 10-20 minutes. Check progress:

```bash
docker exec omni_zcashd zcash-cli -testnet -rpcuser=zcashrpc -rpcpassword=zcashpass getblockchaininfo
```

### Reset everything

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Access container shell

```bash
# Bitcoin
docker exec -it omni_bitcoin sh

# Zcash
docker exec -it omni_zcashd bash

# PostgreSQL
docker exec -it omni_postgres sh
```

## Testing Payment Flow

### 1. Create a payment via API

```bash
curl -X POST http://localhost:3000/v1/payments \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER-123",
    "amount": 10.00,
    "currency": "USD",
    "crypto_currency": "BTC",
    "description": "Test payment"
  }'
```

### 2. Send Bitcoin to the generated address

```bash
# Replace <address> with crypto_address from API response
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass sendtoaddress <address> 0.001
```

### 3. Check Bitcoin monitor logs

You should see "Payment detected" in the Bitcoin monitor worker logs.

### 4. Generate blocks to confirm

```bash
# Generate 6 blocks to reach confirmation threshold
docker exec omni_bitcoin bitcoin-cli -regtest -rpcuser=bitcoinrpc -rpcpassword=bitcoinpass generate 6
```

### 5. Check payment status

```bash
curl http://localhost:3000/v1/payments/<payment_id> \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Status should be "confirmed" after 6 confirmations.

## Stopping Services

### Stop all services

```bash
docker-compose down
```

### Stop and remove volumes (deletes all data)

```bash
docker-compose down -v
```

## Network Configuration

All services run on the `omni_network` bridge network and can communicate with each other using service names:

- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`
- Bitcoin: `bitcoin-core:18443`, `bitcoin-core:28332`, `bitcoin-core:28333`
- Zcash: `zcashd:18232`

From the host machine, use `localhost` with the mapped ports.
