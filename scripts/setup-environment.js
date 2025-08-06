#!/usr/bin/env node

/**
 * Environment Setup Script for Memex Racing Game
 * Generates secure JWT secrets and validates environment configuration
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class EnvironmentSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.envFile = path.join(this.projectRoot, '.env');
    this.envExampleFile = path.join(this.projectRoot, '.env.example');
  }

  /**
   * Generate a cryptographically secure JWT secret
   * @param {number} bytes - Number of bytes for the secret (default: 32)
   * @returns {string} - Hex encoded secret
   */
  generateJWTSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate multiple secure secrets for different purposes
   * @returns {object} - Object containing different types of secrets
   */
  generateSecrets() {
    return {
      jwt: this.generateJWTSecret(32),
      session: this.generateJWTSecret(24),
      encryption: this.generateJWTSecret(16),
      csrf: this.generateJWTSecret(16)
    };
  }

  /**
   * Check if .env file exists
   * @returns {boolean}
   */
  envFileExists() {
    return fs.existsSync(this.envFile);
  }

  /**
   * Read current .env file content
   * @returns {string|null}
   */
  readEnvFile() {
    if (!this.envFileExists()) {
      return null;
    }
    return fs.readFileSync(this.envFile, 'utf8');
  }

  /**
   * Parse .env file content into key-value pairs
   * @param {string} content - .env file content
   * @returns {object}
   */
  parseEnvContent(content) {
    const env = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return env;
  }

  /**
   * Update or create .env file with new values
   * @param {object} updates - Key-value pairs to update
   */
  updateEnvFile(updates) {
    let content = this.readEnvFile() || '';
    const existingEnv = this.parseEnvContent(content);
    
    // Update existing values or append new ones
    for (const [key, value] of Object.entries(updates)) {
      if (existingEnv[key] !== undefined) {
        // Replace existing value
        const regex = new RegExp(`^${key}=.*$`, 'm');
        content = content.replace(regex, `${key}=${value}`);
      } else {
        // Append new value
        if (content && !content.endsWith('\n')) {
          content += '\n';
        }
        content += `${key}=${value}\n`;
      }
    }
    
    fs.writeFileSync(this.envFile, content);
  }

  /**
   * Copy .env.example to .env if it doesn't exist
   */
  createEnvFromExample() {
    if (!this.envFileExists() && fs.existsSync(this.envExampleFile)) {
      fs.copyFileSync(this.envExampleFile, this.envFile);
      console.log(`${colors.green}✓${colors.reset} Created .env file from .env.example`);
      return true;
    }
    return false;
  }

  /**
   * Validate current JWT secret
   * @param {string} secret - JWT secret to validate
   * @returns {object} - Validation result
   */
  validateJWTSecret(secret) {
    const issues = [];
    const warnings = [];

    if (!secret) {
      issues.push('JWT_SECRET is missing');
      return { valid: false, issues, warnings };
    }

    if (secret.length < 32) {
      issues.push(`JWT_SECRET is too short (${secret.length} chars, minimum 32)`);
    }

    const weakSecrets = [
      'default', 'secret', 'password', 'test', '123456', 'qwerty',
      'your-secure-jwt-secret-32-characters-minimum-required',
      'development-secret-change-in-production'
    ];

    if (weakSecrets.some(weak => secret.toLowerCase().includes(weak.toLowerCase()))) {
      if (process.env.NODE_ENV === 'production') {
        issues.push('JWT_SECRET appears to be a default/weak value');
      } else {
        warnings.push('JWT_SECRET appears to be a default/weak value (OK for development)');
      }
    }

    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 8) {
      issues.push('JWT_SECRET has insufficient entropy');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Interactive prompt for user input
   * @param {string} question - Question to ask
   * @returns {Promise<string>} - User's answer
   */
  async prompt(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Interactive setup process
   */
  async interactiveSetup() {
    console.log(`${colors.cyan}${colors.bright}🔧 Memex Racing Game - Environment Setup${colors.reset}\n`);

    // Check if .env exists
    const envExists = this.envFileExists();
    
    if (!envExists) {
      console.log(`${colors.yellow}⚠️  No .env file found${colors.reset}`);
      this.createEnvFromExample();
    }

    // Read current environment
    const currentEnv = this.parseEnvContent(this.readEnvFile() || '');
    
    // Validate current JWT secret
    const jwtValidation = this.validateJWTSecret(currentEnv.JWT_SECRET);
    
    if (jwtValidation.valid) {
      console.log(`${colors.green}✓${colors.reset} JWT_SECRET is properly configured`);
      
      if (jwtValidation.warnings.length > 0) {
        jwtValidation.warnings.forEach(warning => {
          console.log(`${colors.yellow}⚠️  ${warning}${colors.reset}`);
        });
      }
      
      const generateNew = await this.prompt('Generate a new JWT secret anyway? (y/N): ');
      if (generateNew.toLowerCase() !== 'y' && generateNew.toLowerCase() !== 'yes') {
        console.log('\n✅ Environment setup complete!');
        return;
      }
    } else {
      console.log(`${colors.red}❌ JWT_SECRET issues found:${colors.reset}`);
      jwtValidation.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
      console.log('');
    }

    // Generate new secrets
    console.log('🔐 Generating new secure secrets...');
    const secrets = this.generateSecrets();
    
    console.log(`${colors.green}✓${colors.reset} Generated new JWT secret (${secrets.jwt.length} characters)`);
    
    // Ask user what to do
    console.log('\nChoose an option:');
    console.log('1. Update .env file with new JWT secret');
    console.log('2. Display secret for manual copy');
    console.log('3. Cancel');
    
    const choice = await this.prompt('Enter choice (1-3): ');
    
    switch (choice) {
      case '1':
        this.updateEnvFile({ JWT_SECRET: secrets.jwt });
        console.log(`${colors.green}✅ Updated .env file with new JWT secret${colors.reset}`);
        break;
        
      case '2':
        console.log('\n📋 Copy this JWT secret to your .env file:');
        console.log(`${colors.bright}JWT_SECRET=${secrets.jwt}${colors.reset}\n`);
        break;
        
      case '3':
      default:
        console.log('❌ Setup cancelled');
        return;
    }

    console.log('\n✅ Environment setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Review your .env file');
    console.log('2. Update production environment with secure values');
    console.log('3. Run tests: npm test');
    console.log('4. Start application: npm start');
  }

  /**
   * Command-line interface
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'generate':
        const secrets = this.generateSecrets();
        console.log('Generated secrets:');
        console.log(`JWT_SECRET=${secrets.jwt}`);
        console.log(`SESSION_SECRET=${secrets.session}`);
        console.log(`ENCRYPTION_KEY=${secrets.encryption}`);
        console.log(`CSRF_SECRET=${secrets.csrf}`);
        break;

      case 'validate':
        const currentEnv = this.parseEnvContent(this.readEnvFile() || '');
        const validation = this.validateJWTSecret(currentEnv.JWT_SECRET);
        
        if (validation.valid) {
          console.log(`${colors.green}✅ JWT_SECRET is valid${colors.reset}`);
          process.exit(0);
        } else {
          console.log(`${colors.red}❌ JWT_SECRET validation failed:${colors.reset}`);
          validation.issues.forEach(issue => console.log(`   - ${issue}`));
          process.exit(1);
        }
        break;

      case 'jwt':
        console.log(this.generateJWTSecret());
        break;

      case 'help':
        this.showHelp();
        break;

      default:
        await this.interactiveSetup();
        break;
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`${colors.cyan}${colors.bright}Memex Racing Game - Environment Setup${colors.reset}\n`);
    console.log('Usage: node scripts/setup-environment.js [command]\n');
    console.log('Commands:');
    console.log('  generate  Generate all types of secrets');
    console.log('  validate  Validate current JWT_SECRET');
    console.log('  jwt       Generate only JWT secret');
    console.log('  help      Show this help message');
    console.log('  (none)    Interactive setup\n');
    console.log('Examples:');
    console.log('  node scripts/setup-environment.js');
    console.log('  node scripts/setup-environment.js generate');
    console.log('  node scripts/setup-environment.js validate');
  }
}

// Run the setup if called directly
if (require.main === module) {
  const setup = new EnvironmentSetup();
  setup.run().catch(error => {
    console.error(`${colors.red}❌ Setup failed:${colors.reset}`, error.message);
    process.exit(1);
  });
}

module.exports = EnvironmentSetup;