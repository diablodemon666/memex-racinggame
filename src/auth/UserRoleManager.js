// User Role and Permission Management System
// Enterprise-grade user management for Memex Racing game

const { EventEmitter } = require('events');
const crypto = require('crypto');

class UserRoleManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Role and permission storage
    this.roles = new Map(); // roleName -> role definition
    this.userRoles = new Map(); // userId -> Set of roles
    this.permissions = new Map(); // permissionName -> permission definition
    this.rolePermissions = new Map(); // roleName -> Set of permissions
    this.userPermissions = new Map(); // userId -> Set of direct permissions
    
    // Role hierarchy and inheritance
    this.roleHierarchy = new Map(); // childRole -> Set of parent roles
    
    // Temporary permissions and role assignments
    this.temporaryAssignments = new Map(); // userId -> temporary assignments
    
    // Audit and change tracking
    this.changeHistory = [];
    
    this.initializeDefaultRoles();
    this.startCleanupProcess();
    
    console.log('[UserRoleManager] Initialized with enterprise role management');
  }

  validateConfig(config) {
    return {
      // Default role configuration
      defaultRole: 'user',
      adminRole: 'admin',
      
      // Permission inheritance
      enableRoleInheritance: true,
      maxRoleDepth: 5,
      
      // Temporary assignments
      defaultTempDuration: 24 * 60 * 60 * 1000, // 24 hours
      maxTempDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
      
      // Audit configuration
      auditEnabled: true,
      auditRetentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
      maxAuditLogSize: 10000,
      
      // Security settings
      requirePermissionForRoleManagement: true,
      allowSelfRoleModification: false,
      
      // Cleanup configuration
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      
      ...config
    };
  }

  // Initialize default roles and permissions
  initializeDefaultRoles() {
    // Define core permissions
    this.definePermission('game.play', {
      name: 'Play Game',
      description: 'Allow user to participate in races',
      category: 'game'
    });
    
    this.definePermission('game.spectate', {
      name: 'Spectate Games',
      description: 'Allow user to watch races and place bets',
      category: 'game'
    });
    
    this.definePermission('user.profile.read', {
      name: 'Read Own Profile',
      description: 'View own user profile and statistics',
      category: 'user'
    });
    
    this.definePermission('user.profile.write', {
      name: 'Edit Own Profile',
      description: 'Modify own user profile and preferences',
      category: 'user'
    });
    
    this.definePermission('leaderboard.view', {
      name: 'View Leaderboards',
      description: 'Access game leaderboards and statistics',
      category: 'game'
    });
    
    this.definePermission('betting.place', {
      name: 'Place Bets',
      description: 'Place bets on race outcomes',
      category: 'betting'
    });
    
    this.definePermission('betting.view_history', {
      name: 'View Betting History',
      description: 'Access personal betting history',
      category: 'betting'
    });
    
    // Admin permissions
    this.definePermission('admin.users.read', {
      name: 'View All Users',
      description: 'Access all user profiles and data',
      category: 'admin'
    });
    
    this.definePermission('admin.users.write', {
      name: 'Manage Users',
      description: 'Create, modify, and delete user accounts',
      category: 'admin'
    });
    
    this.definePermission('admin.roles.manage', {
      name: 'Manage Roles',
      description: 'Create, modify, and assign user roles',
      category: 'admin'
    });
    
    this.definePermission('admin.game.manage', {
      name: 'Manage Game',
      description: 'Control game settings and configurations',
      category: 'admin'
    });
    
    this.definePermission('admin.security.audit', {
      name: 'Security Audit',
      description: 'Access security logs and audit trails',
      category: 'admin'
    });
    
    // Moderator permissions
    this.definePermission('mod.chat.moderate', {
      name: 'Moderate Chat',
      description: 'Moderate chat messages and user behavior',
      category: 'moderation'
    });
    
    this.definePermission('mod.users.timeout', {
      name: 'Timeout Users',
      description: 'Temporarily restrict user access',
      category: 'moderation'
    });
    
    this.definePermission('mod.reports.handle', {
      name: 'Handle Reports',
      description: 'Review and act on user reports',
      category: 'moderation'
    });
    
    // Define core roles
    this.defineRole('guest', {
      name: 'Guest',
      description: 'Limited access for unregistered users',
      permissions: ['game.spectate', 'leaderboard.view'],
      inheritable: false
    });
    
    this.defineRole('user', {
      name: 'User',
      description: 'Standard registered user',
      permissions: [
        'game.play',
        'game.spectate',
        'user.profile.read',
        'user.profile.write',
        'leaderboard.view',
        'betting.place',
        'betting.view_history'
      ],
      inheritable: true
    });
    
    this.defineRole('vip', {
      name: 'VIP User',
      description: 'Premium user with additional privileges',
      permissions: ['betting.higher_limits'],
      inheritable: true,
      parentRoles: ['user']
    });
    
    this.defineRole('moderator', {
      name: 'Moderator',
      description: 'Community moderator with limited admin rights',
      permissions: [
        'mod.chat.moderate',
        'mod.users.timeout',
        'mod.reports.handle'
      ],
      inheritable: true,
      parentRoles: ['user']
    });
    
    this.defineRole('admin', {
      name: 'Administrator',
      description: 'Full system administrator',
      permissions: [
        'admin.users.read',
        'admin.users.write',
        'admin.roles.manage',
        'admin.game.manage',
        'admin.security.audit'
      ],
      inheritable: false,
      parentRoles: ['moderator']
    });
    
    console.log('[UserRoleManager] Initialized default roles and permissions');
  }

  // Permission Management
  definePermission(name, definition) {
    if (!name || typeof name !== 'string') {
      throw new Error('Permission name must be a non-empty string');
    }
    
    const permission = {
      name: definition.name || name,
      description: definition.description || '',
      category: definition.category || 'general',
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...definition
    };
    
    this.permissions.set(name, permission);
    
    this.logChange('permission_defined', {
      permissionName: name,
      definition: permission
    });
    
    this.emit('permissionDefined', { name, permission });
    
    return permission;
  }

  getPermission(name) {
    return this.permissions.get(name);
  }

  getAllPermissions() {
    return Array.from(this.permissions.values());
  }

  getPermissionsByCategory(category) {
    return Array.from(this.permissions.values())
      .filter(permission => permission.category === category);
  }

  // Role Management
  defineRole(name, definition) {
    if (!name || typeof name !== 'string') {
      throw new Error('Role name must be a non-empty string');
    }
    
    const role = {
      name: definition.name || name,
      description: definition.description || '',
      permissions: new Set(definition.permissions || []),
      inheritable: definition.inheritable !== false,
      system: definition.system || false,
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...definition
    };
    
    // Validate permissions exist
    for (const permission of role.permissions) {
      if (!this.permissions.has(permission)) {
        throw new Error(`Unknown permission: ${permission}`);
      }
    }
    
    this.roles.set(name, role);
    this.rolePermissions.set(name, role.permissions);
    
    // Set up role hierarchy
    if (definition.parentRoles && Array.isArray(definition.parentRoles)) {
      for (const parentRole of definition.parentRoles) {
        if (!this.roles.has(parentRole)) {
          throw new Error(`Parent role does not exist: ${parentRole}`);
        }
        
        if (!this.roleHierarchy.has(name)) {
          this.roleHierarchy.set(name, new Set());
        }
        this.roleHierarchy.get(name).add(parentRole);
      }
    }
    
    this.logChange('role_defined', {
      roleName: name,
      definition: role
    });
    
    this.emit('roleDefined', { name, role });
    
    return role;
  }

  getRole(name) {
    return this.roles.get(name);
  }

  getAllRoles() {
    return Array.from(this.roles.values());
  }

  getRoleHierarchy(roleName) {
    const hierarchy = [];
    const visited = new Set();
    
    const traverse = (role) => {
      if (visited.has(role) || visited.size > this.config.maxRoleDepth) {
        return; // Prevent infinite loops
      }
      
      visited.add(role);
      hierarchy.push(role);
      
      const parents = this.roleHierarchy.get(role);
      if (parents) {
        for (const parent of parents) {
          traverse(parent);
        }
      }
    };
    
    traverse(roleName);
    return hierarchy;
  }

  // User Role Assignment
  assignRole(userId, roleName, options = {}) {
    if (!this.roles.has(roleName)) {
      throw new Error(`Role does not exist: ${roleName}`);
    }
    
    const role = this.roles.get(roleName);
    
    // Check if role is inheritable for non-admin assignments
    if (!role.inheritable && !options.isAdminAssignment) {
      throw new Error(`Role is not assignable: ${roleName}`);
    }
    
    // Initialize user roles if needed
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    
    const userRoleSet = this.userRoles.get(userId);
    
    // Check if already assigned
    if (userRoleSet.has(roleName)) {
      return false; // Already assigned
    }
    
    // Handle temporary assignment
    if (options.temporary && options.expiresAt) {
      this.assignTemporaryRole(userId, roleName, options.expiresAt, options);
      return true;
    }
    
    // Assign role
    userRoleSet.add(roleName);
    
    this.logChange('role_assigned', {
      userId,
      roleName,
      assignedBy: options.assignedBy || 'system',
      reason: options.reason || 'manual_assignment'
    });
    
    this.emit('roleAssigned', {
      userId,
      roleName,
      role,
      assignedBy: options.assignedBy
    });
    
    return true;
  }

  revokeRole(userId, roleName, options = {}) {
    const userRoleSet = this.userRoles.get(userId);
    if (!userRoleSet || !userRoleSet.has(roleName)) {
      return false; // Role not assigned
    }
    
    const role = this.roles.get(roleName);
    
    // Prevent removal of system roles without admin permission
    if (role?.system && !options.isAdminRevocation) {
      throw new Error(`Cannot revoke system role: ${roleName}`);
    }
    
    // Remove role
    userRoleSet.delete(roleName);
    
    // Clean up empty role sets
    if (userRoleSet.size === 0) {
      this.userRoles.delete(userId);
    }
    
    // Remove any temporary assignments
    this.removeTemporaryAssignment(userId, 'role', roleName);
    
    this.logChange('role_revoked', {
      userId,
      roleName,
      revokedBy: options.revokedBy || 'system',
      reason: options.reason || 'manual_revocation'
    });
    
    this.emit('roleRevoked', {
      userId,
      roleName,
      role,
      revokedBy: options.revokedBy
    });
    
    return true;
  }

  // Temporary Role/Permission Assignment
  assignTemporaryRole(userId, roleName, expiresAt, options = {}) {
    if (!expiresAt || !(expiresAt instanceof Date)) {
      throw new Error('Expiration date is required for temporary assignments');
    }
    
    if (expiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }
    
    const maxExpiry = new Date(Date.now() + this.config.maxTempDuration);
    if (expiresAt > maxExpiry) {
      throw new Error(`Temporary assignment duration exceeds maximum allowed`);
    }
    
    if (!this.temporaryAssignments.has(userId)) {
      this.temporaryAssignments.set(userId, []);
    }
    
    const assignment = {
      id: crypto.randomUUID(),
      type: 'role',
      target: roleName,
      userId,
      assignedAt: new Date(),
      expiresAt,
      assignedBy: options.assignedBy || 'system',
      reason: options.reason || 'temporary_assignment',
      metadata: options.metadata || {}
    };
    
    this.temporaryAssignments.get(userId).push(assignment);
    
    // Also assign the role normally (will be cleaned up on expiry)
    this.assignRole(userId, roleName, { ...options, temporary: false });
    
    this.logChange('temporary_role_assigned', assignment);
    
    this.emit('temporaryRoleAssigned', assignment);
    
    return assignment;
  }

  assignTemporaryPermission(userId, permissionName, expiresAt, options = {}) {
    if (!this.permissions.has(permissionName)) {
      throw new Error(`Permission does not exist: ${permissionName}`);
    }
    
    if (!expiresAt || !(expiresAt instanceof Date)) {
      throw new Error('Expiration date is required for temporary assignments');
    }
    
    if (!this.temporaryAssignments.has(userId)) {
      this.temporaryAssignments.set(userId, []);
    }
    
    const assignment = {
      id: crypto.randomUUID(),
      type: 'permission',
      target: permissionName,
      userId,
      assignedAt: new Date(),
      expiresAt,
      assignedBy: options.assignedBy || 'system',
      reason: options.reason || 'temporary_assignment',
      metadata: options.metadata || {}
    };
    
    this.temporaryAssignments.get(userId).push(assignment);
    
    // Add to direct user permissions
    if (!this.userPermissions.has(userId)) {
      this.userPermissions.set(userId, new Set());
    }
    this.userPermissions.get(userId).add(permissionName);
    
    this.logChange('temporary_permission_assigned', assignment);
    
    this.emit('temporaryPermissionAssigned', assignment);
    
    return assignment;
  }

  removeTemporaryAssignment(userId, type, target) {
    const assignments = this.temporaryAssignments.get(userId);
    if (!assignments) return false;
    
    const index = assignments.findIndex(a => 
      a.type === type && a.target === target
    );
    
    if (index === -1) return false;
    
    const removed = assignments.splice(index, 1)[0];
    
    // Clean up the actual assignment
    if (type === 'role') {
      this.revokeRole(userId, target, { reason: 'temporary_expired' });
    } else if (type === 'permission') {
      const userPerms = this.userPermissions.get(userId);
      if (userPerms) {
        userPerms.delete(target);
        if (userPerms.size === 0) {
          this.userPermissions.delete(userId);
        }
      }
    }
    
    this.logChange('temporary_assignment_removed', removed);
    
    return true;
  }

  // Permission Checking
  hasPermission(userId, permissionName) {
    // Check direct user permissions
    const userPerms = this.userPermissions.get(userId);
    if (userPerms && userPerms.has(permissionName)) {
      return true;
    }
    
    // Check role-based permissions
    const userRoleSet = this.userRoles.get(userId);
    if (!userRoleSet) {
      return false;
    }
    
    // Check each role and its hierarchy
    for (const roleName of userRoleSet) {
      if (this.roleHasPermission(roleName, permissionName)) {
        return true;
      }
    }
    
    return false;
  }

  roleHasPermission(roleName, permissionName) {
    // Check direct role permissions
    const rolePerms = this.rolePermissions.get(roleName);
    if (rolePerms && rolePerms.has(permissionName)) {
      return true;
    }
    
    // Check inherited permissions if inheritance is enabled
    if (this.config.enableRoleInheritance) {
      const hierarchy = this.getRoleHierarchy(roleName);
      for (const ancestorRole of hierarchy.slice(1)) { // Skip self
        const ancestorPerms = this.rolePermissions.get(ancestorRole);
        if (ancestorPerms && ancestorPerms.has(permissionName)) {
          return true;
        }
      }
    }
    
    return false;
  }

  hasRole(userId, roleName) {
    const userRoleSet = this.userRoles.get(userId);
    return userRoleSet ? userRoleSet.has(roleName) : false;
  }

  hasAnyRole(userId, roleNames) {
    if (!Array.isArray(roleNames)) {
      roleNames = [roleNames];
    }
    
    const userRoleSet = this.userRoles.get(userId);
    if (!userRoleSet) return false;
    
    return roleNames.some(roleName => userRoleSet.has(roleName));
  }

  hasAllRoles(userId, roleNames) {
    if (!Array.isArray(roleNames)) {
      roleNames = [roleNames];
    }
    
    const userRoleSet = this.userRoles.get(userId);
    if (!userRoleSet) return false;
    
    return roleNames.every(roleName => userRoleSet.has(roleName));
  }

  // User Query Methods
  getUserRoles(userId) {
    const userRoleSet = this.userRoles.get(userId);
    return userRoleSet ? Array.from(userRoleSet) : [];
  }

  getUserPermissions(userId) {
    const permissions = new Set();
    
    // Add direct permissions
    const userPerms = this.userPermissions.get(userId);
    if (userPerms) {
      for (const perm of userPerms) {
        permissions.add(perm);
      }
    }
    
    // Add role-based permissions
    const userRoleSet = this.userRoles.get(userId);
    if (userRoleSet) {
      for (const roleName of userRoleSet) {
        const hierarchy = this.getRoleHierarchy(roleName);
        for (const role of hierarchy) {
          const rolePerms = this.rolePermissions.get(role);
          if (rolePerms) {
            for (const perm of rolePerms) {
              permissions.add(perm);
            }
          }
        }
      }
    }
    
    return Array.from(permissions);
  }

  getUserTemporaryAssignments(userId) {
    return this.temporaryAssignments.get(userId) || [];
  }

  // Administrative Methods
  getUsersByRole(roleName) {
    const users = [];
    for (const [userId, userRoleSet] of this.userRoles.entries()) {
      if (userRoleSet.has(roleName)) {
        users.push(userId);
      }
    }
    return users;
  }

  getUsersByPermission(permissionName) {
    const users = new Set();
    
    // Check direct permissions
    for (const [userId, userPerms] of this.userPermissions.entries()) {
      if (userPerms.has(permissionName)) {
        users.add(userId);
      }
    }
    
    // Check role-based permissions
    for (const [userId, userRoleSet] of this.userRoles.entries()) {
      for (const roleName of userRoleSet) {
        if (this.roleHasPermission(roleName, permissionName)) {
          users.add(userId);
          break;
        }
      }
    }
    
    return Array.from(users);
  }

  // Audit and Change Tracking
  logChange(action, data) {
    if (!this.config.auditEnabled) return;
    
    const change = {
      id: crypto.randomUUID(),
      action,
      timestamp: new Date(),
      data
    };
    
    this.changeHistory.push(change);
    
    // Trim history if too large
    if (this.changeHistory.length > this.config.maxAuditLogSize) {
      this.changeHistory = this.changeHistory.slice(-this.config.maxAuditLogSize);
    }
    
    this.emit('changeLogged', change);
  }

  getChangeHistory(filters = {}) {
    let history = [...this.changeHistory];
    
    if (filters.userId) {
      history = history.filter(change => 
        change.data.userId === filters.userId
      );
    }
    
    if (filters.action) {
      history = history.filter(change => change.action === filters.action);
    }
    
    if (filters.since) {
      history = history.filter(change => change.timestamp >= filters.since);
    }
    
    if (filters.limit) {
      history = history.slice(-filters.limit);
    }
    
    return history;
  }

  // Statistics
  getStats() {
    return {
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      usersWithRoles: this.userRoles.size,
      usersWithDirectPermissions: this.userPermissions.size,
      temporaryAssignments: Array.from(this.temporaryAssignments.values())
        .reduce((sum, assignments) => sum + assignments.length, 0),
      changeHistorySize: this.changeHistory.length
    };
  }

  // Cleanup Process
  startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredAssignments();
      this.cleanupAuditHistory();
    }, this.config.cleanupInterval);
  }

  cleanupExpiredAssignments() {
    const now = new Date();
    let cleanupCount = 0;
    
    for (const [userId, assignments] of this.temporaryAssignments.entries()) {
      const expired = assignments.filter(a => a.expiresAt <= now);
      
      for (const assignment of expired) {
        this.removeTemporaryAssignment(userId, assignment.type, assignment.target);
        cleanupCount++;
      }
    }
    
    if (cleanupCount > 0) {
      console.log(`[UserRoleManager] Cleaned up ${cleanupCount} expired temporary assignments`);
    }
  }

  cleanupAuditHistory() {
    if (!this.config.auditEnabled) return;
    
    const cutoffDate = new Date(Date.now() - this.config.auditRetentionPeriod);
    const originalSize = this.changeHistory.length;
    
    this.changeHistory = this.changeHistory.filter(
      change => change.timestamp >= cutoffDate
    );
    
    const removedCount = originalSize - this.changeHistory.length;
    if (removedCount > 0) {
      console.log(`[UserRoleManager] Cleaned up ${removedCount} old audit records`);
    }
  }

  // Cleanup resources
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.roles.clear();
    this.userRoles.clear();
    this.permissions.clear();
    this.rolePermissions.clear();
    this.userPermissions.clear();
    this.roleHierarchy.clear();
    this.temporaryAssignments.clear();
    this.changeHistory.length = 0;
    
    this.removeAllListeners();
    
    console.log('[UserRoleManager] Destroyed and cleaned up all resources');
  }
}

module.exports = UserRoleManager;