/**
 * AssetValidator.js - Comprehensive Asset Validation System
 * 
 * Validates assets according to game requirements:
 * - Sprite dimensions (32x32, 64x64, 128x128)
 * - File formats and quality
 * - Memory usage limits
 * - Performance impact assessment
 * 
 * Ensures all assets meet the retro pixel art game standards.
 */

import { AssetType } from './AssetTypes';

/**
 * Validation Rules Configuration
 */
export const ValidationRules = {
  // Sprite dimension requirements for pixel art
  ALLOWED_DIMENSIONS: [
    { width: 32, height: 32 },   // Standard sprites (boosters, skills, tokens)
    { width: 64, height: 64 },   // Medium sprites (UI elements)
    { width: 128, height: 128 }, // Player sprites
    { width: 256, height: 256 }, // Large sprites or icons
    { width: 512, height: 512 }, // Very large sprites (rare)
  ],
  
  // Track/background allowed dimensions
  TRACK_DIMENSIONS: [
    { width: 1920, height: 1080 }, // Standard game resolution
    { width: 4000, height: 2000 }, // Large foreground images
  ],
  
  // File size limits (bytes)
  MAX_FILE_SIZES: {
    [AssetType.IMAGE]: 5 * 1024 * 1024,      // 5MB for images
    [AssetType.SPRITE_SHEET]: 10 * 1024 * 1024, // 10MB for sprite sheets
    [AssetType.AUDIO]: 50 * 1024 * 1024,     // 50MB for audio
    [AssetType.JSON]: 1 * 1024 * 1024,       // 1MB for JSON
    [AssetType.CUSTOM_CANVAS]: 5 * 1024 * 1024, // 5MB for custom canvases
  },
  
  // Supported formats
  SUPPORTED_FORMATS: {
    [AssetType.IMAGE]: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    [AssetType.AUDIO]: ['mp3', 'wav', 'ogg', 'm4a'],
    [AssetType.JSON]: ['json'],
  },
  
  // Quality requirements
  IMAGE_QUALITY: {
    minBitDepth: 8,
    maxBitDepth: 32,
    allowedColorModes: ['RGB', 'RGBA', 'P'], // RGB, RGBA, Palette
  },
  
  // Performance thresholds
  PERFORMANCE: {
    maxMemoryPerAsset: 10 * 1024 * 1024, // 10MB per asset in memory
    maxLoadTimeMs: 5000, // 5 seconds max load time
    maxPixelCount: 4000 * 2000, // Max pixels per image
  }
};

/**
 * Validation Result Structure
 */
export class ValidationResult {
  constructor(valid = true, errors = [], warnings = []) {
    this.valid = valid;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = Date.now();
  }
  
  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }
  
  addWarning(message) {
    this.warnings.push(message);
  }
  
  merge(other) {
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    if (!other.valid) {
      this.valid = false;
    }
  }
}

/**
 * Comprehensive Asset Validation System
 */
export class AssetValidator {
  constructor(config = {}) {
    this.config = {
      strictMode: process.env.NODE_ENV === 'development',
      validateDimensions: true,
      validateFormats: true,
      validatePerformance: true,
      validatePixelArt: true,
      allowCustomDimensions: false,
      ...config
    };
    
    // Validation statistics
    this.stats = {
      totalValidated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      averageValidationTime: 0
    };
    
    console.log('[AssetValidator] Initialized with config:', this.config);
  }

  /**
   * Main validation entry point
   */
  async validateAsset(asset, type, options = {}) {
    const startTime = Date.now();
    const result = new ValidationResult();
    
    try {
      // Basic validation
      const basicResult = await this.validateBasicProperties(asset, type, options);
      result.merge(basicResult);
      
      // Type-specific validation
      switch (type) {
        case AssetType.IMAGE:
          const imageResult = await this.validateImage(asset, options);
          result.merge(imageResult);
          break;
          
        case AssetType.SPRITE_SHEET:
          const spriteResult = await this.validateSpriteSheet(asset, options);
          result.merge(spriteResult);
          break;
          
        case AssetType.AUDIO:
          const audioResult = await this.validateAudio(asset, options);
          result.merge(audioResult);
          break;
          
        case AssetType.JSON:
          const jsonResult = await this.validateJSON(asset, options);
          result.merge(jsonResult);
          break;
          
        case AssetType.CUSTOM_CANVAS:
          const canvasResult = await this.validateCustomCanvas(asset, options);
          result.merge(canvasResult);
          break;
      }
      
      // Performance validation
      if (this.config.validatePerformance) {
        const perfResult = await this.validatePerformance(asset, type, options);
        result.merge(perfResult);
      }
      
      // Update statistics
      const validationTime = Date.now() - startTime;
      this.updateStats(result, validationTime);
      
      if (result.valid) {
        console.log(`[AssetValidator] Asset validated successfully in ${validationTime}ms`);
      } else {
        console.warn('[AssetValidator] Asset validation failed:', result.errors);
      }
      
      return result;
      
    } catch (error) {
      result.addError(`Validation error: ${error.message}`);
      console.error('[AssetValidator] Validation exception:', error);
      return result;
    }
  }

