// Security Headers Configuration for Authentication Security
// TDD GREEN Phase - Minimal implementation to pass tests

class SecurityHeaders {
  constructor(config = {}) {
    this.config = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        },
        reportOnly: false
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      frameOptions: 'DENY',
      contentTypeOptions: 'nosniff',
      xssProtection: '1; mode=block',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        notifications: []
      },
      ...config
    };
  }

  // Express middleware for setting security headers
  expressMiddleware() {
    return (req, res, next) => {
      // Content Security Policy
      if (this.config.contentSecurityPolicy) {
        const csp = this.buildCSPHeader(this.config.contentSecurityPolicy);
        const headerName = this.config.contentSecurityPolicy.reportOnly 
          ? 'Content-Security-Policy-Report-Only' 
          : 'Content-Security-Policy';
        res.setHeader(headerName, csp);
      }

      // HTTP Strict Transport Security
      if (this.config.hsts && req.secure) {
        const hstsValue = `max-age=${this.config.hsts.maxAge}${
          this.config.hsts.includeSubDomains ? '; includeSubDomains' : ''
        }${
          this.config.hsts.preload ? '; preload' : ''
        }`;
        res.setHeader('Strict-Transport-Security', hstsValue);
      }

      // X-Frame-Options
      if (this.config.frameOptions) {
        res.setHeader('X-Frame-Options', this.config.frameOptions);
      }

      // X-Content-Type-Options
      if (this.config.contentTypeOptions) {
        res.setHeader('X-Content-Type-Options', this.config.contentTypeOptions);
      }

      // X-XSS-Protection
      if (this.config.xssProtection) {
        res.setHeader('X-XSS-Protection', this.config.xssProtection);
      }

      // Referrer-Policy
      if (this.config.referrerPolicy) {
        res.setHeader('Referrer-Policy', this.config.referrerPolicy);
      }

      // Permissions-Policy
      if (this.config.permissionsPolicy) {
        const permissionsPolicy = this.buildPermissionsPolicyHeader(this.config.permissionsPolicy);
        if (permissionsPolicy) {
          res.setHeader('Permissions-Policy', permissionsPolicy);
        }
      }

      // Remove server identification
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  buildCSPHeader(cspConfig) {
    const directives = [];
    
    for (const [directive, sources] of Object.entries(cspConfig.directives)) {
      if (Array.isArray(sources) && sources.length > 0) {
        const kebabDirective = this.camelToKebab(directive);
        directives.push(`${kebabDirective} ${sources.join(' ')}`);
      }
    }
    
    return directives.join('; ');
  }

  buildPermissionsPolicyHeader(permissionsConfig) {
    const policies = [];
    
    for (const [feature, allowlist] of Object.entries(permissionsConfig)) {
      if (Array.isArray(allowlist)) {
        const kebabFeature = this.camelToKebab(feature);
        if (allowlist.length === 0) {
          policies.push(`${kebabFeature}=()`);
        } else {
          const sources = allowlist.map(source => 
            source === 'self' ? '"self"' : source
          ).join(' ');
          policies.push(`${kebabFeature}=(${sources})`);
        }
      }
    }
    
    return policies.join(', ');
  }

  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  // Method to validate current configuration
  validateConfig() {
    const issues = [];
    
    // Check CSP configuration
    if (this.config.contentSecurityPolicy) {
      const csp = this.config.contentSecurityPolicy.directives;
      
      if (csp.scriptSrc && csp.scriptSrc.includes("'unsafe-eval'")) {
        issues.push("CSP allows 'unsafe-eval' which may be a security risk");
      }
      
      if (csp.scriptSrc && csp.scriptSrc.includes("'unsafe-inline'")) {
        issues.push("CSP allows 'unsafe-inline' which may be a security risk");
      }
      
      if (!csp.defaultSrc || csp.defaultSrc.length === 0) {
        issues.push("CSP default-src directive is not set");
      }
    }
    
    // Check HSTS configuration
    if (this.config.hsts && this.config.hsts.maxAge < 31536000) {
      issues.push("HSTS max-age should be at least 1 year (31536000 seconds)");
    }
    
    // Check frame options
    if (!this.config.frameOptions || 
       !['DENY', 'SAMEORIGIN'].includes(this.config.frameOptions)) {
      issues.push("X-Frame-Options should be set to DENY or SAMEORIGIN");
    }
    
    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  // Static method to get secure default configuration
  static getSecureDefaults() {
    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Often needed for CSS-in-JS
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: []
        },
        reportOnly: false
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      frameOptions: 'DENY',
      contentTypeOptions: 'nosniff',
      xssProtection: '1; mode=block',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        notifications: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: []
      }
    };
  }

  // Method to update configuration
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  // Get current configuration
  getConfig() {
    return { ...this.config };
  }
}

module.exports = SecurityHeaders;