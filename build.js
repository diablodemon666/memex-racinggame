const { execSync } = require('child_process');
  const fs = require('fs');

  console.log('Build script starting...');
  console.log('Current directory:', process.cwd());
  console.log('Directory contents:', fs.readdirSync('.'));

  // Check if src exists
  if (fs.existsSync('src')) {
    console.log('src/ contents:', fs.readdirSync('src'));

    // Check for index.js
    if (!fs.existsSync('src/index.js')) {
      console.error('ERROR: src/index.js not found!');
      process.exit(1);
    }
  }

  // Run webpack with the correct config
  try {
    execSync('npx webpack --mode production', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
