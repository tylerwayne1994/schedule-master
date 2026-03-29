import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>!</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              We're sorry, but something unexpected happened. Please try refreshing the page or going back to the home screen.
            </p>
            <div style={styles.buttons}>
              <button style={styles.primaryButton} onClick={this.handleReload}>
                Refresh Page
              </button>
              <button style={styles.secondaryButton} onClick={this.handleGoHome}>
                Go to Home
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: '20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1)',
  },
  icon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#fee2e2',
    color: '#dc2626',
    fontSize: '32px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '1.5rem',
    color: '#1e293b',
    margin: '0 0 12px',
  },
  message: {
    fontSize: '0.95rem',
    color: '#64748b',
    lineHeight: '1.6',
    margin: '0 0 24px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  primaryButton: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  details: {
    marginTop: '24px',
    textAlign: 'left',
  },
  summary: {
    cursor: 'pointer',
    color: '#64748b',
    fontSize: '0.85rem',
  },
  errorText: {
    marginTop: '12px',
    padding: '12px',
    background: '#fef2f2',
    borderRadius: '8px',
    fontSize: '0.75rem',
    color: '#dc2626',
    overflow: 'auto',
    maxHeight: '200px',
  },
};

export default ErrorBoundary;
