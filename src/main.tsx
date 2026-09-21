import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('SunoSakhi ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const errText = this.state.error?.message || String(this.state.error || 'Unknown rendering error');
      return (
        <div style={{
          padding: '24px',
          color: '#ffffff',
          backgroundColor: '#0c0418',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ec4899', fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            🌸 SunoSakhi
          </h2>
          <p style={{ color: '#e2e8f0', fontSize: '14px', maxWidth: '400px', marginBottom: '14px' }}>
            App load hone me samasya aayi. Kripya reload karein.
          </p>

          <div style={{
            color: '#fda4af',
            backgroundColor: '#200a28',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '12px',
            padding: '10px 14px',
            maxWidth: '420px',
            fontSize: '11px',
            fontFamily: 'monospace',
            marginBottom: '20px',
            wordBreak: 'break-word',
            textAlign: 'left'
          }}>
            <strong>Error:</strong> {errText}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(to right, #db2777, #9333ea)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🔄 Reload App
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('sunosakhi_current_user');
                  localStorage.removeItem('sunosakhi_host_profile');
                  localStorage.removeItem('sunosakhi_host_logged_in');
                } catch (e) {}
                window.location.href = window.location.pathname;
              }}
              style={{
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🚪 Reset & Logout
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

