// TDD RED Phase - Write failing test for Authentication UI Components
const AuthUI = require('../../src/auth/AuthUI.js');

// Mock DOM environment for testing
const mockElement = {
  style: { cssText: '' },
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn()
  },
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  innerHTML: '',
  value: '',
  type: 'text',
  placeholder: '',
  id: '',
  className: '',
  textContent: '',
  querySelector: jest.fn(() => mockElement),
  querySelectorAll: jest.fn(() => [mockElement])
};

Object.defineProperty(global, 'document', {
  value: {
    createElement: jest.fn(() => ({ ...mockElement })),
    getElementById: jest.fn(() => mockElement),
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn()
    },
    querySelector: jest.fn(() => mockElement),
    querySelectorAll: jest.fn(() => [mockElement]),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  writable: true
});

describe('AuthUI', () => {
  let authUI;
  let mockAuthManager;
  let mockPhaserScene;

  beforeEach(() => {
    // Mock AuthManager
    mockAuthManager = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      isAuthenticated: jest.fn(() => false),
      getCurrentUser: jest.fn(() => null)
    };

    // Mock Phaser scene
    const mockDomElement = {
      setPosition: jest.fn().mockReturnThis(),
      setOrigin: jest.fn().mockReturnThis(),
      setDepth: jest.fn().mockReturnThis(),
      setVisible: jest.fn().mockReturnThis(),
      destroy: jest.fn()
    };

    mockPhaserScene = {
      add: {
        dom: jest.fn(() => mockDomElement)
      },
      cameras: {
        main: {
          width: 1920,
          height: 1080
        }
      },
      events: {
        emit: jest.fn()
      }
    };

    authUI = new AuthUI(mockAuthManager, mockPhaserScene);
  });

  describe('instantiation', () => {
    it('should instantiate with valid dependencies', () => {
      // Act & Assert
      expect(() => {
        const ui = new AuthUI(mockAuthManager, mockPhaserScene);
        expect(ui).toBeDefined();
      }).not.toThrow();
    });

    it('should throw error without AuthManager', () => {
      // Act & Assert
      expect(() => {
        new AuthUI(null, mockPhaserScene);
      }).toThrow('AuthManager is required');
    });

    it('should throw error without Phaser scene', () => {
      // Act & Assert
      expect(() => {
        new AuthUI(mockAuthManager, null);
      }).toThrow('Phaser scene is required');
    });
  });

  describe('UI creation', () => {
    it('should create login form when showing login UI', () => {
      // Act
      authUI.showLoginForm();

      // Assert
      expect(authUI.loginForm).toBeDefined();
      expect(authUI.isVisible).toBe(true);
    });

    it('should create registration form when showing register UI', () => {
      // Act
      authUI.showRegistrationForm();

      // Assert
      expect(authUI.registerForm).toBeDefined();
      expect(authUI.isVisible).toBe(true);
    });

    it('should integrate with Phaser scene overlay system', () => {
      // Act
      authUI.showLoginForm();

      // Assert
      expect(mockPhaserScene.add.dom).toHaveBeenCalled();
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      authUI.showLoginForm();
    });

    it('should validate login form fields', () => {
      // Arrange
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      // Act
      const isValid = authUI.validateLoginForm(loginData);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject empty username', () => {
      // Arrange
      const loginData = {
        username: '',
        password: 'password123'
      };

      // Act
      const isValid = authUI.validateLoginForm(loginData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject empty password', () => {
      // Arrange
      const loginData = {
        username: 'testuser',
        password: ''
      };

      // Act
      const isValid = authUI.validateLoginForm(loginData);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('registration validation', () => {
    beforeEach(() => {
      authUI.showRegistrationForm();
    });

    it('should validate registration form fields', () => {
      // Arrange
      const registrationData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      // Act
      const isValid = authUI.validateRegistrationForm(registrationData);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject invalid email format', () => {
      // Arrange
      const registrationData = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      // Act
      const isValid = authUI.validateRegistrationForm(registrationData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject weak password', () => {
      // Arrange
      const registrationData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      };

      // Act
      const isValid = authUI.validateRegistrationForm(registrationData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject password mismatch', () => {
      // Arrange
      const registrationData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!'
      };

      // Act
      const isValid = authUI.validateRegistrationForm(registrationData);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('form submission', () => {
    it('should handle login form submission', async () => {
      // Arrange
      mockAuthManager.login.mockResolvedValue({ success: true });
      authUI.showLoginForm();

      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      // Act
      await authUI.submitLoginForm(loginData);

      // Assert
      expect(mockAuthManager.login).toHaveBeenCalledWith(loginData);
    });

    it('should handle registration form submission', async () => {
      // Arrange
      mockAuthManager.register.mockResolvedValue({ success: true });
      authUI.showRegistrationForm();

      const registrationData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      // Act
      await authUI.submitRegistrationForm(registrationData);

      // Assert
      expect(mockAuthManager.register).toHaveBeenCalledWith(
        expect.objectContaining({
          username: registrationData.username,
          email: registrationData.email,
          password: registrationData.password
        })
      );
    });

    it('should display error messages on form submission failure', async () => {
      // Arrange
      mockAuthManager.login.mockRejectedValue(new Error('Invalid credentials'));
      authUI.showLoginForm();

      const loginData = {
        username: 'wronguser',
        password: 'wrongpass'
      };

      // Act
      await authUI.submitLoginForm(loginData);

      // Assert
      expect(authUI.hasErrors).toBe(true);
      expect(authUI.errorMessage).toContain('Invalid credentials');
    });
  });

  describe('UI state management', () => {
    it('should hide UI when hide method is called', () => {
      // Arrange
      authUI.showLoginForm();
      expect(authUI.isVisible).toBe(true);

      // Act
      authUI.hide();

      // Assert
      expect(authUI.isVisible).toBe(false);
    });

    it('should switch between login and registration forms', () => {
      // Act
      authUI.showLoginForm();
      expect(authUI.currentForm).toBe('login');

      authUI.showRegistrationForm();
      expect(authUI.currentForm).toBe('register');
    });

    it('should cleanup resources when destroyed', () => {
      // Arrange
      authUI.showLoginForm();

      // Act
      authUI.destroy();

      // Assert
      expect(authUI.loginForm).toBeNull();
      expect(authUI.registerForm).toBeNull();
      expect(authUI.isVisible).toBe(false);
    });
  });

  describe('authentication state integration', () => {
    it('should automatically hide when user becomes authenticated', async () => {
      // Arrange
      authUI.showLoginForm();
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      mockAuthManager.login.mockResolvedValue({ success: true });

      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      // Act
      await authUI.submitLoginForm(loginData);

      // Assert
      expect(authUI.isVisible).toBe(false);
    });

    it('should show appropriate UI based on authentication status', () => {
      // Arrange - user not authenticated
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      // Act
      const shouldShow = authUI.shouldShowAuthUI();

      // Assert
      expect(shouldShow).toBe(true);
    });

    it('should not show UI when user is already authenticated', () => {
      // Arrange - user authenticated
      mockAuthManager.isAuthenticated.mockReturnValue(true);

      // Act
      const shouldShow = authUI.shouldShowAuthUI();

      // Assert
      expect(shouldShow).toBe(false);
    });
  });
});