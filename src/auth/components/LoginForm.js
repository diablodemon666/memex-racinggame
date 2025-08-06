// Login Form Component
// Extracted from AuthUI for better modularity

class LoginForm {
  constructor(authManager, onSuccess, onError) {
    this.authManager = authManager;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.element = null;
    this.isValid = false;
  }

  create() {
    const form = document.createElement('form');
    form.className = 'auth-form login-form';
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
      <div class="form-group">
        <label>
          <input type="checkbox" id="remember-me"> Remember me
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Login</button>
        <button type="button" class="btn-secondary" id="show-register">Register</button>
      </div>
      <div class="error-message" id="login-error" style="display: none;"></div>
    `;

    // Add event listeners
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
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
      const result = await this.authManager.login(formData);
      if (result && result.success) {
        this.onSuccess(result);
      } else {
        this.onError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      this.onError(error.message || 'Login failed. Please try again.');
    }
  }

  getFormData() {
    return {
      username: document.getElementById('login-username')?.value || '',
      password: document.getElementById('login-password')?.value || '',
      rememberMe: document.getElementById('remember-me')?.checked || false
    };
  }

  validate(data) {
    this.clearErrors();

    if (!data.username || data.username.trim().length === 0) {
      this.showError('Username is required');
      return false;
    }

    if (!data.password || data.password.length === 0) {
      this.showError('Password is required');
      return false;
    }

    this.isValid = true;
    return true;
  }

  showError(message) {
    this.isValid = false;
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  clearErrors() {
    this.isValid = false;
    const errorElement = document.getElementById('login-error');
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

module.exports = LoginForm;