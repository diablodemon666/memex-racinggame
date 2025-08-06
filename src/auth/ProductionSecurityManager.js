// Production Security Manager
// Enterprise-grade security hardening for Memex Racing game

const crypto = require('crypto');
const { EventEmitter } = require('events');

class ProductionSecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Security monitoring
    this.securityEvents = new Map(); // eventId -> event data
    this.threatDetection = new Map(); // identifier -> threat data
    this.auditLog = []; // Security audit trail
    
    // Rate limiting and blocking
    this.rateLimits = new Map(); // endpoint -> rate limit data
    this.blockedIPs = new Set();
    this.suspiciousPatterns = new Map();
    
    // CSRF protection
    this.csrfTokens = new Map(); // sessionId -> csrf token
    
    // Security headers and policies
    this.securityPolicies = this.initializeSecurityPolicies();
    
    // Monitoring intervals
    this.threatAnalysisInterval = null;
    this.auditCleanupInterval = null;
    
    this.startSecurityMonitoring();
    
    console.log('[ProductionSecurityManager] Initialized with enterprise security hardening');
  }

  validateConfig(config) {
    return {
      // Environment configuration
      environment: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production',
      
      // Rate limiting configuration
      globalRateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        skipSuccessfulRequests: false
      },
      
      authRateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,
        skipSuccessfulRequests: true
      },
      
      // CSRF protection
      csrf: {
        enabled: true,
        tokenLength: 32,
        cookieOptions: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        }
      },
      
      // Security headers
      securityHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': this.getDefaultCSP(),
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      },
      
      // Threat detection
      threatDetection: {
        enabled: true,
        suspiciousThreshold: 10,
        autoBlockThreshold: 50,
        monitoringWindow: 60 * 60 * 1000, // 1 hour
        analysisInterval: 5 * 60 * 1000 // 5 minutes
      },
      
      // Audit configuration
      audit: {
        enabled: true,
        maxLogSize: 10000,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        sensitiveEvents: [
          'login_attempt',
          'password_reset',
          'session_created', 
          'security_violation',
          'admin_action'
        ]
      },
      
      // Input validation
      inputValidation: {
        maxStringLength: 1000,
        maxArrayLength: 100,
        maxObjectDepth: 5,
        allowedFileTypes: ['png', 'jpg', 'jpeg', 'gif'],
        maxFileSize: 5 * 1024 * 1024 // 5MB
      },
      
      ...config
    };
  }

  getDefaultCSP() {
    const isProduction = this.config?.environment === 'production';
    
    if (isProduction) {
      return "default-src 'self'; " +
             "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Phaser needs unsafe-eval
             "style-src 'self' 'unsafe-inline'; " +
             "img-src 'self' data: blob:; " +
             "font-src 'self'; " +
             "connect-src 'self' ws: wss:; " + // WebSocket for multiplayer
             "media-src 'self'; " +
             "object-src 'none'; " +
             "base-uri 'self'; " +
             "form-action 'self'";
    } else {
      return "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
             "connect-src 'self' ws://localhost:* wss://localhost:*";
    }
  }

  initializeSecurityPolicies() {
    return {
      passwordPolicy: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventCommonPasswords: true,
        preventUserInfoInPassword: true
      },
      
      sessionPolicy: {
        maxConcurrentSessions: 5,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
        requireSecureCookies: this.config.isProduction
      },
      
      accessPolicy: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        requiredPermissions: new Map()
      }
    };
  }

  // CSRF Protection
  generateCSRFToken(sessionId) {
    if (!this.config.csrf.enabled) {
      return null;
    }
    
    const token = crypto.randomBytes(this.config.csrf.tokenLength).toString('hex');
    this.csrfTokens.set(sessionId, {
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });
    
    return token;
  }

  validateCSRFToken(sessionId, providedToken) {
    if (!this.config.csrf.enabled) {
      return true;
    }
    
    const tokenData = this.csrfTokens.get(sessionId);
    if (!tokenData) {
      throw new Error('CSRF token not found');
    }
    
    if (new Date() > tokenData.expiresAt) {
      this.csrfTokens.delete(sessionId);
      throw new Error('CSRF token expired');
    }
    
    if (tokenData.token !== providedToken) {
      this.logSecurityEvent('csrf_validation_failed', {
        sessionId,
        providedToken: providedToken?.substring(0, 8) + '...'
      });
      throw new Error('Invalid CSRF token');
    }
    
    return true;
  }

  // Rate Limiting
  checkRateLimit(identifier, endpoint = 'global') {
    const key = `${endpoint}:${identifier}`;
    const now = Date.now();
    
    let limitConfig = this.config.globalRateLimit;
    if (endpoint === 'auth') {
      limitConfig = this.config.authRateLimit;
    }
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, {
        requests: 1,
        windowStart: now,
        endpoint
      });
      return true;
    }
    
    const rateData = this.rateLimits.get(key);
    
    // Reset window if expired
    if (now - rateData.windowStart > limitConfig.windowMs) {
      rateData.requests = 1;
      rateData.windowStart = now;
      return true;
    }
    
    // Check if limit exceeded
    if (rateData.requests >= limitConfig.maxRequests) {
      this.logSecurityEvent('rate_limit_exceeded', {
        identifier,
        endpoint,
        requests: rateData.requests,
        limit: limitConfig.maxRequests
      });
      
      // Mark as suspicious activity
      this.recordSuspiciousActivity(identifier, 'rate_limit_violation');
      
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    rateData.requests++;
    return true;
  }

  // Input Validation and Sanitization
  validateInput(input, type = 'string', options = {}) {
    if (input === null || input === undefined) {
      if (options.required) {
        throw new Error(`${type} input is required`);
      }
      return input;
    }
    
    switch (type) {
      case 'string':
        return this.validateString(input, options);
      case 'email':
        return this.validateEmail(input, options);
      case 'username':
        return this.validateUsername(input, options);
      case 'password':
        return this.validatePassword(input, options);
      case 'array':
        return this.validateArray(input, options);
      case 'object':
        return this.validateObject(input, options);
      case 'file':
        return this.validateFile(input, options);
      default:
        throw new Error(`Unknown validation type: ${type}`);
    }
  }

  validateString(input, options = {}) {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    const maxLength = options.maxLength || this.config.inputValidation.maxStringLength;
    if (input.length > maxLength) {
      throw new Error(`String too long. Maximum length: ${maxLength}`);
    }
    
    // Check for potential XSS
    if (this.containsSuspiciousContent(input)) {
      this.logSecurityEvent('suspicious_input_detected', { input: input.substring(0, 100) });
      throw new Error('Input contains potentially malicious content');
    }
    
    // Sanitize HTML if requested
    if (options.sanitizeHtml) {
      return this.sanitizeHtml(input);
    }
    
    return input.trim();
  }

  validateEmail(input, options = {}) {
    const email = this.validateString(input, options);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    return email.toLowerCase();
  }

  validateUsername(input, options = {}) {
    const username = this.validateString(input, { ...options, maxLength: 20 });
    
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }
    
    // Check for reserved usernames
    const reservedUsernames = ['admin', 'root', 'system', 'api', 'www', 'mail'];
    if (reservedUsernames.includes(username.toLowerCase())) {
      throw new Error('Username is reserved');
    }
    
    return username;
  }

  validatePassword(input, options = {}) {
    const password = this.validateString(input, { ...options, maxLength: 128 });
    const policy = this.securityPolicies.passwordPolicy;
    
    if (password.length < policy.minLength) {
      throw new Error(`Password must be at least ${policy.minLength} characters`);
    }
    
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    if (policy.requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
    
    if (policy.preventCommonPasswords && this.isCommonPassword(password)) {
      throw new Error('Password is too common. Please choose a more secure password');
    }
    
    return password;
  }

  validateArray(input, options = {}) {
    if (!Array.isArray(input)) {
      throw new Error('Input must be an array');
    }
    
    const maxLength = options.maxLength || this.config.inputValidation.maxArrayLength;
    if (input.length > maxLength) {
      throw new Error(`Array too long. Maximum length: ${maxLength}`);
    }
    
    return input;
  }

  validateObject(input, options = {}) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new Error('Input must be an object');
    }
    
    const maxDepth = options.maxDepth || this.config.inputValidation.maxObjectDepth;
    if (this.getObjectDepth(input) > maxDepth) {
      throw new Error(`Object too deeply nested. Maximum depth: ${maxDepth}`);
    }
    
    return input;
  }

  validateFile(file, options = {}) {
    if (!file || typeof file !== 'object') {
      throw new Error('Invalid file object');
    }
    
    // Check file size
    const maxSize = options.maxSize || this.config.inputValidation.maxFileSize;
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size: ${maxSize} bytes`);
    }
    
    // Check file type
    const allowedTypes = options.allowedTypes || this.config.inputValidation.allowedFileTypes;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return file;
  }

  // Security utility methods
  containsSuspiciousContent(input) {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  sanitizeHtml(input) {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'hello', 'login', 'access'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  getObjectDepth(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return 0;
    }
    
    let maxDepth = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.getObjectDepth(value));
      }
    }
    
    return maxDepth + 1;
  }

  // Threat Detection and Monitoring
  recordSuspiciousActivity(identifier, activityType, metadata = {}) {
    if (!this.config.threatDetection.enabled) {
      return;
    }
    
    if (!this.threatDetection.has(identifier)) {
      this.threatDetection.set(identifier, {
        identifier,
        activities: [],
        riskScore: 0,
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }
    
    const threatData = this.threatDetection.get(identifier);
    
    const activity = {
      type: activityType,
      timestamp: new Date(),
      metadata
    };
    
    threatData.activities.push(activity);
    threatData.lastSeen = new Date();
    threatData.riskScore += this.calculateActivityRisk(activityType);
    
    // Auto-block if risk score is too high
    if (threatData.riskScore >= this.config.threatDetection.autoBlockThreshold) {
      this.blockIdentifier(identifier, 'automated_threat_detection');
    }
    
    this.logSecurityEvent('suspicious_activity_recorded', {
      identifier,
      activityType,
      riskScore: threatData.riskScore,
      metadata
    });
  }

  calculateActivityRisk(activityType) {
    const riskScores = {
      'failed_login': 5,
      'rate_limit_violation': 10,
      'suspicious_input': 15,
      'csrf_violation': 20,
      'session_hijack_attempt': 25,
      'privilege_escalation': 50
    };
    
    return riskScores[activityType] || 1;
  }

  blockIdentifier(identifier, reason) {
    this.blockedIPs.add(identifier);
    
    this.logSecurityEvent('identifier_blocked', {
      identifier,
      reason,
      timestamp: new Date()
    });
    
    this.emit('identifierBlocked', { identifier, reason });
  }

  isBlocked(identifier) {
    return this.blockedIPs.has(identifier);
  }

  unblockIdentifier(identifier) {
    const wasBlocked = this.blockedIPs.delete(identifier);
    
    if (wasBlocked) {
      this.logSecurityEvent('identifier_unblocked', {
        identifier,
        timestamp: new Date()
      });
    }
    
    return wasBlocked;
  }

  // Security Event Logging
  logSecurityEvent(eventType, data = {}) {
    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: new Date(),
      data: {
        ...data,
        environment: this.config.environment
      }
    };
    
    this.securityEvents.set(event.id, event);
    this.auditLog.push(event);
    
    // Trim audit log if too large
    if (this.auditLog.length > this.config.audit.maxLogSize) {
      this.auditLog = this.auditLog.slice(-this.config.audit.maxLogSize);
    }
    
    // Emit for external logging systems
    this.emit('securityEvent', event);
    
    // Log to console in development
    if (!this.config.isProduction) {
      console.log(`[SECURITY] ${eventType}:`, data);
    }
  }

  // Security Headers Middleware
  getSecurityHeaders() {
    return { ...this.config.securityHeaders };
  }

  // Security Monitoring
  startSecurityMonitoring() {
    // Threat analysis
    this.threatAnalysisInterval = setInterval(() => {
      this.analyzeThreatPatterns();
    }, this.config.threatDetection.analysisInterval);
    
    // Audit cleanup
    this.auditCleanupInterval = setInterval(() => {
      this.cleanupAuditLog();
    }, 60 * 60 * 1000); // Every hour
  }

  analyzeThreatPatterns() {
    if (!this.config.threatDetection.enabled) {
      return;
    }
    
    const now = new Date();
    const windowStart = new Date(now - this.config.threatDetection.monitoringWindow);
    
    // Analyze recent activities for patterns
    for (const [identifier, threatData] of this.threatDetection.entries()) {
      const recentActivities = threatData.activities.filter(
        activity => activity.timestamp >= windowStart
      );
      
      // Check for suspicious patterns
      if (recentActivities.length >= this.config.threatDetection.suspiciousThreshold) {
        this.logSecurityEvent('suspicious_pattern_detected', {
          identifier,
          activityCount: recentActivities.length,
          riskScore: threatData.riskScore
        });
      }
      
      // Clean up old activities
      threatData.activities = recentActivities;
      
      // Remove if no recent activity
      if (recentActivities.length === 0) {
        this.threatDetection.delete(identifier);
      }
    }
  }

  cleanupAuditLog() {
    const cutoffDate = new Date(Date.now() - this.config.audit.retentionPeriod);
    
    // Remove old events from memory
    for (const [id, event] of this.securityEvents.entries()) {
      if (event.timestamp < cutoffDate) {
        this.securityEvents.delete(id);
      }
    }
    
    // Filter audit log
    this.auditLog = this.auditLog.filter(event => event.timestamp >= cutoffDate);
  }

  // Statistics and Reporting
  getSecurityStats() {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    
    const recentEvents = this.auditLog.filter(event => event.timestamp >= last24Hours);
    
    const eventCounts = recentEvents.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {});
    
    return {
      totalSecurityEvents: this.securityEvents.size,
      recentEvents: recentEvents.length,
      eventBreakdown: eventCounts,
      blockedIdentifiers: this.blockedIPs.size,
      activeThreatMonitoring: this.threatDetection.size,
      csrfTokensActive: this.csrfTokens.size
    };
  }

  // Cleanup resources
  destroy() {
    if (this.threatAnalysisInterval) {
      clearInterval(this.threatAnalysisInterval);
      this.threatAnalysisInterval = null;
    }
    
    if (this.auditCleanupInterval) {
      clearInterval(this.auditCleanupInterval);
      this.auditCleanupInterval = null;
    }
    
    this.securityEvents.clear();
    this.threatDetection.clear();
    this.rateLimits.clear();
    this.blockedIPs.clear();
    this.csrfTokens.clear();
    this.auditLog.length = 0;
    
    this.removeAllListeners();
    
    console.log('[ProductionSecurityManager] Destroyed and cleaned up all resources');
  }
}

module.exports = ProductionSecurityManager;