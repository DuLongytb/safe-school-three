import React, { useState, useEffect } from 'react';

const Modal = ({
  isOpen,
  title,
  message,
  inputPlaceholder,
  initialInputValue = '',
  requireInput = false,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'primary', // 'primary' | 'danger' | 'success'
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState(initialInputValue);

  useEffect(() => {
    setInputValue(initialInputValue);
  }, [isOpen, initialInputValue]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    if (variant === 'danger') {
      return {
        bg: '#dc2626',
        hoverBg: '#b91c1c',
        icon: '⚠️',
      };
    }
    if (variant === 'success') {
      return {
        bg: '#16a34a',
        hoverBg: '#15803d',
        icon: '✅',
      };
    }
    return {
      bg: '#1e3c72',
      hoverBg: '#162b52',
      icon: '💬',
    };
  };

  const currentVariant = getVariantStyles();

  const handleConfirm = () => {
    if (requireInput && !inputValue.trim()) {
      return;
    }
    onConfirm(inputValue);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{currentVariant.icon}</span>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '600' }}>
            {title}
          </h3>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {message && (
            <p style={{ margin: '0 0 16px 0', color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {message}
            </p>
          )}

          {inputPlaceholder && (
            <div style={{ marginTop: '12px' }}>
              <textarea
                rows={3}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {requireInput && !inputValue.trim() && (
                <span style={{ color: '#dc2626', fontSize: '0.825rem', marginTop: '4px', display: 'block' }}>
                  * Vui lòng nhập thông tin yêu cầu trước khi xác nhận.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={requireInput && !inputValue.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: currentVariant.bg,
              color: '#ffffff',
              fontWeight: '600',
              cursor: requireInput && !inputValue.trim() ? 'not-allowed' : 'pointer',
              opacity: requireInput && !inputValue.trim() ? 0.6 : 1,
              fontSize: '0.9rem',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Modal;
