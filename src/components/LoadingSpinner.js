import React from 'react';

function LoadingSpinner({ size = 'medium', text = 'Loading...' }) {
  const sizeStyles = {
    small: { width: 24, height: 24, borderWidth: 2 },
    medium: { width: 40, height: 40, borderWidth: 3 },
    large: { width: 60, height: 60, borderWidth: 4 }
  };

  const spinnerSize = sizeStyles[size] || sizeStyles.medium;

  return (
    <div style={styles.container} role="status" aria-live="polite">
      <div 
        style={{
          ...styles.spinner,
          ...spinnerSize
        }} 
      />
      {text && <p style={styles.text}>{text}</p>}
      <span style={styles.srOnly}>Loading</span>
    </div>
  );
}

function LoadingOverlay({ text = 'Loading...' }) {
  return (
    <div style={styles.overlay} role="status" aria-live="polite">
      <div style={styles.overlayContent}>
        <LoadingSpinner size="large" text={text} />
      </div>
    </div>
  );
}

function LoadingButton({ loading, children, disabled, ...props }) {
  return (
    <button 
      {...props} 
      disabled={disabled || loading}
      style={{
        ...props.style,
        position: 'relative',
        opacity: loading ? 0.7 : 1
      }}
    >
      {loading && (
        <span style={styles.buttonSpinner}>
          <LoadingSpinner size="small" text="" />
        </span>
      )}
      <span style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {children}
      </span>
    </button>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '12px'
  },
  spinner: {
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  text: {
    color: '#64748b',
    fontSize: '0.9rem',
    margin: 0
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  overlayContent: {
    background: '#ffffff',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.15)'
  },
  buttonSpinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
  }
};

// Add keyframes for spinner animation via style tag
if (typeof document !== 'undefined' && !document.getElementById('loading-spinner-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'loading-spinner-styles';
  styleSheet.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export { LoadingSpinner, LoadingOverlay, LoadingButton };
export default LoadingSpinner;
