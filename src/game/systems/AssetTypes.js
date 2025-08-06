/**
 * AssetTypes.js - Asset type definitions
 * 
 * Separated to avoid circular dependencies between AssetManager and AssetValidator
 */

/**
 * Asset Loading States
 */
export const AssetState = {
  PENDING: 'pending',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
  CACHED: 'cached',
  VALIDATING: 'validating',
  HOT_RELOADING: 'hot_reloading'
};

/**
 * Asset Types
 */
export const AssetType = {
  IMAGE: 'image',
  SPRITE_SHEET: 'spritesheet',
  AUDIO: 'audio',
  JSON: 'json',
  FONT: 'font',
  CUSTOM_CANVAS: 'custom_canvas'
};