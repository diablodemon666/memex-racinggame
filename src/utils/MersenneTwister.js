/**
 * MersenneTwister.js - Professional-grade random number generator
 * 
 * Implementation of the Mersenne Twister algorithm for high-quality
 * random number generation. Used for consistent game randomness.
 */

/**
 * Mersenne Twister Random Number Generator
 * 
 * Provides high-quality pseudo-random numbers with excellent
 * statistical properties and long period (2^19937-1).
 */
export class MersenneTwister {
  constructor(seed) {
    this.MT = new Array(624);
    this.index = 0;
    this.init(seed || Date.now());
  }

  /**
   * Initialize the generator with a seed
   */
  init(seed) {
    this.MT[0] = seed;
    for (let i = 1; i < 624; i++) {
      this.MT[i] = (1812433253 * (this.MT[i-1] ^ (this.MT[i-1] >>> 30)) + i) >>> 0;
    }
    this.index = 0;
  }

  /**
   * Generate a random number between 0 and 1
   */
  random() {
    if (this.index === 0) {
      this.generateNumbers();
    }
    
    let y = this.MT[this.index];
    y = y ^ (y >>> 11);
    y = y ^ ((y << 7) & 0x9d2c5680);
    y = y ^ ((y << 15) & 0xefc60000);
    y = y ^ (y >>> 18);
    
    this.index = (this.index + 1) % 624;
    return (y >>> 0) / 0x100000000;
  }

  /**
   * Generate the next 624 numbers
   */
  generateNumbers() {
    for (let i = 0; i < 624; i++) {
      let y = (this.MT[i] & 0x80000000) + (this.MT[(i + 1) % 624] & 0x7fffffff);
      this.MT[i] = this.MT[(i + 397) % 624] ^ (y >>> 1);
      if (y % 2 !== 0) {
        this.MT[i] = this.MT[i] ^ 0x9908b0df;
      }
    }
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random float between min and max
   */
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /**
   * Generate random boolean with optional probability
   */
  randomBool(probability = 0.5) {
    return this.random() < probability;
  }

  /**
   * Choose random element from array
   */
  choice(array) {
    if (array.length === 0) return undefined;
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generate random number with Gaussian (normal) distribution
   */
  randomGaussian(mean = 0, stdDev = 1) {
    // Box-Muller transformation
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare * stdDev + mean;
    }

    this.hasSpare = true;
    const u = this.random();
    const v = this.random();
    const mag = stdDev * Math.sqrt(-2.0 * Math.log(u));
    this.spare = mag * Math.cos(2.0 * Math.PI * v);
    
    return mag * Math.sin(2.0 * Math.PI * v) + mean;
  }

  /**
   * Get current state for serialization
   */
  getState() {
    return {
      MT: [...this.MT],
      index: this.index,
      hasSpare: this.hasSpare,
      spare: this.spare
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state) {
    this.MT = [...state.MT];
    this.index = state.index;
    this.hasSpare = state.hasSpare || false;
    this.spare = state.spare || 0;
  }
}

export default MersenneTwister;