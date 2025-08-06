// Password Validation System for Authentication Security
// TDD GREEN Phase - Minimal implementation to pass tests

class PasswordValidator {
  constructor(config = {}) {
    this.config = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      forbiddenPasswords: ['password', '123456', 'qwerty', 'admin'],
      maxRepeatingChars: 3,
      preventCommonPatterns: true,
      ...config
    };
    
    // Common keyboard patterns
    this.keyboardPatterns = [
      'qwerty', 'qwertyuiop', 'asdf', 'asdfghjkl', 'zxcv', 'zxcvbnm',
      '1234', '12345', '123456', '1234567', '12345678', '123456789',
      'abcd', 'abcde', 'abcdef', 'abcdefg'
    ];
    
    // Sequential patterns
    this.sequentialPatterns = [
      '0123', '1234', '2345', '3456', '4567', '5678', '6789', '789', '987', '321', '123',
      'abcd', 'bcde', 'cdef', 'defg', 'efgh', 'fghi', 'ghij', 'abc', 'cba'
    ];
  }

  validate(password, userInfo = null, passwordHistory = []) {
    const errors = [];
    const suggestions = [];
    let strength = 0;
    
    // Basic length validation
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
      suggestions.push(`Make your password longer (at least ${this.config.minLength} characters)`);
    } else {
      // More conservative length scoring - shorter passwords get less credit
      const lengthBonus = Math.min(15, Math.log(password.length / this.config.minLength + 1) * 20);
      strength += lengthBonus;
    }
    
    if (password.length > this.config.maxLength) {
      errors.push(`Password must not exceed ${this.config.maxLength} characters`);
    }
    
    // Character type requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
      suggestions.push('Add uppercase letters');
    } else if (/[A-Z]/.test(password)) {
      strength += 8;
    }
    
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
      suggestions.push('Add lowercase letters');
    } else if (/[a-z]/.test(password)) {
      strength += 8;
    }
    
    if (this.config.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
      suggestions.push('Add numbers');
    } else if (/[0-9]/.test(password)) {
      strength += 8;
    }
    
    if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
      suggestions.push('Add special characters (!@#$%^&*)');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      strength += 12; // Special chars get a bit more credit
    }
    
    // Forbidden passwords check
    const lowerPassword = password.toLowerCase();
    const hasForbiddenWord = this.config.forbiddenPasswords.some(forbidden => {
      const lowerForbidden = forbidden.toLowerCase();
      // Exact match for common passwords or significant substring (>= 50% of password)
      return lowerPassword === lowerForbidden || 
             (lowerPassword.includes(lowerForbidden) && lowerForbidden.length >= password.length * 0.5);
    });
    
    if (hasForbiddenWord) {
      errors.push('Password is too common and easily guessable');
      suggestions.push('Use a unique password that is not commonly used');
    }
    
    // Repeating characters check
    if (this.config.maxRepeatingChars && this.hasExcessiveRepeatingChars(password)) {
      errors.push('Password contains too many repeating characters');
      suggestions.push('Avoid repeating the same character too many times');
    } else {
      strength += 5;
    }
    
    // Pattern checks
    if (this.config.preventCommonPatterns) {
      if (this.containsKeyboardPatterns(password)) {
        errors.push('Password contains common keyboard patterns');
        suggestions.push('Avoid keyboard patterns like "qwerty" or "123456"');
      } else {
        strength += 5;
      }
      
      if (this.containsSequentialPatterns(password)) {
        errors.push('Password contains sequential patterns');
        suggestions.push('Avoid sequential patterns like "abc" or "123"');
      } else {
        strength += 5;
      }
    }
    
    // User information check
    if (userInfo && this.containsUserInfo(password, userInfo)) {
      errors.push('Password must not contain personal information');
      suggestions.push('Avoid using your name, username, or email in your password');
    } else if (userInfo) {
      strength += 5;
    }
    
    // Password history check
    if (passwordHistory.length > 0 && passwordHistory.includes(password)) {
      errors.push('Password has been used recently and cannot be reused');
      suggestions.push('Choose a password you have not used before');
    }
    
    // Bonus for password diversity (increased for complex passwords)
    const uniqueChars = new Set(password).size;
    const diversityBonus = Math.min(15, (uniqueChars / password.length) * 15);
    strength += diversityBonus;
    
    // Extra bonus for very long passwords (16+ chars)
    if (password.length >= 16) {
      strength += Math.min(15, (password.length - 16) * 2 + 5);
    }
    
    // Penalize strength for errors - adjust penalty based on error severity
    if (errors.length > 0) {
      // Major errors (missing requirements) get higher penalty
      const majorErrors = errors.filter(e => 
        e.includes('must contain') || e.includes('must be at least') || e.includes('too common')
      ).length;
      // Minor errors (patterns) get lower penalty  
      const minorErrors = errors.length - majorErrors;
      
      const penalty = (majorErrors * 40) + (minorErrors * 30); // Major errors are more significant
      strength = Math.max(0, strength - penalty);
    }
    
    // Cap strength at 100
    strength = Math.min(100, strength);
    
    const strengthLabel = this.getStrengthLabel(strength);
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      suggestions: suggestions,
      strength: Math.round(strength),
      strengthLabel: strengthLabel
    };
  }

  hasExcessiveRepeatingChars(password) {
    let currentChar = '';
    let currentCount = 1;
    
    for (let i = 0; i < password.length; i++) {
      if (password[i] === currentChar) {
        currentCount++;
        if (currentCount > this.config.maxRepeatingChars) {
          return true;
        }
      } else {
        currentChar = password[i];
        currentCount = 1;
      }
    }
    
    return false;
  }

  containsKeyboardPatterns(password) {
    const lowerPassword = password.toLowerCase();
    // Only flag if the pattern makes up a significant portion of the password
    return this.keyboardPatterns.some(pattern => {
      const hasPattern = lowerPassword.includes(pattern) || lowerPassword.includes(pattern.split('').reverse().join(''));
      // Only consider it weak if the pattern is a significant portion of the password (at least 4 chars and 30% of password)
      return hasPattern && pattern.length >= 4 && (pattern.length / password.length) >= 0.3;
    });
  }

  containsSequentialPatterns(password) {
    const lowerPassword = password.toLowerCase();
    return this.sequentialPatterns.some(pattern => {
      const hasPattern = lowerPassword.includes(pattern) || lowerPassword.includes(pattern.split('').reverse().join(''));
      // For short patterns (3 chars), be more lenient but still flag
      if (pattern.length === 3) {
        // Flag if it makes up >= 20% of password
        return hasPattern && (pattern.length / password.length) >= 0.2;
      }
      // For longer patterns (4+ chars), flag if present
      return hasPattern;
    });
  }

  containsUserInfo(password, userInfo) {
    const lowerPassword = password.toLowerCase();
    
    const checkFields = ['username', 'email', 'firstName', 'lastName'];
    
    for (const field of checkFields) {
      if (userInfo[field]) {
        const value = userInfo[field].toLowerCase();
        if (lowerPassword.includes(value) || value.includes(lowerPassword)) {
          return true;
        }
        
        // Check parts of email (before @)
        if (field === 'email' && value.includes('@')) {
          const emailPrefix = value.split('@')[0];
          if (lowerPassword.includes(emailPrefix) || emailPrefix.includes(lowerPassword)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  getStrengthLabel(strength) {
    if (strength < 20) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 70) return 'Fair';
    if (strength < 90) return 'Strong';
    return 'Very Strong';
  }

  // Utility methods for integration
  static getDefaultConfig() {
    return {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      forbiddenPasswords: ['password', '123456', 'qwerty', 'admin'],
      maxRepeatingChars: 3,
      preventCommonPatterns: true
    };
  }

  // Express middleware for password validation
  expressMiddleware() {
    return (req, res, next) => {
      const password = req.body.password;
      const userInfo = req.body.userInfo || null;
      const passwordHistory = req.body.passwordHistory || [];
      
      if (password) {
        const validation = this.validate(password, userInfo, passwordHistory);
        req.passwordValidation = validation;
        
        if (!validation.isValid) {
          return res.status(400).json({
            error: 'Password validation failed',
            details: validation.errors,
            suggestions: validation.suggestions
          });
        }
      }
      
      next();
    };
  }
}

module.exports = PasswordValidator;