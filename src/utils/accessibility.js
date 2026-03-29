/**
 * Accessibility utilities for Schedule Master
 */

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]'
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message, priority = 'polite') {
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
  
  // Small delay to ensure screen readers pick it up
  setTimeout(() => {
    announcement.textContent = message;
  }, 100);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Generate unique IDs for form elements
 */
let idCounter = 0;
export function generateId(prefix = 'a11y') {
  return `${prefix}-${++idCounter}`;
}

/**
 * Format time for screen readers
 */
export function formatTimeForScreenReader(time) {
  const hour = Math.floor(time);
  const minute = time % 1 === 0.5 ? 30 : 0;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format duration for screen readers
 */
export function formatDurationForScreenReader(hours) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }
  if (hours === 1) {
    return '1 hour';
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} hours`;
  }
  return `${wholeHours} hours and ${minutes} minutes`;
}

/**
 * Format date for screen readers
 */
export function formatDateForScreenReader(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Create skip link for keyboard navigation
 */
export function createSkipLink(targetId, text = 'Skip to main content') {
  return {
    href: `#${targetId}`,
    className: 'skip-link',
    children: text,
    style: {
      position: 'absolute',
      left: '-9999px',
      top: 'auto',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      zIndex: 1000
    },
    onFocus: (e) => {
      e.target.style.left = '0';
      e.target.style.width = 'auto';
      e.target.style.height = 'auto';
    },
    onBlur: (e) => {
      e.target.style.left = '-9999px';
      e.target.style.width = '1px';
      e.target.style.height = '1px';
    }
  };
}

/**
 * Handle arrow key navigation for lists/grids
 */
export function handleArrowKeyNavigation(event, items, currentIndex, setIndex, options = {}) {
  const { wrap = true, orientation = 'vertical' } = options;
  
  const keyMap = orientation === 'vertical' 
    ? { prev: 'ArrowUp', next: 'ArrowDown' }
    : { prev: 'ArrowLeft', next: 'ArrowRight' };
  
  if (event.key === keyMap.next) {
    event.preventDefault();
    const nextIndex = currentIndex + 1;
    if (nextIndex < items.length) {
      setIndex(nextIndex);
    } else if (wrap) {
      setIndex(0);
    }
  } else if (event.key === keyMap.prev) {
    event.preventDefault();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setIndex(prevIndex);
    } else if (wrap) {
      setIndex(items.length - 1);
    }
  } else if (event.key === 'Home') {
    event.preventDefault();
    setIndex(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    setIndex(items.length - 1);
  }
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user has high contrast preference
 */
export function prefersHighContrast() {
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Visibility hidden styles for screen reader only content
 */
export const srOnlyStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
};

const accessibilityUtils = {
  getFocusableElements,
  announceToScreenReader,
  generateId,
  formatTimeForScreenReader,
  formatDurationForScreenReader,
  formatDateForScreenReader,
  createSkipLink,
  handleArrowKeyNavigation,
  prefersReducedMotion,
  prefersHighContrast,
  srOnlyStyle
};

export default accessibilityUtils;
