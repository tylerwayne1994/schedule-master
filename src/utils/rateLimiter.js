/**
 * Rate limiting utilities to prevent API abuse
 */

// Simple in-memory rate limiter
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // key -> timestamps array
  }

  // Check if action is allowed, returns { allowed, retryAfter }
  check(key = 'default') {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      const oldestInWindow = Math.min(...validTimestamps);
      const retryAfter = this.windowMs - (now - oldestInWindow);
      return { allowed: false, retryAfter: Math.ceil(retryAfter / 1000) };
    }
    
    return { allowed: true, retryAfter: 0 };
  }

  // Record a request
  record(key = 'default') {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
  }

  // Check and record if allowed
  tryRequest(key = 'default') {
    const result = this.check(key);
    if (result.allowed) {
      this.record(key);
    }
    return result;
  }

  // Reset a specific key or all
  reset(key = null) {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

// Pre-configured limiters for different use cases
export const apiLimiter = new RateLimiter(30, 60000); // 30 requests per minute
export const authLimiter = new RateLimiter(5, 60000); // 5 auth attempts per minute
export const bookingLimiter = new RateLimiter(10, 60000); // 10 bookings per minute

/**
 * Throttle function - limits how often a function can be called
 */
export function throttle(func, limit = 1000) {
  let inThrottle = false;
  let lastResult;
  
  return function(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Debounce function - delays execution until pause in calls
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Rate-limited fetch wrapper
 */
export async function rateLimitedFetch(url, options = {}, limiterKey = 'api') {
  const result = apiLimiter.tryRequest(limiterKey);
  
  if (!result.allowed) {
    throw new Error(`Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`);
  }
  
  return fetch(url, options);
}

/**
 * Hook helper for rate limiting in components
 */
export function createRateLimitedAction(limiter, action) {
  return async (...args) => {
    const result = limiter.tryRequest();
    if (!result.allowed) {
      return {
        success: false,
        error: `Too many requests. Please wait ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      };
    }
    
    try {
      const response = await action(...args);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

export default RateLimiter;
