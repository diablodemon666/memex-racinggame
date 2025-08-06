// Password Reset Management System
// Secure token-based password reset for Memex Racing game

const crypto = require('crypto');
const { EventEmitter } = require('events');

class PasswordResetManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Reset token storage
    this.resetTokens = new Map(); // token -> reset data
    this.userResetAttempts = new Map(); // userId -> attempt data
    this.emailResetAttempts = new Map(); // email -> attempt data
    
    // Rate limiting
    this.rateLimiter = new Map(); // identifier -> rate limit data
    
    // Cleanup timer
    this.cleanupInterval = null;
    
    this.startCleanupProcess();
    
    console.log('[PasswordResetManager] Initialized with secure reset functionality');
  }

  validateConfig(config) {
    return {
      // Token configuration
      tokenLength: 32,
      tokenExpiry: 60 * 60 * 1000, // 1 hour
      maxActiveTokensPerUser: 3,
      
      // Rate limiting
      maxRequestsPerHour: 5,
      maxRequestsPerDay: 10,
      rateLimitWindow: 60 * 60 * 1000, // 1 hour
      
      // Security configuration
      requireEmailVerification: true,
      allowMultipleActiveTokens: false,
      
      // Cleanup configuration
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      
      // Email configuration (mock for development)
      emailService: {
        enabled: false, // Set to true when email service is configured
        provider: 'mock',
        templates: {
          resetRequest: 'password-reset-request',
          resetSuccess: 'password-reset-success'
        }
      },
      
      ...config
    };
  }

  // Initiate password reset request
  async requestPasswordReset(identifier, options = {}) {
    try {
      // Validate input
      if (!identifier || typeof identifier !== 'string') {
        throw new Error('Email or username is required');
      }
      
      // Rate limiting check
      this.checkRateLimit(identifier, options.ipAddress);
      
      // Find user by email or username
      const user = await this.findUserByIdentifier(identifier);
      if (!user) {
        // Don't reveal if user exists - always return success
        console.log(`[PasswordResetManager] Reset requested for non-existent user: ${identifier}`);
        return this.createSuccessResponse();
      }
      
      // Check user-specific rate limits
      this.checkUserRateLimit(user.id);
      
      // Invalidate existing tokens if not allowing multiple
      if (!this.config.allowMultipleActiveTokens) {
        this.invalidateUserTokens(user.id);
      }
      
      // Generate secure reset token
      const resetToken = await this.generateResetToken(user, options);
      
      // Send reset email (mock implementation)
      await this.sendResetEmail(user, resetToken);
      
      // Log reset request
      this.logResetRequest(user.id, identifier, options.ipAddress);
      
      // Emit event
      this.emit('resetRequested', {
        userId: user.id,
        username: user.username,
        email: user.email,
        token: resetToken.token,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      return this.createSuccessResponse();
      
    } catch (error) {
      // Log failed attempt
      this.logFailedAttempt(identifier, options.ipAddress, error.message);
      
      // For security, don't reveal specific error details
      if (error.message.includes('Rate limit') || error.message.includes('Too many')) {
        throw error;
      }
      
      // Generic error response to prevent user enumeration
      throw new Error('If the email exists, a reset link will be sent');
    }
  }

  // Verify reset token
  async verifyResetToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Reset token is required');
      }
      
      const resetData = this.resetTokens.get(token);
      if (!resetData) {
        throw new Error('Invalid or expired reset token');
      }
      
      // Check expiration
      if (new Date() > resetData.expiresAt) {
        this.resetTokens.delete(token);
        throw new Error('Reset token has expired');
      }
      
      // Check if token has been used
      if (resetData.used) {
        throw new Error('Reset token has already been used');
      }
      
      // Update last accessed
      resetData.lastAccessed = new Date();
      
      return {
        valid: true,
        userId: resetData.userId,
        username: resetData.username,
        email: resetData.email,
        expiresAt: resetData.expiresAt
      };
      
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Reset password using token
  async resetPassword(token, newPassword, options = {}) {
    try {
      // Verify token first
      const tokenData = await this.verifyResetToken(token);
      
      // Validate new password
      this.validateNewPassword(newPassword);
      
      // Get reset data
      const resetData = this.resetTokens.get(token);
      if (!resetData) {
        throw new Error('Invalid reset token');
      }
      
      // Mark token as used
      resetData.used = true;
      resetData.usedAt = new Date();
      resetData.usedFrom = {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      };
      
      // Hash the new password
      const hashedPassword = await this.hashPassword(newPassword);
      
      // Update user password in storage
      await this.updateUserPassword(tokenData.userId, hashedPassword);
      
      // Invalidate all user sessions (force re-login)
      await this.invalidateAllUserSessions(tokenData.userId);
      
      // Clean up user's reset tokens
      this.invalidateUserTokens(tokenData.userId);
      
      // Clear rate limiting for successful reset
      this.clearUserRateLimit(tokenData.userId);
      
      // Send confirmation email
      await this.sendResetConfirmationEmail(tokenData);
      
      // Log successful reset
      this.logSuccessfulReset(tokenData.userId, options.ipAddress);
      
      // Emit event
      this.emit('passwordReset', {
        userId: tokenData.userId,
        username: tokenData.username,
        email: tokenData.email,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      return {
        success: true,
        message: 'Password has been reset successfully'
      };
      
    } catch (error) {
      // Log failed reset attempt
      this.logFailedReset(token, options.ipAddress, error.message);
      throw error;
    }
  }

  // Generate secure reset token
  async generateResetToken(user, options = {}) {
    const token = crypto.randomBytes(this.config.tokenLength).toString('hex');
    const now = new Date();
    
    const resetData = {
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      
      // Timestamps
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.tokenExpiry),
      lastAccessed: now,
      
      // Security data
      requestedFrom: {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      },
      
      // State
      used: false,
      usedAt: null,
      usedFrom: null,
      
      // Additional security
      securityFingerprint: this.createSecurityFingerprint(user, options)
    };
    
    // Store token
    this.resetTokens.set(token, resetData);
    
    // Track user tokens
    this.trackUserToken(user.id, token);
    
    return resetData;
  }

  // Security and validation methods
  validateNewPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      throw new Error('Password is too long');
    }
    
    // Check password strength
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasLowercase || !hasUppercase || !hasNumbers || !hasSpecialChars) {
      throw new Error('Password must contain lowercase, uppercase, numbers, and special characters');
    }
    
    // Check for common patterns
    if (this.isCommonPassword(password)) {
      throw new Error('Password is too common. Please choose a more secure password');
    }
  }

  isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  createSecurityFingerprint(user, options) {
    const data = JSON.stringify({
      userId: user.id,
      email: user.email,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      timestamp: Date.now()
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Rate limiting methods
  checkRateLimit(identifier, ipAddress) {
    const identifiers = [identifier];
    if (ipAddress) {
      identifiers.push(ipAddress);
    }
    
    for (const id of identifiers) {
      const limit = this.rateLimiter.get(id);
      if (!limit) {
        this.rateLimiter.set(id, {
          requests: 1,
          windowStart: Date.now(),
          dailyRequests: 1,
          dailyWindowStart: Date.now()
        });
        continue;
      }
      
      const now = Date.now();
      
      // Check hourly limit
      if (now - limit.windowStart < this.config.rateLimitWindow) {
        if (limit.requests >= this.config.maxRequestsPerHour) {
          throw new Error('Too many reset requests. Please try again later.');
        }
        limit.requests++;
      } else {
        // Reset hourly window
        limit.requests = 1;
        limit.windowStart = now;
      }
      
      // Check daily limit
      if (now - limit.dailyWindowStart < 24 * 60 * 60 * 1000) {
        if (limit.dailyRequests >= this.config.maxRequestsPerDay) {
          throw new Error('Daily reset limit exceeded. Please try again tomorrow.');
        }
        limit.dailyRequests++;
      } else {
        // Reset daily window
        limit.dailyRequests = 1;
        limit.dailyWindowStart = now;
      }
    }
  }

  checkUserRateLimit(userId) {
    const attempts = this.userResetAttempts.get(userId) || { count: 0, windowStart: Date.now() };
    const now = Date.now();
    
    // Reset window if expired
    if (now - attempts.windowStart > this.config.rateLimitWindow) {
      attempts.count = 0;
      attempts.windowStart = now;
    }
    
    if (attempts.count >= this.config.maxRequestsPerHour) {
      throw new Error('Too many reset requests for this account');
    }
    
    attempts.count++;
    this.userResetAttempts.set(userId, attempts);
  }

  clearUserRateLimit(userId) {
    this.userResetAttempts.delete(userId);
  }

  // Token management
  trackUserToken(userId, token) {
    // Enforce token limits per user
    const userTokens = Array.from(this.resetTokens.values())
      .filter(data => data.userId === userId && !data.used);
    
    if (userTokens.length > this.config.maxActiveTokensPerUser) {
      // Remove oldest tokens
      userTokens
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, userTokens.length - this.config.maxActiveTokensPerUser + 1)
        .forEach(tokenData => {
          this.resetTokens.delete(tokenData.token);
        });
    }
  }

  invalidateUserTokens(userId) {
    for (const [token, data] of this.resetTokens.entries()) {
      if (data.userId === userId && !data.used) {
        this.resetTokens.delete(token);
      }
    }
  }

  invalidateToken(token) {
    return this.resetTokens.delete(token);
  }

  // External integration methods (to be implemented with actual services)
  async findUserByIdentifier(identifier) {
    // This should integrate with your user storage system
    // For now, return null to simulate user lookup
    console.log(`[PasswordResetManager] Looking up user: ${identifier}`);
    
    // Mock implementation - integrate with actual user service
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const users = JSON.parse(localStorage.getItem('memex_racing_users') || '[]');
        return users.find(user => 
          user.username === identifier || user.email === identifier
        );
      } catch (error) {
        console.error('Error looking up user:', error);
        return null;
      }
    }
    
    return null;
  }

  async hashPassword(password) {
    // This should use the same password hashing service as registration
    // For now, return a simple hash (replace with actual bcrypt implementation)
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 12);
  }

  async updateUserPassword(userId, hashedPassword) {
    // This should integrate with your user storage system
    console.log(`[PasswordResetManager] Updating password for user: ${userId}`);
    
    // Mock implementation - integrate with actual storage service
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Update the password hash in storage
        const StorageManager = require('./StorageManager');
        const storageManager = new StorageManager();
        await storageManager.storePassword(userId, hashedPassword);
        console.log(`[PasswordResetManager] Password updated for user: ${userId}`);
      } catch (error) {
        console.error('Error updating password:', error);
        throw new Error('Failed to update password');
      }
    }
  }

  async invalidateAllUserSessions(userId) {
    // This should integrate with your session management system
    console.log(`[PasswordResetManager] Invalidating all sessions for user: ${userId}`);
    
    // Emit event for session manager to handle
    this.emit('invalidateUserSessions', { userId });
  }

  // Email service methods (mock implementation)
  async sendResetEmail(user, resetData) {
    if (!this.config.emailService.enabled) {
      console.log(`[PasswordResetManager] Mock email: Reset link sent to ${user.email}`);
      console.log(`[PasswordResetManager] Reset token: ${resetData.token}`);
      return true;
    }
    
    // Real email implementation would go here
    const resetLink = this.generateResetLink(resetData.token);
    
    console.log(`[PasswordResetManager] Sending reset email to: ${user.email}`);
    console.log(`[PasswordResetManager] Reset link: ${resetLink}`);
    
    return true;
  }

  async sendResetConfirmationEmail(tokenData) {
    if (!this.config.emailService.enabled) {
      console.log(`[PasswordResetManager] Mock email: Password reset confirmation sent to ${tokenData.email}`);
      return true;
    }
    
    // Real email implementation would go here
    console.log(`[PasswordResetManager] Sending confirmation email to: ${tokenData.email}`);
    
    return true;
  }

  generateResetLink(token) {
    // Generate reset link based on your application URL
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/reset-password?token=${token}`;
  }

  // Logging methods
  logResetRequest(userId, identifier, ipAddress) {
    console.log(`[PasswordResetManager] Reset requested - User: ${userId}, Identifier: ${identifier}, IP: ${ipAddress}`);
  }

  logFailedAttempt(identifier, ipAddress, reason) {
    console.log(`[PasswordResetManager] Failed attempt - Identifier: ${identifier}, IP: ${ipAddress}, Reason: ${reason}`);
  }

  logSuccessfulReset(userId, ipAddress) {
    console.log(`[PasswordResetManager] Successful reset - User: ${userId}, IP: ${ipAddress}`);
  }

  logFailedReset(token, ipAddress, reason) {
    console.log(`[PasswordResetManager] Failed reset - Token: ${token?.substring(0, 8)}..., IP: ${ipAddress}, Reason: ${reason}`);
  }

  // Utility methods
  createSuccessResponse() {
    return {
      success: true,
      message: 'If the email exists in our system, a reset link will be sent'
    };
  }

  getResetStats() {
    const now = new Date();
    const activeTokens = Array.from(this.resetTokens.values())
      .filter(data => !data.used && now < data.expiresAt);
    
    return {
      totalTokens: this.resetTokens.size,
      activeTokens: activeTokens.length,
      usedTokens: Array.from(this.resetTokens.values()).filter(data => data.used).length,
      rateLimitedIdentifiers: this.rateLimiter.size
    };
  }

  // Cleanup process
  startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.config.cleanupInterval);
  }

  cleanupExpiredTokens() {
    const now = new Date();
    let cleanedCount = 0;
    
    // Clean up expired tokens
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expiresAt) {
        this.resetTokens.delete(token);
        cleanedCount++;
      }
    }
    
    // Clean up old rate limiting data
    for (const [identifier, limit] of this.rateLimiter.entries()) {
      if (now - limit.windowStart > 24 * 60 * 60 * 1000) { // 24 hours
        this.rateLimiter.delete(identifier);
      }
    }
    
    // Clean up old user attempts
    for (const [userId, attempts] of this.userResetAttempts.entries()) {
      if (now - attempts.windowStart > 24 * 60 * 60 * 1000) { // 24 hours
        this.userResetAttempts.delete(userId);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[PasswordResetManager] Cleaned up ${cleanedCount} expired tokens`);
    }
  }

  // Cleanup resources
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.resetTokens.clear();
    this.userResetAttempts.clear();
    this.emailResetAttempts.clear();
    this.rateLimiter.clear();
    
    this.removeAllListeners();
    
    console.log('[PasswordResetManager] Destroyed and cleaned up all resources');
  }
}

module.exports = PasswordResetManager;