// TDD RED Phase - Write failing test for Password Validation System
const PasswordValidator = require('../../src/auth/PasswordValidator.js');

describe('PasswordValidator', () => {
  let passwordValidator;
  const mockConfig = {
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

  beforeEach(() => {
    passwordValidator = new PasswordValidator(mockConfig);
  });

  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Act & Assert
      expect(() => {
        const validator = new PasswordValidator(mockConfig);
        expect(validator).toBeDefined();
      }).not.toThrow();
    });

    it('should use default config when not provided', () => {
      // Act
      const validator = new PasswordValidator({});

      // Assert
      expect(validator.config.minLength).toBeDefined();
      expect(validator.config.requireUppercase).toBeDefined();
      expect(validator.config.requireNumbers).toBeDefined();
    });
  });

  describe('basic validation rules', () => {
    it('should accept strong passwords', () => {
      // Arrange
      const strongPasswords = [
        'MySecureP@ssw0rd123',
        'Another$trongPa55word!',
        'C0mpl3x!P@ssw0rd$2023',
        'MyV3ryStr0ng&SecureP@ss!'
      ];

      // Act & Assert
      strongPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords that are too short', () => {
      // Arrange
      const shortPasswords = ['1234567', 'Abc!1', 'Short1!'];

      // Act & Assert
      shortPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });
    });

    it('should reject passwords that are too long', () => {
      // Arrange
      const longPassword = 'A'.repeat(129) + '1!';

      // Act
      const result = passwordValidator.validate(longPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    it('should require uppercase letters when configured', () => {
      // Arrange
      const noUppercasePasswords = ['mypassword123!', 'lower_case_p@ss1'];

      // Act & Assert
      noUppercasePasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
      });
    });

    it('should require lowercase letters when configured', () => {
      // Arrange
      const noLowercasePasswords = ['MYPASSWORD123!', 'UPPER_CASE_P@SS1'];

      // Act & Assert
      noLowercasePasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });
    });

    it('should require numbers when configured', () => {
      // Arrange
      const noNumberPasswords = ['MyPassword!', 'NoNumbers@Here'];

      // Act & Assert
      noNumberPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
      });
    });

    it('should require special characters when configured', () => {
      // Arrange
      const noSpecialCharPasswords = ['MyPassword123', 'NoSpecialChars1'];

      // Act & Assert
      noSpecialCharPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one special character');
      });
    });
  });

  describe('advanced validation rules', () => {
    it('should reject common weak passwords', () => {
      // Arrange
      const weakPasswords = ['password', '123456', 'qwerty', 'admin'];

      // Act & Assert
      weakPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common and easily guessable');
      });
    });

    it('should reject passwords with too many repeating characters', () => {
      // Arrange
      const repeatingPasswords = ['Aaaaa123!', 'MyPass1111!', 'Test@@@@1'];

      // Act & Assert
      repeatingPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password contains too many repeating characters');
      });
    });

    it('should reject keyboard patterns', () => {
      // Arrange
      const patternPasswords = ['Qwerty123!', 'Asdf123!', '123456Aa!'];

      // Act & Assert
      patternPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password contains common keyboard patterns');
      });
    });

    it('should reject sequential patterns', () => {
      // Arrange
      const sequentialPasswords = ['Abc123!test', 'Password987!', 'Test321!abc'];

      // Act & Assert
      sequentialPasswords.forEach(password => {
        const result = passwordValidator.validate(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password contains sequential patterns');
      });
    });
  });

  describe('user information validation', () => {
    it('should reject passwords containing user information', () => {
      // Arrange
      const userInfo = {
        username: 'johndoe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };
      const personalPasswords = [
        'johndoe123!',
        'John123!test',
        'MyDoe123!',
        'john.doe123!'
      ];

      // Act & Assert
      personalPasswords.forEach(password => {
        const result = passwordValidator.validate(password, userInfo);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must not contain personal information');
      });
    });

    it('should accept passwords without user information', () => {
      // Arrange
      const userInfo = {
        username: 'johndoe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };
      const acceptablePassword = 'MySecureP@ssw0rd123';

      // Act
      const result = passwordValidator.validate(acceptablePassword, userInfo);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('password strength scoring', () => {
    it('should calculate password strength scores', () => {
      // Arrange
      const passwords = [
        { password: 'weak', expectedRange: [0, 20] },
        { password: 'Weak123!', expectedRange: [40, 60] },
        { password: 'StrongerP@ssw0rd123', expectedRange: [80, 100] },
        { password: 'ExtremelyStr0ng&C0mpl3xP@ssw0rd!2023', expectedRange: [90, 100] }
      ];

      // Act & Assert
      passwords.forEach(({ password, expectedRange }) => {
        const result = passwordValidator.validate(password);
        expect(result.strength).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(result.strength).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should provide strength labels', () => {
      // Arrange
      const testCases = [
        { password: 'weak', expectedLabel: 'Very Weak' },
        { password: 'Weak123!', expectedLabel: 'Weak' },
        { password: 'StrongerP@ssw0rd123', expectedLabel: 'Strong' },
        { password: 'ExtremelyStr0ng&C0mpl3xP@ssw0rd!2023', expectedLabel: 'Very Strong' }
      ];

      // Act & Assert
      testCases.forEach(({ password, expectedLabel }) => {
        const result = passwordValidator.validate(password);
        expect(result.strengthLabel).toBe(expectedLabel);
      });
    });
  });

  describe('password validation suggestions', () => {
    it('should provide helpful suggestions for weak passwords', () => {
      // Arrange
      const weakPassword = 'weak';

      // Act
      const result = passwordValidator.validate(weakPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain('Make your password longer (at least 8 characters)');
      expect(result.suggestions).toContain('Add uppercase letters');
      expect(result.suggestions).toContain('Add numbers');
      expect(result.suggestions).toContain('Add special characters (!@#$%^&*)');
    });

    it('should provide fewer suggestions for stronger passwords', () => {
      // Arrange
      const strongerPassword = 'StrongerP@ssw0rd123';

      // Act
      const result = passwordValidator.validate(strongerPassword);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeLessThan(3);
    });
  });

  describe('password history validation', () => {
    it('should reject recently used passwords', () => {
      // Arrange
      const passwordHistory = ['OldPassword123!', 'PreviousPass456!', 'FormerPassword789!'];
      const reusedPassword = 'OldPassword123!';

      // Act
      const result = passwordValidator.validate(reusedPassword, null, passwordHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password has been used recently and cannot be reused');
    });

    it('should accept passwords not in history', () => {
      // Arrange
      const passwordHistory = ['OldPassword123!', 'PreviousPass456!', 'FormerPassword789!'];
      const newPassword = 'BrandNewP@ssw0rd123!';

      // Act
      const result = passwordValidator.validate(newPassword, null, passwordHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain('Password has been used recently and cannot be reused');
    });
  });

  describe('customizable validation rules', () => {
    it('should allow disabling specific rules', () => {
      // Arrange
      const lenientConfig = {
        ...mockConfig,
        requireUppercase: false,
        requireSpecialChars: false,
        preventCommonPatterns: false // Also disable pattern checking
      };
      const lenientValidator = new PasswordValidator(lenientConfig);
      const simplePassword = 'simplepass67'; // Use simple password without patterns

      // Act
      const result = lenientValidator.validate(simplePassword);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should support custom forbidden password lists', () => {
      // Arrange
      const customConfig = {
        ...mockConfig,
        forbiddenPasswords: ['memexracing', 'gamingpass', 'racepass']
      };
      const customValidator = new PasswordValidator(customConfig);

      // Act
      const result = customValidator.validate('memexracing123!');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common and easily guessable');
    });
  });
});