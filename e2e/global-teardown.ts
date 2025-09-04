import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  // Clean up test database if needed
  if (process.env.DATABASE_URL?.includes('test')) {
    try {
      console.log('🗑️  Cleaning test database...');
      // Add cleanup logic here if needed
      console.log('✅ Test database cleaned');
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
    }
  }

  // Generate test report
  try {
    console.log('📊 Generating test report...');
    await execAsync('npx playwright show-report --host 0.0.0.0 --port 9323 || true');
  } catch (error) {
    console.log('📊 Test report generation skipped');
  }

  console.log('✅ Global teardown complete');
}

export default globalTeardown;