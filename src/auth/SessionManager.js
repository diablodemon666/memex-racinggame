// Server-Side Session Management System
// Enterprise-grade session handling for Memex Racing game

const crypto = require('crypto');
const { EventEmitter } = require('events');

class SessionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Session storage
    this.sessions = new Map(); // sessionId -> session data
    this.userSessions = new Map(); // userId -> Set of sessionIds
    this.tokenSessions = new Map(); // token -> sessionId
    
    // Security tracking
    this.loginAttempts = new Map(); // identifier -> { count, lockUntil }
    this.suspiciousActivity = new Map(); // sessionId -> activity log
    
    // Cleanup timers
    this.cleanupInterval = null;
    this.securityAuditInterval = null;
    
    this.startCleanupProcess();
    this.startSecurityAudit();
    
    console.log('[SessionManager] Initialized with enterprise session management');
  }

  validateConfig(config) {
    return {
      // Session configuration
      maxSessionsPerUser: 5,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
      rememberMeTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
      
      // Security configuration
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      suspiciousActivityThreshold: 10,
      ipChangeDetection: true,
      userAgentChangeDetection: true,
      
      // Cleanup configuration
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      securityAuditInterval: 1 * 60 * 1000, // 1 minute
      
      // Cookie configuration
      cookieName: 'memex_session',
      cookieSecure: true,
      cookieHttpOnly: true,
      cookieSameSite: 'strict',
      
      ...config
    };
  }

  // Create new session
  async createSession(userData, options = {}) {
    try {
      // Security checks
      await this.performSecurityChecks(userData, options);
      
      // Generate secure session ID
      const sessionId = this.generateSecureSessionId();
      
      // Create session data
      const session = {
        id: sessionId,
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        roles: userData.roles || ['user'],
        permissions: userData.permissions || [],
        
        // Timestamps
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeout),
        
        // Security information
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        loginMethod: options.loginMethod || 'password',
        rememberMe: options.rememberMe || false,
        
        // Session state
        isActive: true,
        invalidationReason: null,
        
        // Security flags
        requiresReauth: false,
        suspiciousActivity: false,
        securityLevel: this.calculateSecurityLevel(options)
      };

      // Adjust expiry for remember me
      if (session.rememberMe) {
        session.expiresAt = new Date(Date.now() + this.config.rememberMeTimeout);
      }

      // Store session
      this.sessions.set(sessionId, session);
      
      // Track user sessions
      if (!this.userSessions.has(userData.id)) {
        this.userSessions.set(userData.id, new Set());
      }
      
      const userSessions = this.userSessions.get(userData.id);
      userSessions.add(sessionId);
      
      // Enforce session limits
      this.enforceSessionLimits(userData.id);
      
      // Clear login attempts on successful login
      this.clearLoginAttempts(userData.username);
      this.clearLoginAttempts(options.ipAddress);
      
      // Emit session created event
      this.emit('sessionCreated', {
        sessionId,
        userId: userData.id,
        username: userData.username,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      console.log(`[SessionManager] Created session ${sessionId} for user ${userData.username}`);
      
      return session;
    } catch (error) {
      // Record failed login attempt
      await this.recordLoginAttempt(userData.username, options.ipAddress, false);
      throw error;
    }
  }

  // Validate and refresh session
  async validateSession(sessionId, options = {}) {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (!session.isActive) {
        throw new Error(`Session inactive: ${session.invalidationReason}`);
      }
      
      // Check expiration
      if (new Date() > session.expiresAt) {
        this.invalidateSession(sessionId, 'expired');
        throw new Error('Session expired');
      }
      
      // Security validations
      await this.performSessionSecurityChecks(session, options);
      
      // Update last accessed time
      session.lastAccessedAt = new Date();
      
      // Extend session if within refresh window
      this.refreshSessionIfNeeded(session);
      
      // Emit session accessed event
      this.emit('sessionAccessed', {
        sessionId,
        userId: session.userId,
        ipAddress: options.ipAddress
      });
      
      return session;
    } catch (error) {
      // Log security violation
      if (sessionId && this.sessions.has(sessionId)) {
        this.logSecurityEvent(sessionId, 'validation_failure', error.message, options);
      }
      
      throw error;
    }
  }

  // Link token to session
  linkTokenToSession(token, sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found');
    }
    
    this.tokenSessions.set(token, sessionId);
  }

  // Get session by token
  getSessionByToken(token) {
    const sessionId = this.tokenSessions.get(token);
    if (!sessionId) {
      return null;
    }
    
    return this.sessions.get(sessionId);
  }

  // Invalidate session
  invalidateSession(sessionId, reason = 'manual') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Mark as inactive
    session.isActive = false;
    session.invalidationReason = reason;
    
    // Remove from user sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }
    
    // Remove token associations
    for (const [token, sid] of this.tokenSessions.entries()) {
      if (sid === sessionId) {
        this.tokenSessions.delete(token);
      }
    }
    
    // Emit session invalidated event
    this.emit('sessionInvalidated', {
      sessionId,
      userId: session.userId,
      reason
    });
    
    console.log(`[SessionManager] Invalidated session ${sessionId} (reason: ${reason})`);
    
    return true;
  }

  // Invalidate all user sessions
  invalidateAllUserSessions(userId, reason = 'security', excludeSessionId = null) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions) {
      return 0;
    }
    
    let invalidatedCount = 0;
    const sessionsToInvalidate = Array.from(userSessions);
    
    for (const sessionId of sessionsToInvalidate) {
      if (sessionId !== excludeSessionId) {
        if (this.invalidateSession(sessionId, reason)) {
          invalidatedCount++;
        }
      }
    }
    
    return invalidatedCount;
  }

  // Security methods
  async performSecurityChecks(userData, options) {
    // Check login attempts
    await this.checkLoginAttempts(userData.username);
    if (options.ipAddress) {
      await this.checkLoginAttempts(options.ipAddress);
    }
    
    // Additional security validations can be added here
    // - IP reputation checks
    // - Device fingerprinting
    // - Geolocation validation
  }

  async performSessionSecurityChecks(session, options) {
    let securityViolations = [];
    
    // IP address change detection
    if (this.config.ipChangeDetection && options.ipAddress && 
        session.ipAddress && session.ipAddress !== options.ipAddress) {
      securityViolations.push('ip_change');
      this.logSecurityEvent(session.id, 'ip_change', 
        `IP changed from ${session.ipAddress} to ${options.ipAddress}`, options);
    }
    
    // User agent change detection
    if (this.config.userAgentChangeDetection && options.userAgent &&
        session.userAgent && session.userAgent !== options.userAgent) {
      securityViolations.push('user_agent_change');
      this.logSecurityEvent(session.id, 'user_agent_change',
        'User agent changed during session', options);
    }
    
    // Check for suspicious activity
    if (this.isSuspiciousSession(session.id)) {
      securityViolations.push('suspicious_activity');
    }
    
    // Handle security violations
    if (securityViolations.length > 0) {
      session.suspiciousActivity = true;
      
      // For high-risk violations, require re-authentication
      const highRiskViolations = ['ip_change', 'suspicious_activity'];
      if (securityViolations.some(v => highRiskViolations.includes(v))) {
        session.requiresReauth = true;
      }
      
      // Emit security event
      this.emit('securityViolation', {
        sessionId: session.id,
        userId: session.userId,
        violations: securityViolations,
        requiresReauth: session.requiresReauth
      });
    }
  }

  async checkLoginAttempts(identifier) {
    const attempts = this.loginAttempts.get(identifier);
    
    if (!attempts) {
      return; // No previous attempts
    }
    
    // Check if still locked
    if (attempts.lockUntil && new Date() < attempts.lockUntil) {
      const remainingTime = Math.ceil((attempts.lockUntil - new Date()) / 1000 / 60);
      throw new Error(`Account locked. Try again in ${remainingTime} minutes.`);
    }
    
    // Reset if lock period has passed
    if (attempts.lockUntil && new Date() >= attempts.lockUntil) {
      this.loginAttempts.delete(identifier);
    }
  }

  async recordLoginAttempt(username, ipAddress, success) {
    const identifiers = [username];
    if (ipAddress) {
      identifiers.push(ipAddress);
    }
    
    for (const identifier of identifiers) {
      if (success) {
        // Clear attempts on successful login
        this.loginAttempts.delete(identifier);
      } else {
        // Increment failed attempts
        const attempts = this.loginAttempts.get(identifier) || { count: 0 };
        attempts.count++;
        attempts.lastAttempt = new Date();
        
        // Lock account if too many attempts
        if (attempts.count >= this.config.maxLoginAttempts) {
          attempts.lockUntil = new Date(Date.now() + this.config.lockoutDuration);
          
          this.emit('accountLocked', {
            identifier,
            attempts: attempts.count,
            lockUntil: attempts.lockUntil
          });
        }
        
        this.loginAttempts.set(identifier, attempts);
      }
    }
  }

  clearLoginAttempts(identifier) {
    if (identifier) {
      this.loginAttempts.delete(identifier);
    }
  }

  // Session management utilities
  enforceSessionLimits(userId) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions || userSessions.size <= this.config.maxSessionsPerUser) {
      return;
    }
    
    // Find oldest sessions to remove
    const sessionData = Array.from(userSessions)
      .map(id => ({ id, session: this.sessions.get(id) }))
      .filter(item => item.session)
      .sort((a, b) => a.session.lastAccessedAt - b.session.lastAccessedAt);
    
    const sessionsToRemove = sessionData.slice(0, userSessions.size - this.config.maxSessionsPerUser);
    
    for (const { id } of sessionsToRemove) {
      this.invalidateSession(id, 'session_limit_exceeded');
    }
  }

  refreshSessionIfNeeded(session) {
    const now = new Date();
    const timeUntilExpiry = session.expiresAt - now;
    const refreshThreshold = this.config.sessionTimeout * 0.1; // Refresh when 10% time left
    
    if (timeUntilExpiry < refreshThreshold) {
      if (session.rememberMe) {
        session.expiresAt = new Date(Date.now() + this.config.rememberMeTimeout);
      } else {
        session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
      }
      
      console.log(`[SessionManager] Refreshed session ${session.id}`);
    }
  }

  calculateSecurityLevel(options) {
    let level = 'standard';
    
    if (options.rememberMe) {
      level = 'low'; // Remember me sessions are less secure
    }
    
    if (options.requireMFA || options.loginMethod === 'sso') {
      level = 'high';
    }
    
    return level;
  }

  // Security monitoring
  logSecurityEvent(sessionId, eventType, description, context = {}) {
    if (!this.suspiciousActivity.has(sessionId)) {
      this.suspiciousActivity.set(sessionId, []);
    }
    
    const event = {
      type: eventType,
      description,
      timestamp: new Date(),
      context: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }
    };
    
    this.suspiciousActivity.get(sessionId).push(event);
    
    // Emit security event
    this.emit('securityEvent', {
      sessionId,
      event
    });
  }

  isSuspiciousSession(sessionId) {
    const activities = this.suspiciousActivity.get(sessionId);
    if (!activities) {
      return false;
    }
    
    // Check for too many security events in a short time
    const recentActivities = activities.filter(
      activity => new Date() - activity.timestamp < 10 * 60 * 1000 // Last 10 minutes
    );
    
    return recentActivities.length >= this.config.suspiciousActivityThreshold;
  }

  // Utility methods
  generateSecureSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  getAllActiveSessions() {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  getUserSessions(userId) {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return [];
    }
    
    return Array.from(userSessionIds)
      .map(id => this.sessions.get(id))
      .filter(session => session && session.isActive);
  }

  getSessionStats() {
    const activeSessions = this.getAllActiveSessions();
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      totalUsers: this.userSessions.size,
      lockedAccounts: Array.from(this.loginAttempts.values())
        .filter(attempt => attempt.lockUntil && new Date() < attempt.lockUntil).length,
      suspiciousSessions: Array.from(this.suspiciousActivity.keys()).length,
      averageSessionDuration: this.calculateAverageSessionDuration(activeSessions)
    };
  }

  calculateAverageSessionDuration(sessions) {
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (session.lastAccessedAt - session.createdAt);
    }, 0);
    
    return Math.round(totalDuration / sessions.length / 1000 / 60); // Minutes
  }

  // Cleanup processes
  startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);
  }

  startSecurityAudit() {
    this.securityAuditInterval = setInterval(() => {
      this.performSecurityAudit();
    }, this.config.securityAuditInterval);
  }

  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      // Remove expired sessions
      if (now > session.expiresAt) {
        this.invalidateSession(sessionId, 'expired');
        this.sessions.delete(sessionId);
        cleanedCount++;
        continue;
      }
      
      // Remove inactive sessions
      const inactiveTime = now - session.lastAccessedAt;
      if (inactiveTime > this.config.inactivityTimeout) {
        this.invalidateSession(sessionId, 'inactive');
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    // Clean up old login attempts
    for (const [identifier, attempts] of this.loginAttempts.entries()) {
      if (attempts.lockUntil && now >= attempts.lockUntil) {
        this.loginAttempts.delete(identifier);
      }
    }
    
    // Clean up old suspicious activity logs
    for (const [sessionId, activities] of this.suspiciousActivity.entries()) {
      if (!this.sessions.has(sessionId)) {
        this.suspiciousActivity.delete(sessionId);
      } else {
        // Keep only recent activities
        const recentActivities = activities.filter(
          activity => now - activity.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
        );
        
        if (recentActivities.length === 0) {
          this.suspiciousActivity.delete(sessionId);
        } else {
          this.suspiciousActivity.set(sessionId, recentActivities);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[SessionManager] Cleaned up ${cleanedCount} expired/inactive sessions`);
    }
  }

  performSecurityAudit() {
    // Audit suspicious sessions
    for (const sessionId of this.suspiciousActivity.keys()) {
      const session = this.sessions.get(sessionId);
      if (session && this.isSuspiciousSession(sessionId)) {
        this.emit('suspiciousSessionDetected', {
          sessionId,
          userId: session.userId,
          activities: this.suspiciousActivity.get(sessionId)
        });
      }
    }
    
    // Audit long-running sessions
    const now = new Date();
    const longRunningThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const session of this.sessions.values()) {
      if (session.isActive && (now - session.createdAt) > longRunningThreshold) {
        this.emit('longRunningSession', {
          sessionId: session.id,
          userId: session.userId,
          duration: now - session.createdAt
        });
      }
    }
  }

  // Cleanup resources
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.securityAuditInterval) {
      clearInterval(this.securityAuditInterval);
      this.securityAuditInterval = null;
    }
    
    this.sessions.clear();
    this.userSessions.clear();
    this.tokenSessions.clear();
    this.loginAttempts.clear();
    this.suspiciousActivity.clear();
    
    this.removeAllListeners();
    
    console.log('[SessionManager] Destroyed and cleaned up all resources');
  }
}

module.exports = SessionManager;