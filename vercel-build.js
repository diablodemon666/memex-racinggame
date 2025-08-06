const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  console.log('=== VERCEL BUILD DEBUG ===');
  console.log('Current directory:', process.cwd());
  console.log('Directory contents:', fs.readdirSync('.'));

  // Check src directory
  if (fs.existsSync('src')) {
    console.log('\nsrc/ exists! Contents:');
    const srcFiles = fs.readdirSync('src');
    srcFiles.forEach(file => {
      console.log(`  - ${file}`);
    });

    // Check specifically for index.js
    if (fs.existsSync('src/index.js')) {
      console.log('\n✅ src/index.js EXISTS!');
      const stats = fs.statSync('src/index.js');
      console.log(`   Size: ${stats.size} bytes`);
    } else {
      console.log('\n❌ src/index.js NOT FOUND!');
    }
  } else {
    console.log('\n❌ src directory NOT FOUND!');
  }

  // Check webpack.config.js
  if (fs.existsSync('webpack.config.js')) {
    console.log('\n✅ webpack.config.js exists');
  } else {
    console.log('\n❌ webpack.config.js NOT FOUND!');
  }

  // Try to run build
  console.log('\n=== Running webpack build ===');
  try {
    execSync('npx webpack --mode production', { stdio: 'inherit' });
    console.log('\n✅ Build succeeded!');
  } catch (error) {
    console.log('\n❌ Build failed');
    process.exit(1);
  }
