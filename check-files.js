const fs = require('fs');
  const { execSync } = require('child_process');

  console.log('=== FILE CHECK ===');
  console.log('Current directory:', process.cwd());

  // Check git status
  try {
    const gitLog = execSync('git log --oneline -5').toString();
    console.log('\nLast 5 commits:');
    console.log(gitLog);
  } catch (e) {
    console.log('Git log failed');
  }

  // List all files in src
  function listFiles(dir, indent = '') {
    if (!fs.existsSync(dir)) {
      console.log(`${indent}Directory ${dir} does not exist`);
      return;
    }

    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = `${dir}/${item}`;
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        console.log(`${indent}📁 ${item}/`);
        if (item !== 'node_modules' && indent.length < 4) {
          listFiles(fullPath, indent + '  ');
        }
      } else {
        console.log(`${indent}📄 ${item} (${stats.size} bytes)`);
      }
    });
  }

  console.log('\n=== SRC DIRECTORY STRUCTURE ===');
  listFiles('src');

  // Check if webpack.config.js exists
  console.log('\n=== ROOT FILES ===');
  ['webpack.config.js', 'webpack.prod.js', 'webpack.vercel.config.js',
  'package.json'].forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`✅ ${file} exists (${stats.size} bytes)`);
    } else {
      console.log(`❌ ${file} NOT FOUND`);
    }
  });

  // Try to find index.js anywhere
  console.log('\n=== SEARCHING FOR index.js ===');
  try {
    const found = execSync('find . -name "index.js" -type f | grep -v 
  node_modules | head -10').toString();
    console.log('Found index.js files:');
    console.log(found);
  } catch (e) {
    console.log('Find command failed');
  }
