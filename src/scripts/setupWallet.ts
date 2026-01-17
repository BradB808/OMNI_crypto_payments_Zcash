import * as readline from 'readline';
import { HDWallet } from '../services/wallet/HDWallet';
import { KeyManager } from '../services/wallet/KeyManager';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Wallet Setup Script
 * Generates a new master seed, encrypts it, and saves it to disk
 *
 * CRITICAL: The mnemonic phrase is displayed ONLY ONCE
 * User must write it down securely - it cannot be recovered!
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupWallet() {
  console.log('\n===============================================');
  console.log('   OMNI Crypto Payments - Wallet Setup');
  console.log('===============================================\n');

  const keyManager = new KeyManager();

  // Check if wallet already exists
  if (keyManager.masterSeedExists()) {
    console.log('⚠️  WARNING: A master seed already exists!');
    console.log('Creating a new seed will make the old one inaccessible.\n');

    const confirm = await question('Do you want to OVERWRITE the existing seed? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Wallet setup cancelled.');
      rl.close();
      process.exit(0);
    }
  }

  console.log('\n🔐 Generating new master seed...\n');

  try {
    // Generate new mnemonic (24 words = 256 bits, most secure)
    const mnemonic = HDWallet.generateMnemonic(256);

    // Convert mnemonic to seed
    const seed = require('bip39').mnemonicToSeedSync(mnemonic);

    // Create HD wallet to verify
    const hdWallet = HDWallet.fromSeed(seed, config.bitcoinNetwork as 'mainnet' | 'testnet');

    console.log('✅ Master seed generated successfully!\n');
    console.log('Network:', hdWallet.getNetwork());
    console.log('Fingerprint:', hdWallet.getMasterFingerprint());
    console.log('\n===============================================');
    console.log('   ⚠️  CRITICAL - READ CAREFULLY ⚠️');
    console.log('===============================================\n');
    console.log('Your 24-word recovery phrase is shown below.');
    console.log('This is the ONLY time it will be displayed!\n');
    console.log('📝 Write it down on paper and store it securely.');
    console.log('🔒 Never store it digitally or share it with anyone.');
    console.log('💾 You need this phrase to recover your wallet.\n');
    console.log('===============================================\n');
    console.log('RECOVERY PHRASE:\n');

    // Display mnemonic with numbering
    const words = mnemonic.split(' ');
    for (let i = 0; i < words.length; i++) {
      const num = (i + 1).toString().padStart(2, ' ');
      console.log(`  ${num}. ${words[i]}`);
    }

    console.log('\n===============================================\n');

    // Require user confirmation
    const confirm1 = await question('Have you written down all 24 words? (yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('\n❌ Please write down your recovery phrase before continuing.');
      rl.close();
      process.exit(0);
    }

    const confirm2 = await question('Are you sure you have stored it safely? (yes/no): ');
    if (confirm2.toLowerCase() !== 'yes') {
      console.log('\n❌ Please store your recovery phrase safely before continuing.');
      rl.close();
      process.exit(0);
    }

    // Encrypt and save the seed
    console.log('\n🔐 Encrypting and saving master seed...');
    await keyManager.saveMasterSeed(seed);

    console.log('\n✅ Wallet setup complete!\n');
    console.log('Your master seed has been encrypted and saved to:');
    console.log('  keys/master-seed.json\n');
    console.log('⚠️  Security Reminders:');
    console.log('  • Never commit the keys/ directory to version control');
    console.log('  • Keep your .env MASTER_SEED_ENCRYPTION_KEY secret');
    console.log('  • Backup your recovery phrase offline');
    console.log('  • Never share your recovery phrase with anyone\n');

    // Verify we can load it back
    console.log('🔍 Verifying encrypted seed...');
    const loadedSeed = await keyManager.loadMasterSeed();

    if (loadedSeed.equals(seed)) {
      console.log('✅ Seed verification successful!\n');
    } else {
      throw new Error('Seed verification failed!');
    }

    console.log('===============================================');
    console.log('Next steps:');
    console.log('  1. npm run dev          # Start the API server');
    console.log('  2. npm run workers:dev  # Start background workers');
    console.log('===============================================\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Wallet setup failed:', error);
    logger.error('Wallet setup failed', { error });
    rl.close();
    process.exit(1);
  }
}

// Run setup
setupWallet();
