# Windows Setup & Migration Guide

This guide is designed for an AI agent or developer to set up the **OMNI Crypto Payments** project on a Windows machine.

## Prerequisites

Ensure the Windows machine has the following installed:
1.  **Git for Windows**: [Download](https://git-scm.com/download/win)
2.  **Node.js (LTS Version >= 18)**: [Download](https://nodejs.org/)
3.  **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop/) (Required for running dependencies easily)
    *   Ensure WSL 2 (Windows Subsystem for Linux) backend is enabled in Docker Desktop settings.

## Installation Steps

### 1. Clone the Repository
Open PowerShell or Command Prompt (Terminal) and run:
```powershell
git clone https://github.com/BradB808/OMNI_crypto_payments_Zcash.git
cd OMNI_crypto_payments_Zcash
```

### 2. Install Project Dependencies
Install the Node.js dependencies defined in `package.json`:
```powershell
npm install
```

### 3. Environment Configuration
The project requires an `.env` file. You can copy the example file:
```powershell
copy .env.example .env
```
**Critical**: You must edit `.env` with real or development values.
*   **Database**: If using Docker (see below), keep `DATABASE_URL` as is or adjust host to `localhost`.
*   **Encryption Keys**: Generate a 32-byte hex key for `MASTER_SEED_ENCRYPTION_KEY`.
    *   Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate one.
*   **Secrets**: Set `JWT_SECRET` and `WEBHOOK_SIGNING_SECRET`.

### 4. Start Infrastructure (Docker)
The easiest way to run PostgreSQL, Redis, Bitcoin testnet, and Zcash testnet on Windows is via Docker.
Navigate to the docker directory and start the services:
```powershell
cd docker
docker-compose up -d
cd ..
```
*   This will start Postgres (port 5432), Redis (6379), Bitcoin (18332/18444), and Zcash nodes.
*   **Note**: Syncing blockchain nodes (even testnet) may take time.

### 5. Database Setup
Once Docker containers are running (check with `docker ps`):
```powershell
# Run migrations
npm run db:migrate

# Seed database (optional, for dev data)
npm run db:seed
```

### 6. Start the Application
You can now start the development server:
```powershell
npm run dev
```
The API will be available at `http://localhost:3000`.

### 7. Verifying the Setup
*   **Check API**: Visit `http://localhost:3000/health` (if endpoint exists) or check logs.
*   **Run Workers**: To process payments, you need to run workers.
    ```powershell
    npm run workers:dev
    ```

## Development on Windows
*   **Code Editor**: VS Code with WSL extension is recommended.
*   **Linting**: Run `npm run lint` to verify code quality.
*   **Testing**: Run `npm test` to ensure the logic works correctly on Windows.

## Important Notes for AI Agent
*   If `docker-compose` fails, check if ports (5432, 6379) are already in use.
*   Bitcoin/Zcash nodes in Docker are configured for `testnet`.
*   Ensure `.env` matches the Docker port mappings.
