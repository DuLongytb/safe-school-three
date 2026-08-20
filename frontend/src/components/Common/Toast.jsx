import React, { useEffect } from 'react';

const toastTypeStyles = {
  success: {
    bg: '#f0fdf4',
    border: '#16a34a',
    color: '#15803d',
    icon: '✅',
  },
  error: {
    bg: '#fef2f2',
    border: '#dc2626',
    color: '#b91c1c',
    icon: '🚨',
  },
  warning: {
    bg: '#fffbe6',
    border: '#d97706',
    color: '#b45309',
    icon: '⚠️',
  },
  info: {
    bg: '#eff6ff',
    border: '#2563eb',
    color: '#1d4ed8',
    icon: 'ℹ️',
  },
};

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const style = toastTypeStyles[type] || toastTypeStyles.info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: style.bg,
        borderLeft: `5px solid ${style.border}`,
        color: style.color,
        padding: '14px 20px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        minWidth: '300px',
        maxWidth: '450px',
        fontSize: '0.95rem',
        fontWeight: '500',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{style.icon}</span>
      <span style={{ flex: 1, lineHeight: '1.4' }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: style.color,
          fontSize: '1.1rem',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: '4px',
          opacity: 0.8,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;
