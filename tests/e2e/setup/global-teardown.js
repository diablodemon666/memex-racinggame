/**
 * Playwright Global Teardown
 * 
 * Runs once after all E2E tests to clean up the test environment
 * Includes server shutdown, temporary file cleanup, and resource cleanup
 */

async function globalTeardown(config) {
  console.log('🧹 Starting global E2E test teardown...');

  try {
    // Clean up test data
    await cleanupTestData();

    // Clean up temporary files
    await cleanupTempFiles();

    // Reset environment variables
    resetEnvironment();

    console.log('✅ Global E2E teardown completed successfully');

  } catch (error) {
    console.error('❌ Global E2E teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
}

/**
 * Clean up test data created during setup
 */
async function cleanupTestData() {
  console.log('🗑️  Cleaning up test data...');
  
  // Clear global test data
  if (global.testData) {
    global.testData = null;
  }
  
  if (global.testAuthState) {
    global.testAuthState = null;
  }

  // In a real application, you might:
  // - Delete test database entries
  // - Remove uploaded test files
  // - Clean up test rooms/games
  
  console.log('✅ Test data cleanup completed');
}

/**
 * Clean up temporary files created during testing
 */
async function cleanupTempFiles() {
  console.log('📁 Cleaning up temporary files...');
  
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Clean up test artifacts directory
    const artifactsDir = path.join(process.cwd(), 'test-results');
    
    // Only remove old test artifacts, keep the most recent run
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    try {
      const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(artifactsDir, entry.name);
          const stats = await fs.stat(entryPath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.rmdir(entryPath, { recursive: true });
            console.log(`🗑️  Removed old test artifacts: ${entry.name}`);
          }
        }
      }
    } catch (dirError) {
      // Directory might not exist, which is fine
      console.log('📁 No test artifacts directory to clean');
    }

    // Clean up any temporary browser profiles
    await cleanupBrowserProfiles();

  } catch (error) {
    console.warn('⚠️  Temporary file cleanup warning:', error.message);
  }
  
  console.log('✅ Temporary file cleanup completed');
}

/**
 * Clean up browser profiles created during testing
 */
async function cleanupBrowserProfiles() {
  const fs = require('fs').promises;
  const path = require('path');
  const os = require('os');
  
  try {
    // Clean up temporary browser profiles in system temp directory
    const tempDir = os.tmpdir();
    const entries = await fs.readdir(tempDir);
    
    for (const entry of entries) {
      if (entry.startsWith('playwright_') || entry.startsWith('chrome_')) {
        const entryPath = path.join(tempDir, entry);
        try {
          const stats = await fs.stat(entryPath);
          if (stats.isDirectory()) {
            await fs.rmdir(entryPath, { recursive: true });
            console.log(`🗑️  Removed browser profile: ${entry}`);
          }
        } catch (profileError) {
          // Profile might be in use, skip it
          console.log(`⚠️  Could not remove browser profile: ${entry}`);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Browser profile cleanup warning:', error.message);
  }
}

/**
 * Reset environment variables to their original state
 */
function resetEnvironment() {
  console.log('🔄 Resetting environment variables...');
  
  // Remove test-specific environment variables
  delete process.env.JWT_SECRET;
  delete process.env.SUPPRESS_CONSOLE_ERRORS;
  
  // Reset NODE_ENV if it was set to 'test'
  if (process.env.NODE_ENV === 'test') {
    delete process.env.NODE_ENV;
  }
  
  console.log('✅ Environment reset completed');
}

module.exports = globalTeardown;