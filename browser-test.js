const puppeteer = require('puppeteer');

async function testMemexRacing() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Capture errors
  const errors = [];
  page.on('error', err => {
    errors.push({
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    console.error('PAGE ERROR:', err.message);
  });
  
  // Capture unhandled rejections
  page.on('pageerror', err => {
    errors.push({
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    console.error('PAGE ERROR:', err.message);
  });
  
  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit for the game to initialize
    await page.waitForTimeout(5000);
    
    // Check if game canvas exists
    const canvas = await page.$('canvas');
    const gameContainer = await page.$('#game-container');
    const loadingElement = await page.$('.loading');
    const errorElement = await page.$('.error-message');
    
    console.log('\n=== VISUAL TEST RESULTS ===');
    console.log('Canvas element exists:', !!canvas);
    console.log('Game container exists:', !!gameContainer);
    console.log('Loading element visible:', !!loadingElement);
    console.log('Error message visible:', !!errorElement);
    
    if (errorElement) {
      const errorText = await page.evaluate(el => el.textContent, errorElement);
      console.log('Error message content:', errorText);
    }
    
    // Check for webpack errors
    const webpackErrors = consoleLogs.filter(log => 
      log.text.includes('Module not found') || 
      log.text.includes('buffer') || 
      log.text.includes('crypto') || 
      log.text.includes('stream') || 
      log.text.includes('util') ||
      log.text.includes('Cannot resolve module')
    );
    
    // Check for Phaser IMAGE errors
    const phaserErrors = consoleLogs.filter(log => 
      log.text.includes('Cannot read properties of undefined') && log.text.includes('IMAGE')
    );
    
    console.log('\n=== WEBPACK MODULE ERRORS ===');
    console.log('Node.js module errors found:', webpackErrors.length);
    webpackErrors.forEach(error => {
      console.log(`- ${error.text}`);
    });
    
    console.log('\n=== PHASER IMAGE ERRORS ===');
    console.log('Phaser IMAGE errors found:', phaserErrors.length);
    phaserErrors.forEach(error => {
      console.log(`- ${error.text}`);
    });
    
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    console.log('\n=== ERROR SUMMARY ===');
    console.log('Total console messages:', consoleLogs.length);
    console.log('Total errors:', errors.length);
    console.log('Webpack/Node.js errors:', webpackErrors.length);
    console.log('Phaser IMAGE errors:', phaserErrors.length);
    
    // Take a screenshot
    await page.screenshot({ 
      path: '/Volumes/MOVESPEED/Memex Racing game/visual-test-screenshot.png',
      fullPage: true 
    });
    console.log('Screenshot saved to visual-test-screenshot.png');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testMemexRacing().catch(console.error);