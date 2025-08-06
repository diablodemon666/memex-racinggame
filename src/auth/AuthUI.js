// Authentication UI Components
// TDD GREEN Phase - Minimal implementation to pass tests

class AuthUI {
  constructor(authManager, phaserScene) {
    if (!authManager) {
      throw new Error('AuthManager is required');
    }
    
    if (!phaserScene) {
      throw new Error('Phaser scene is required');
    }
    
    this.authManager = authManager;
    this.phaserScene = phaserScene;
    
    // UI state
    this.isVisible = false;
    this.currentForm = null;
    this.hasErrors = false;
    this.errorMessage = '';
    
    // Form references
    this.loginForm = null;
    this.registerForm = null;
    this.domElements = [];
    
    // Form validation rules
    this.validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      username: /^[a-zA-Z0-9_]{3,20}$/
    };
  }

  // Form creation methods
  showLoginForm() {
    this.hideAllForms();
    this.createLoginForm();
    this.currentForm = 'login';
    this.isVisible = true;
    this.clearErrors();
  }

  showRegistrationForm() {
    this.hideAllForms();
    this.createRegistrationForm();
    this.currentForm = 'register';
    this.isVisible = true;
    this.clearErrors();
  }

  createLoginForm() {
    // Create form container
    const formContainer = this.createFormContainer('login-form');
    
    // Create form elements
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="auth-header">
        <h2>Login to Memex Racing</h2>
      </div>
      <div class="form-group">
        <input type="text" id="login-username" placeholder="Username" required>
      </div>
      <div class="form-group">
        <input type="password" id="login-password" placeholder="Password" required>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Login</button>
        <button type="button" class="btn-secondary" id="show-register">Register</button>
      </div>
      <div class="error-message" id="login-error" style="display: none;"></div>
    `;
    
    formContainer.appendChild(form);
    
    // Add event listeners
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = this.getLoginFormData();
      this.submitLoginForm(formData);
    });
    
    form.querySelector('#show-register').addEventListener('click', () => {
      this.showRegistrationForm();
    });
    
    // Create Phaser DOM element
    const domElement = this.phaserScene.add.dom(
      this.phaserScene.cameras.main.width / 2,
      this.phaserScene.cameras.main.height / 2,
      formContainer
    ).setOrigin(0.5).setDepth(1000);
    
    this.loginForm = { container: formContainer, domElement, form };
    this.domElements.push(domElement);
  }

  createRegistrationForm() {
    // Create form container
    const formContainer = this.createFormContainer('register-form');
    
    // Create form elements
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="auth-header">
        <h2>Join Memex Racing</h2>
      </div>
      <div class="form-group">
        <input type="text" id="register-username" placeholder="Username" required>
      </div>
      <div class="form-group">
        <input type="email" id="register-email" placeholder="Email" required>
      </div>
      <div class="form-group">
        <input type="password" id="register-password" placeholder="Password" required>
      </div>
      <div class="form-group">
        <input type="password" id="register-confirm-password" placeholder="Confirm Password" required>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Register</button>
        <button type="button" class="btn-secondary" id="show-login">Login</button>
      </div>
      <div class="error-message" id="register-error" style="display: none;"></div>
    `;
    
    formContainer.appendChild(form);
    
    // Add event listeners
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = this.getRegistrationFormData();
      this.submitRegistrationForm(formData);
    });
    
    form.querySelector('#show-login').addEventListener('click', () => {
      this.showLoginForm();
    });
    
    // Create Phaser DOM element
    const domElement = this.phaserScene.add.dom(
      this.phaserScene.cameras.main.width / 2,
      this.phaserScene.cameras.main.height / 2,
      formContainer
    ).setOrigin(0.5).setDepth(1000);
    
    this.registerForm = { container: formContainer, domElement, form };
    this.domElements.push(domElement);
  }

  createFormContainer(id) {
    const container = document.createElement('div');
    container.id = id;
    container.className = 'auth-form-container';
    
    // Basic styling for game integration
    container.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ff00;
      border-radius: 10px;
      padding: 30px;
      font-family: 'Courier New', monospace;
      color: #00ff00;
      width: 400px;
      text-align: center;
    `;
    
    return container;
  }

  // Form data extraction
  getLoginFormData() {
    return {
      username: document.getElementById('login-username')?.value || '',
      password: document.getElementById('login-password')?.value || ''
    };
  }

  getRegistrationFormData() {
    return {
      username: document.getElementById('register-username')?.value || '',
      email: document.getElementById('register-email')?.value || '',
      password: document.getElementById('register-password')?.value || '',
      confirmPassword: document.getElementById('register-confirm-password')?.value || ''
    };
  }

  // Form validation
  validateLoginForm(loginData) {
    this.clearErrors();
    
    if (!loginData.username || loginData.username.trim().length === 0) {
      this.setError('Username is required');
      return false;
    }
    
    if (!loginData.password || loginData.password.length === 0) {
      this.setError('Password is required');
      return false;
    }
    
    return true;
  }

  validateRegistrationForm(registrationData) {
    this.clearErrors();
    
    // Username validation
    if (!registrationData.username || !this.validationRules.username.test(registrationData.username)) {
      this.setError('Username must be 3-20 characters, letters, numbers, and underscores only');
      return false;
    }
    
    // Email validation
    if (!registrationData.email || !this.validationRules.email.test(registrationData.email)) {
      this.setError('Please enter a valid email address');
      return false;
    }
    
    // Password validation
    if (!registrationData.password || !this.validationRules.password.test(registrationData.password)) {
      this.setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return false;
    }
    
    // Confirm password validation
    if (registrationData.password !== registrationData.confirmPassword) {
      this.setError('Passwords do not match');
      return false;
    }
    
    return true;
  }

  // Form submission
  async submitLoginForm(loginData) {
    try {
      if (!this.validateLoginForm(loginData)) {
        return;
      }
      
      const result = await this.authManager.login(loginData);
      
      if (result && result.success) {
        this.onAuthenticationSuccess();
      } else {
        this.setError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      this.setError(error.message || 'Login failed. Please try again.');
    }
  }

  async submitRegistrationForm(registrationData) {
    try {
      if (!this.validateRegistrationForm(registrationData)) {
        return;
      }
      
      // Remove confirmPassword before sending to server
      const { confirmPassword, ...userData } = registrationData;
      
      const result = await this.authManager.register(userData);
      
      if (result && result.success) {
        this.onAuthenticationSuccess();
      } else {
        this.setError('Registration failed. Please try again.');
      }
    } catch (error) {
      this.setError(error.message || 'Registration failed. Please try again.');
    }
  }

  // Authentication success handler
  onAuthenticationSuccess() {
    this.clearErrors();
    this.hide();
    
    // Emit success event if needed
    if (this.phaserScene.events) {
      this.phaserScene.events.emit('authentication-success');
    }
  }

  // Error handling
  setError(message) {
    this.hasErrors = true;
    this.errorMessage = message;
    
    // Display error in current form
    const errorElement = document.getElementById(`${this.currentForm}-error`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  clearErrors() {
    this.hasErrors = false;
    this.errorMessage = '';
    
    // Clear error displays
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
      element.textContent = '';
      element.style.display = 'none';
    });
  }

  // UI state management
  hide() {
    this.hideAllForms();
    this.isVisible = false;
    this.currentForm = null;
    this.clearErrors();
  }

  hideAllForms() {
    this.domElements.forEach(element => {
      if (element && element.setVisible) {
        element.setVisible(false);
      }
    });
  }

  shouldShowAuthUI() {
    return !this.authManager.isAuthenticated();
  }

  // Cleanup
  destroy() {
    this.domElements.forEach(element => {
      if (element && element.destroy) {
        element.destroy();
      }
    });
    
    this.loginForm = null;
    this.registerForm = null;
    this.domElements = [];
    this.isVisible = false;
    this.currentForm = null;
    this.clearErrors();
  }
}

module.exports = AuthUI;