  /**
   * Validate basic asset properties
   */
  async validateBasicProperties(asset, type, options) {
    const result = new ValidationResult();
    
    // Check if asset exists
    if (!asset) {
      result.addError('Asset is null or undefined');
      return result;
    }
    
    // Validate file size if available
    if (asset.memorySize && ValidationRules.MAX_FILE_SIZES[type]) {
      const maxSize = ValidationRules.MAX_FILE_SIZES[type];
      if (asset.memorySize > maxSize) {
        result.addError(`Asset size (${this.formatBytes(asset.memorySize)}) exceeds limit (${this.formatBytes(maxSize)})`);
      }
    }
    
    // Validate path/key format
    if (asset.path && typeof asset.path !== 'string') {
      result.addError('Asset path must be a string');
    }
    
    return result;
  }

  /**
   * Validate image assets
   */
  async validateImage(asset, options) {
    const result = new ValidationResult();
    
    // Check required properties
    if (!asset.width || !asset.height) {
      result.addError('Image asset missing width or height');
      return result;
    }
    
    // Validate dimensions
    if (this.config.validateDimensions) {
      const dimResult = this.validateImageDimensions(asset, options);
      result.merge(dimResult);
    }
    
    // Validate format
    if (this.config.validateFormats && asset.path) {
      const formatResult = this.validateImageFormat(asset.path);
      result.merge(formatResult);
    }
    
    // Pixel art specific validation
    if (this.config.validatePixelArt) {
      const pixelResult = await this.validatePixelArt(asset);
      result.merge(pixelResult);
    }
    
    return result;
  }

  /**
   * Validate image dimensions according to game requirements
   */
  validateImageDimensions(asset, options) {
    const result = new ValidationResult();
    const { width, height } = asset;
    
    // Check for track/background dimensions
    const isTrackAsset = options.isTrack || options.isBackground || 
                        (asset.path && asset.path.includes('track')) ||
                        (asset.path && asset.path.includes('background'));
    
    if (isTrackAsset) {
      const validTrackDim = ValidationRules.TRACK_DIMENSIONS.some(dim => 
        dim.width === width && dim.height === height
      );
      
      if (!validTrackDim) {
        const allowedDims = ValidationRules.TRACK_DIMENSIONS
          .map(d => `${d.width}x${d.height}`)
          .join(', ');
        result.addError(`Track/background dimensions ${width}x${height} not allowed. Allowed: ${allowedDims}`);
      }
    } else {
      // Regular sprite validation
      const validDimension = ValidationRules.ALLOWED_DIMENSIONS.some(dim => 
        dim.width === width && dim.height === height
      );
      
      if (!validDimension && !this.config.allowCustomDimensions) {
        const allowedDims = ValidationRules.ALLOWED_DIMENSIONS
          .map(d => `${d.width}x${d.height}`)
          .join(', ');
        result.addError(`Sprite dimensions ${width}x${height} not allowed. Allowed: ${allowedDims}`);
      }
      
      // Power of 2 check for better performance
      if (!this.isPowerOfTwo(width) || !this.isPowerOfTwo(height)) {
        result.addWarning(`Dimensions ${width}x${height} are not powers of 2, may impact performance`);
      }
    }
    
    // Aspect ratio validation for sprites
    if (!isTrackAsset && width !== height) {
      // Most game sprites should be square for consistency
      result.addWarning(`Non-square sprite dimensions ${width}x${height} may cause scaling issues`);
    }
    
    return result;
  }

  /**
   * Validate image format
   */
  validateImageFormat(path) {
    const result = new ValidationResult();
    
    const extension = path.split('.').pop().toLowerCase();
    const supportedFormats = ValidationRules.SUPPORTED_FORMATS[AssetType.IMAGE];
    
    if (!supportedFormats.includes(extension)) {
      result.addError(`Unsupported image format: ${extension}. Supported: ${supportedFormats.join(', ')}`);
    }
    
    // Recommend PNG for pixel art
    if (extension !== 'png') {
      result.addWarning('PNG format recommended for pixel art to avoid compression artifacts');
    }
    
    return result;
  }

