
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import TitleBar from './components/TitleBar';

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          background: '#010409',
          color: '#fff',
          padding: '40px',
          fontFamily: 'monospace',
          minHeight: '100vh'
        }}>
          <h1 style={{ color: '#FF9D3C', marginBottom: '20px' }}>REITLens Error</h1>
          <div style={{ background: '#022D5B', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ color: '#f87171', fontWeight: 'bold', marginBottom: '10px' }}>
              {this.state.error.message}
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontSize: '12px',
              color: '#94a3b8',
              overflow: 'auto',
              maxHeight: '400px'
            }}>
              {this.state.error.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#48A3CC',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isElectron = !!(window as { electronAPI?: unknown }).electronAPI;

root.render(
  <React.StrictMode>
    {isElectron && <TitleBar />}
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
