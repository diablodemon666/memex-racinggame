// TDD RED Phase - Write failing test for Security Headers System
const SecurityHeaders = require('../../src/auth/SecurityHeaders.js');

describe('SecurityHeaders', () => {
  let securityHeaders;
  const mockConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:']
      },
      reportOnly: false
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin'
  };

  beforeEach(() => {
    securityHeaders = new SecurityHeaders(mockConfig);
  });

  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Act & Assert
      expect(() => {
        const headers = new SecurityHeaders(mockConfig);
        expect(headers).toBeDefined();
      }).not.toThrow();
    });

    it('should use default config when not provided', () => {
      // Act
      const headers = new SecurityHeaders({});

      // Assert
      expect(headers.config.frameOptions).toBeDefined();
      expect(headers.config.contentTypeOptions).toBeDefined();
    });

    it('should provide secure defaults', () => {
      // Act
      const secureDefaults = SecurityHeaders.getSecureDefaults();

      // Assert
      expect(secureDefaults.frameOptions).toBe('DENY');
      expect(secureDefaults.contentTypeOptions).toBe('nosniff');
      expect(secureDefaults.hsts.maxAge).toBeGreaterThanOrEqual(31536000);
      expect(secureDefaults.contentSecurityPolicy.directives.objectSrc).toEqual(["'none'"]);
    });
  });

  describe('CSP header building', () => {
    it('should build proper CSP header from directives', () => {
      // Arrange
      const cspConfig = {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      };

      // Act
      const cspHeader = securityHeaders.buildCSPHeader(cspConfig);

      // Assert
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src 'self' 'unsafe-inline'");
      expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspHeader).toContain("img-src 'self' data: https:");
      expect(cspHeader.split(';')).toHaveLength(4);
    });

    it('should handle camelCase to kebab-case conversion', () => {
      // Arrange
      const testCases = [
        { input: 'defaultSrc', expected: 'default-src' },
        { input: 'scriptSrc', expected: 'script-src' },
        { input: 'contentSecurityPolicy', expected: 'content-security-policy' }
      ];

      // Act & Assert
      testCases.forEach(({ input, expected }) => {
        expect(securityHeaders.camelToKebab(input)).toBe(expected);
      });
    });
  });

  describe('Permissions Policy header building', () => {
    it('should build proper Permissions Policy header', () => {
      // Arrange
      const permissionsConfig = {
        camera: [],
        microphone: ['self'],
        geolocation: ['self', 'https://example.com']
      };

      // Act
      const permissionsHeader = securityHeaders.buildPermissionsPolicyHeader(permissionsConfig);

      // Assert
      expect(permissionsHeader).toContain('camera=()');
      expect(permissionsHeader).toContain('microphone=("self")');
      expect(permissionsHeader).toContain('geolocation=("self" https://example.com)');
    });
  });

  describe('Express middleware', () => {
    it('should set security headers in response', () => {
      // Arrange
      const middleware = securityHeaders.expressMiddleware();
      const mockReq = { secure: true };
      const mockRes = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext = jest.fn();

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockRes.removeHeader).toHaveBeenCalledWith('Server');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set HSTS for non-secure requests', () => {
      // Arrange
      const middleware = securityHeaders.expressMiddleware();
      const mockReq = { secure: false };
      const mockRes = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext = jest.fn();

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
    });

    it('should handle CSP report-only mode', () => {
      // Arrange
      const reportOnlyHeaders = new SecurityHeaders({
        contentSecurityPolicy: {
          directives: { defaultSrc: ["'self'"] },
          reportOnly: true
        }
      });
      const middleware = reportOnlyHeaders.expressMiddleware();
      const mockReq = {};
      const mockRes = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext = jest.fn();

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Security-Policy-Report-Only', expect.any(String));
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    });
  });

  describe('configuration validation', () => {
    it('should validate secure configuration', () => {
      // Arrange
      const secureConfig = SecurityHeaders.getSecureDefaults();
      const secureHeaders = new SecurityHeaders(secureConfig);

      // Act
      const validation = secureHeaders.validateConfig();

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect CSP security issues', () => {
      // Arrange
      const unsafeConfig = {
        contentSecurityPolicy: {
          directives: {
            scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
          }
        }
      };
      const unsafeHeaders = new SecurityHeaders(unsafeConfig);

      // Act
      const validation = unsafeHeaders.validateConfig();

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain("CSP allows 'unsafe-eval' which may be a security risk");
      expect(validation.issues).toContain("CSP allows 'unsafe-inline' which may be a security risk");
    });

    it('should detect weak HSTS configuration', () => {
      // Arrange
      const weakHSTSConfig = {
        hsts: {
          maxAge: 3600 // 1 hour, should be at least 1 year
        }
      };
      const weakHeaders = new SecurityHeaders(weakHSTSConfig);

      // Act
      const validation = weakHeaders.validateConfig();

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('HSTS max-age should be at least 1 year (31536000 seconds)');
    });

    it('should detect missing frame options', () => {
      // Arrange
      const noFrameConfig = {
        frameOptions: null
      };
      const noFrameHeaders = new SecurityHeaders(noFrameConfig);

      // Act
      const validation = noFrameHeaders.validateConfig();

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('X-Frame-Options should be set to DENY or SAMEORIGIN');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      // Arrange
      const newConfig = {
        frameOptions: 'SAMEORIGIN',
        contentTypeOptions: 'nosniff'
      };

      // Act
      securityHeaders.updateConfig(newConfig);
      const updatedConfig = securityHeaders.getConfig();

      // Assert
      expect(updatedConfig.frameOptions).toBe('SAMEORIGIN');
      expect(updatedConfig.contentTypeOptions).toBe('nosniff');
    });

    it('should preserve existing config when updating', () => {
      // Arrange
      const originalHSTS = securityHeaders.getConfig().hsts;
      const newConfig = {
        frameOptions: 'SAMEORIGIN'
      };

      // Act
      securityHeaders.updateConfig(newConfig);
      const updatedConfig = securityHeaders.getConfig();

      // Assert
      expect(updatedConfig.hsts).toEqual(originalHSTS);
      expect(updatedConfig.frameOptions).toBe('SAMEORIGIN');
    });
  });

  describe('security best practices', () => {
    it('should remove server identification headers', () => {
      // Arrange
      const middleware = securityHeaders.expressMiddleware();
      const mockReq = {};
      const mockRes = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext = jest.fn();

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockRes.removeHeader).toHaveBeenCalledWith('Server');
    });

    it('should enforce secure defaults for permissions policy', () => {
      // Act
      const secureDefaults = SecurityHeaders.getSecureDefaults();

      // Assert
      expect(secureDefaults.permissionsPolicy.camera).toEqual([]);
      expect(secureDefaults.permissionsPolicy.microphone).toEqual([]);
      expect(secureDefaults.permissionsPolicy.geolocation).toEqual([]);
      expect(secureDefaults.permissionsPolicy.payment).toEqual([]);
    });
  });
});