import React from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '70vh',
          padding: '40px 20px',
          fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
          backgroundColor: 'var(--primary-bg, #f8fafc)'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px'
            }}>
              ⚠️
            </div>

            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '10px'
            }}>
              {this.props.title || 'Không thể tải trang hồ sơ'}
            </h2>

            <p style={{
              fontSize: '0.95rem',
              color: '#64748b',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              {this.props.message || 'Đã xảy ra sự cố không mong muốn trong quá trình xử lý dữ liệu. Bạn vui lòng thử lại hoặc quay lại trang chủ.'}
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--primary-light, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                }}
              >
                🔄 Thử lại
              </button>

              <Link
                to="/"
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                🏠 Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
