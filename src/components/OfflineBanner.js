import React from 'react';
import useOnlineStatus from '../hooks/useOnlineStatus';

function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (isOnline && wasOffline) {
    return (
      <div style={styles.bannerOnline} role="status" aria-live="polite">
        <span style={styles.icon}>&#10003;</span>
        You're back online
      </div>
    );
  }

  return (
    <div style={styles.bannerOffline} role="alert" aria-live="assertive">
      <span style={styles.icon}>&#9888;</span>
      You're offline. Some features may be unavailable.
    </div>
  );
}

const styles = {
  bannerOffline: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#fef2f2',
    color: '#991b1b',
    padding: '12px 20px',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: 500,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderTop: '1px solid #fecaca',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)'
  },
  bannerOnline: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#f0fdf4',
    color: '#166534',
    padding: '12px 20px',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: 500,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderTop: '1px solid #bbf7d0',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
    animation: 'fadeOut 3s forwards'
  },
  icon: {
    fontSize: '1.1rem'
  }
};

// Add keyframes
if (typeof document !== 'undefined' && !document.getElementById('offline-banner-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'offline-banner-styles';
  styleSheet.textContent = `
    @keyframes fadeOut {
      0%, 70% { opacity: 1; }
      100% { opacity: 0; pointer-events: none; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default OfflineBanner;
