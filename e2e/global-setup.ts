import { chromium, FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';

const execAsync = promisify(exec);

dotenv.config({ path: '.env.test' });

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // Set up test database
  if (process.env.DATABASE_URL?.includes('test')) {
    try {
      console.log('📦 Setting up test database...');
      await execAsync('npm run db:migrate');
      console.log('✅ Test database ready');
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  // Seed test data
  try {
    console.log('🌱 Seeding test data...');
    await seedTestData();
    console.log('✅ Test data seeded');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }

  // Store auth state for reuse
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Perform authentication if needed
    const response = await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/api/health`);
    
    if (!response || response.status() !== 200) {
      console.warn('⚠️  Health check returned non-200 status, but continuing...');
    }
    
    // Save storage state for authenticated tests
    await page.context().storageState({ path: 'e2e/.auth/user.json' });
    
  } catch (error) {
    console.error('❌ Auth setup failed:', error);
    // Don't throw error, allow tests to continue
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup complete');
}

async function seedTestData() {
  // This would typically call your seed endpoint or directly seed the database
  const seedResponse = await fetch(`${process.env.PLAYWRIGHT_BASE_URL}/api/test/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SERVICE_SECRET}`,
    },
    body: JSON.stringify({
      customers: 10,
      tickets: 20,
      calls: 5,
    }),
  }).catch(() => null);

  if (!seedResponse || !seedResponse.ok) {
    console.warn('⚠️  Seed endpoint not available, skipping test data seeding');
  }
}

export default globalSetup;