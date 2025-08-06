// Registration Form Component
// Extracted from AuthUI for better modularity

class RegisterForm {
  constructor(authManager, onSuccess, onError) {
    this.authManager = authManager;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.element = null;
    this.isValid = false;

    // Validation rules
    this.validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      username: /^[a-zA-Z0-9_]{3,20}$/
    };
  }

  create() {
    const form = document.createElement('form');
    form.className = 'auth-form register-form';
    form.innerHTML = `
      <div class="auth-header">
        <h2>Join Memex Racing</h2>
      </div>
      <div class="form-group">
        <input type="text" id="register-username" placeholder="Username" required>
        <small class="help-text">3-20 characters, letters, numbers, and underscores only</small>
      </div>
      <div class="form-group">
        <input type="email" id="register-email" placeholder="Email" required>
      </div>
      <div class="form-group">
        <input type="password" id="register-password" placeholder="Password" required>
        <small class="help-text">At least 8 characters with uppercase, lowercase, number, and special character</small>
      </div>
      <div class="form-group">
        <input type="password" id="register-confirm-password" placeholder="Confirm Password" required>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="accept-terms" required> I accept the Terms of Service
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Register</button>
        <button type="button" class="btn-secondary" id="show-login">Login</button>
      </div>
      <div class="error-message" id="register-error" style="display: none;"></div>
    `;

    // Add event listeners
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Real-time validation feedback
    form.addEventListener('input', this.handleInputChange.bind(this));
    
    this.element = form;
    return form;
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    const formData = this.getFormData();
    if (!this.validate(formData)) {
      return;
    }

    try {
      // Remove confirmPassword before sending to server
      const { confirmPassword, acceptTerms, ...userData } = formData;
      
      const result = await this.authManager.register(userData);
      if (result && result.success) {
        this.onSuccess(result);
      } else {
        this.onError('Registration failed. Please try again.');
      }
    } catch (error) {
      this.onError(error.message || 'Registration failed. Please try again.');
    }
  }

  handleInputChange(event) {
    const field = event.target;
    this.validateField(field);
  }

  validateField(field) {
    const value = field.value;
    const fieldType = field.id.replace('register-', '');
    
    // Clear previous validation styling
    field.classList.remove('valid', 'invalid');
    
    switch (fieldType) {
      case 'username':
        if (value && this.validationRules.username.test(value)) {
          field.classList.add('valid');
        } else if (value) {
          field.classList.add('invalid');
        }
        break;
        
      case 'email':
        if (value && this.validationRules.email.test(value)) {
          field.classList.add('valid');
        } else if (value) {
          field.classList.add('invalid');
        }
        break;
        
      case 'password':
        if (value && this.validationRules.password.test(value)) {
          field.classList.add('valid');
        } else if (value) {
          field.classList.add('invalid');
        }
        break;
        
      case 'confirm-password':
        const password = document.getElementById('register-password')?.value;
        if (value && value === password) {
          field.classList.add('valid');
        } else if (value) {
          field.classList.add('invalid');
        }
        break;
    }
  }

  getFormData() {
    return {
      username: document.getElementById('register-username')?.value || '',
      email: document.getElementById('register-email')?.value || '',
      password: document.getElementById('register-password')?.value || '',
      confirmPassword: document.getElementById('register-confirm-password')?.value || '',
      acceptTerms: document.getElementById('accept-terms')?.checked || false
    };
  }

  validate(data) {
    this.clearErrors();

    // Username validation
    if (!data.username || !this.validationRules.username.test(data.username)) {
      this.showError('Username must be 3-20 characters, letters, numbers, and underscores only');
      return false;
    }

    // Email validation
    if (!data.email || !this.validationRules.email.test(data.email)) {
      this.showError('Please enter a valid email address');
      return false;
    }

    // Password validation
    if (!data.password || !this.validationRules.password.test(data.password)) {
      this.showError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return false;
    }

    // Confirm password validation
    if (data.password !== data.confirmPassword) {
      this.showError('Passwords do not match');
      return false;
    }

    // Terms acceptance validation
    if (!data.acceptTerms) {
      this.showError('You must accept the Terms of Service to register');
      return false;
    }

    this.isValid = true;
    return true;
  }

  showError(message) {
    this.isValid = false;
    const errorElement = document.getElementById('register-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  clearErrors() {
    this.isValid = false;
    const errorElement = document.getElementById('register-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

module.exports = RegisterForm;