  /**
   * Validate pixel art specific requirements
   */
  async validatePixelArt(asset) {
    const result = new ValidationResult();
    
    if (!asset.canvas) {
      return result; // Can't validate without canvas data
    }
    
    try {
      const ctx = asset.canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, asset.width, asset.height);
      const data = imageData.data;
      
      // Check for anti-aliasing (should not be present in pixel art)
      const hasAntiAliasing = this.detectAntiAliasing(data, asset.width, asset.height);
      if (hasAntiAliasing) {
        result.addWarning('Image appears to have anti-aliasing, which may not be suitable for pixel art');
      }
      
      // Check color count (pixel art typically has limited colors)
      const colorCount = this.countUniqueColors(data);
      if (colorCount > 256) {
        result.addWarning(`High color count (${colorCount}) detected, consider reducing for authentic pixel art look`);
      }
      
      // Check for transparency
      const hasTransparency = this.hasTransparency(data);
      if (hasTransparency) {
        result.addWarning('Transparent pixels detected, ensure proper alpha channel handling');
      }
      
    } catch (error) {
      result.addWarning(`Could not analyze pixel art properties: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Validate sprite sheet assets
   */
  async validateSpriteSheet(asset, options) {
    const result = new ValidationResult();
    
    // Validate base image first
    const imageResult = await this.validateImage(asset, options);
    result.merge(imageResult);
    
    // Validate sprite sheet configuration
    if (asset.config) {
      const configResult = this.validateSpriteConfig(asset.config, asset);
      result.merge(configResult);
    }
    
    // Validate individual sprites
    if (asset.sprites && asset.sprites.length > 0) {
      for (let i = 0; i < asset.sprites.length; i++) {
        const sprite = asset.sprites[i];
        if (!sprite.canvas || !sprite.width || !sprite.height) {
          result.addError(`Invalid sprite at index ${i}: missing canvas or dimensions`);
        }
      }
    } else {
      result.addWarning('Sprite sheet has no parsed sprites');
    }
    
    return result;
  }

  /**
   * Validate sprite sheet configuration
   */
  validateSpriteConfig(config, asset) {
    const result = new ValidationResult();
    
    // Check required properties
    if (!config.frameWidth || !config.frameHeight) {
      result.addError('Sprite config missing frameWidth or frameHeight');
      return result;
    }
    
    // Validate frame dimensions
    if (config.frameWidth <= 0 || config.frameHeight <= 0) {
      result.addError('Frame dimensions must be positive');
    }
    
    // Check if frames fit in the image
    const cols = Math.floor(asset.width / config.frameWidth);
    const rows = Math.floor(asset.height / config.frameHeight);
    
    if (cols === 0 || rows === 0) {
      result.addError(`Frame size (${config.frameWidth}x${config.frameHeight}) too large for image (${asset.width}x${asset.height})`);
    }
    
    // Validate frame range
    const totalFrames = cols * rows;
    if (config.endFrame && config.endFrame >= totalFrames) {
      result.addWarning(`End frame (${config.endFrame}) exceeds available frames (${totalFrames})`);
    }
    
    return result;
  }

  /**
   * Validate audio assets
   */
  async validateAudio(asset, options) {
    const result = new ValidationResult();
    
    // Check required properties
    if (!asset.audio) {
      result.addError('Audio asset missing audio object');
      return result;
    }
    
    // Validate format
    if (asset.path) {
      const extension = asset.path.split('.').pop().toLowerCase();
      const supportedFormats = ValidationRules.SUPPORTED_FORMATS[AssetType.AUDIO];
      
      if (!supportedFormats.includes(extension)) {
        result.addError(`Unsupported audio format: ${extension}. Supported: ${supportedFormats.join(', ')}`);
      }
    }
    
    // Validate duration
    if (asset.duration) {
      if (asset.duration > 300) { // 5 minutes
        result.addWarning(`Long audio duration (${Math.round(asset.duration)}s) may impact memory usage`);
      } else if (asset.duration < 0.1) { // 0.1 seconds
        result.addWarning(`Very short audio duration (${asset.duration.toFixed(2)}s) detected`);
      }
    }
    
    return result;
  }

  /**
   * Validate JSON assets
   */
  async validateJSON(asset, options) {
    const result = new ValidationResult();
    
    // Check if data exists and is valid JSON
    if (!asset.data) {
      result.addError('JSON asset missing data');
      return result;
    }
    
    try {
      // Validate JSON structure if schema provided
      if (options.schema) {
        const schemaResult = this.validateJSONSchema(asset.data, options.schema);
        result.merge(schemaResult);
      }
      
      // Check JSON size
      const jsonString = JSON.stringify(asset.data);
      if (jsonString.length > 100000) { // 100KB
        result.addWarning(`Large JSON file (${this.formatBytes(jsonString.length)}) may impact parsing performance`);
      }
      
    } catch (error) {
      result.addError(`JSON validation error: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Validate custom canvas assets
   */
  async validateCustomCanvas(asset, options) {
    const result = new ValidationResult();
    
    // Check canvas object
    if (!asset.canvas || !(asset.canvas instanceof HTMLCanvasElement)) {
      result.addError('Custom canvas asset missing valid canvas element');
      return result;
    }
    
    // Validate dimensions
    const dimResult = this.validateImageDimensions(asset, options);
    result.merge(dimResult);
    
    // Check canvas content
    try {
      const ctx = asset.canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, asset.width, asset.height);
      
      // Check if canvas is blank
      const isBlank = this.isCanvasBlank(imageData.data);
      if (isBlank) {
        result.addWarning('Custom canvas appears to be blank');
      }
      
    } catch (error) {
      result.addWarning(`Could not analyze canvas content: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Validate performance impact
   */
  async validatePerformance(asset, type, options) {
    const result = new ValidationResult();
    
    // Memory usage check
    if (asset.memorySize > ValidationRules.PERFORMANCE.maxMemoryPerAsset) {
      result.addError(`Asset memory usage (${this.formatBytes(asset.memorySize)}) exceeds limit (${this.formatBytes(ValidationRules.PERFORMANCE.maxMemoryPerAsset)})`);
    }
    
    // Pixel count check for images
    if ((type === AssetType.IMAGE || type === AssetType.SPRITE_SHEET) && asset.width && asset.height) {
      const pixelCount = asset.width * asset.height;
      if (pixelCount > ValidationRules.PERFORMANCE.maxPixelCount) {
        result.addWarning(`High pixel count (${pixelCount.toLocaleString()}) may impact performance`);
      }
    }
    
    return result;
  }

  /**
   * Validate JSON against schema
   */
  validateJSONSchema(data, schema) {
    const result = new ValidationResult();
    
    // Simple schema validation (can be extended with a proper JSON schema validator)
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          result.addError(`Required field missing: ${field}`);
        }
      }
    }
    
    return result;
  }

  /**
   * Detect anti-aliasing in image data
   */
  detectAntiAliasing(data, width, height) {
    // Simple edge detection to find anti-aliased pixels
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        // Check for partial transparency (anti-aliasing indicator)
        if (alpha > 0 && alpha < 255) {
          // Check neighboring pixels
          const neighbors = [
            data[((y-1) * width + x) * 4 + 3], // Top
            data[((y+1) * width + x) * 4 + 3], // Bottom
            data[(y * width + (x-1)) * 4 + 3], // Left
            data[(y * width + (x+1)) * 4 + 3]  // Right
          ];
          
          // If we have both fully transparent and fully opaque neighbors,
          // this might be anti-aliasing
          const hasTransparent = neighbors.some(a => a === 0);
          const hasOpaque = neighbors.some(a => a === 255);
          
          if (hasTransparent && hasOpaque) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Count unique colors in image data
   */
  countUniqueColors(data) {
    const colors = new Set();
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      colors.add(`${r},${g},${b},${a}`);
    }
    
    return colors.size;
  }

  /**
   * Check if image has transparency
   */
  hasTransparency(data) {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if canvas is blank
   */
  isCanvasBlank(data) {
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if number is power of 2
   */
  isPowerOfTwo(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Update validation statistics
   */
  updateStats(result, validationTime) {
    this.stats.totalValidated++;
    
    if (result.valid) {
      this.stats.passed++;
    } else {
      this.stats.failed++;
    }
    
    this.stats.warnings += result.warnings.length;
    
    // Update average validation time
    this.stats.averageValidationTime = 
      (this.stats.averageValidationTime * (this.stats.totalValidated - 1) + validationTime) / 
      this.stats.totalValidated;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalValidated > 0 ? 
        Math.round((this.stats.passed / this.stats.totalValidated) * 100) : 0
    };
  }

  /**
   * Reset validation statistics
   */
  resetStats() {
    this.stats = {
      totalValidated: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      averageValidationTime: 0
    };
  }
}

export default AssetValidator;