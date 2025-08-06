/**
 * Playwright Global Setup
 * 
 * Runs once before all E2E tests to prepare the test environment
 * Includes server startup, database preparation, and authentication setup
 */

const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  console.log('🚀 Starting global E2E test setup...');

  // Setup test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-test-jwt-secret-32-chars-minimum-length-required';
  process.env.SUPPRESS_CONSOLE_ERRORS = 'true';

  try {
    // Wait for servers to be ready (configured in playwright.config.js)
    console.log('⏳ Waiting for servers to start...');
    
    // The webServer configuration in playwright.config.js will handle starting:
    // - Frontend dev server on port 8080
    // - Backend server on port 3001
    
    // Give servers extra time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify servers are responding
    await verifyServers();

    // Setup test data if needed
    await setupTestData();

    // Pre-authenticate test users if needed
    await setupTestAuthentication();

    console.log('✅ Global E2E setup completed successfully');

  } catch (error) {
    console.error('❌ Global E2E setup failed:', error);
    throw error;
  }
}

/**
 * Verify that all required servers are running and responsive
 */
async function verifyServers() {
  // Use Playwright's built-in request functionality instead of node-fetch
  const { request } = require('@playwright/test');
  
  try {
    const requestContext = await request.newContext();
    
    // Check frontend server
    try {
      const frontendResponse = await requestContext.get('http://localhost:8080', {
        timeout: 10000
      });
      
      if (!frontendResponse.ok()) {
        throw new Error(`Frontend server returned status: ${frontendResponse.status()}`);
      }
      
      console.log('✅ Frontend server is responding');
    } catch (frontendError) {
      console.error('❌ Frontend server verification failed:', frontendError.message);
      throw frontendError;
    }

    // Check backend server
    try {
      const backendResponse = await requestContext.get('http://localhost:3001/health', {
        timeout: 10000
      });
      
      if (backendResponse.ok()) {
        console.log('✅ Backend server is responding');
      } else {
        console.log('⚠️  Backend server not responding (this is OK if no backend API is implemented yet)');
      }
    } catch (backendError) {
      console.log('⚠️  Backend server not available (this is OK if no backend API is implemented yet)');
    }
    
    await requestContext.dispose();

  } catch (error) {
    console.error('❌ Server verification failed:', error);
    throw new Error(`Servers are not ready: ${error.message}`);
  }
}

/**
 * Setup test data for E2E tests
 */
async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // In a real application, you might:
  // - Create test database entries
  // - Upload test assets
  // - Configure test rooms/games
  
  // For now, we'll just create some mock data structures
  global.testData = {
    players: [
      {
        id: 'test-player-1',
        name: 'Test Player 1',
        username: 'testplayer1',
        wins: 5,
        losses: 3,
        winRate: 62.5
      },
      {
        id: 'test-player-2', 
        name: 'Test Player 2',
        username: 'testplayer2',
        wins: 8,
        losses: 2,
        winRate: 80.0
      }
    ],
    rooms: [
      {
        id: 'test-room-1',
        code: 'TEST123',
        maxPlayers: 6,
        currentPlayers: 2
      }
    ]
  };

  console.log('✅ Test data setup completed');
}

/**
 * Pre-authenticate test users for faster test execution
 */
async function setupTestAuthentication() {
  console.log('🔐 Setting up test authentication...');

  // Launch a browser to pre-authenticate test users
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:8080');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // If there's an authentication system, log in a test user
    // This is application-specific and would need to be customized
    
    // For now, just verify the page loads correctly
    const title = await page.title();
    console.log(`📄 Application title: ${title}`);
    
    // Store authentication state if needed
    // const storageState = await context.storageState();
    // global.testAuthState = storageState;

  } catch (error) {
    console.warn('⚠️  Authentication setup failed (this is OK if no auth is implemented):', error.message);
  } finally {
    await browser.close();
  }

  console.log('✅ Authentication setup completed');
}

module.exports = globalSetup;