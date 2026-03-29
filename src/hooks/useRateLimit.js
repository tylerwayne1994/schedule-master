import { useState, useCallback, useRef } from 'react';
import RateLimiter from '../utils/rateLimiter';

/**
 * Hook for rate limiting actions in components
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} - { execute, isLimited, retryAfter, reset }
 */
export function useRateLimit(maxRequests = 10, windowMs = 60000) {
  const [isLimited, setIsLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const limiterRef = useRef(new RateLimiter(maxRequests, windowMs));
  const timeoutRef = useRef(null);

  const execute = useCallback(async (action) => {
    const result = limiterRef.current.tryRequest();
    
    if (!result.allowed) {
      setIsLimited(true);
      setRetryAfter(result.retryAfter);
      
      // Auto-reset the limited state after retry period
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsLimited(false);
        setRetryAfter(0);
      }, result.retryAfter * 1000);
      
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${result.retryAfter}s`,
        retryAfter: result.retryAfter
      };
    }
    
    setIsLimited(false);
    setRetryAfter(0);
    
    try {
      const data = await action();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const reset = useCallback(() => {
    limiterRef.current.reset();
    setIsLimited(false);
    setRetryAfter(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return { execute, isLimited, retryAfter, reset };
}

/**
 * Hook for debounced values
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  const timeoutRef = useRef(null);
  
  useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Hook for throttled callbacks
 */
export function useThrottle(callback, delay = 1000) {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    const now = Date.now();
    
    if (now - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, delay - (now - lastRan.current));
    }
  }, [callback, delay]);
}

export default useRateLimit;
