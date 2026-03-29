import { useEffect, useRef, useCallback } from 'react';
import { getFocusableElements } from '../utils/accessibility';

/**
 * Hook to trap focus within a container (for modals, dialogs)
 * @param {boolean} isActive - Whether the focus trap is active
 * @param {Object} options - Configuration options
 * @returns {React.RefObject} - Ref to attach to the container element
 */
export function useFocusTrap(isActive = true, options = {}) {
  const { 
    autoFocus = true,
    restoreFocus = true,
    escapeDeactivates = true,
    onEscape = null
  } = options;
  
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Store the previously focused element when trap activates
  useEffect(() => {
    if (isActive && restoreFocus) {
      previouslyFocusedRef.current = document.activeElement;
    }
    
    return () => {
      // Restore focus when trap deactivates
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    };
  }, [isActive, restoreFocus]);

  // Auto-focus first focusable element when trap activates
  useEffect(() => {
    if (isActive && autoFocus && containerRef.current) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          focusableElements[0].focus();
        }, 10);
      }
    }
  }, [isActive, autoFocus]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event) => {
    if (!isActive || !containerRef.current) return;

    // Handle Escape key
    if (escapeDeactivates && event.key === 'Escape') {
      event.preventDefault();
      if (onEscape) {
        onEscape();
      }
      return;
    }

    // Handle Tab key for focus trapping
    if (event.key === 'Tab') {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [isActive, escapeDeactivates, onEscape]);

  // Attach keyboard event listener
  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isActive, handleKeyDown]);

  return containerRef;
}

/**
 * Hook to manage focus when navigating between elements
 */
export function useFocusNavigation(items, currentIndex) {
  const itemRefs = useRef([]);

  useEffect(() => {
    if (itemRefs.current[currentIndex]) {
      itemRefs.current[currentIndex].focus();
    }
  }, [currentIndex]);

  const setItemRef = useCallback((index) => (element) => {
    itemRefs.current[index] = element;
  }, []);

  return { setItemRef };
}

/**
 * Hook to announce changes to screen readers
 */
export function useAnnouncer() {
  const announce = useCallback((message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      announcement.textContent = message;
    }, 100);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return announce;
}

export default useFocusTrap;
