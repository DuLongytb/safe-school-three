import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Roles allowed to access admin/moderation panel
const MODERATOR_ROLES = ['admin', 'teacher', 'psychologist', 'expert', 'giáo viên', 'chuyên gia', 'moderator'];

export const isModerator = (role) => {
  if (!role) return false;
  return MODERATOR_ROLES.includes(String(role).trim().toLowerCase());
};

/**
 * ProtectedRoute — guards a route behind authentication.
 * Props:
 *   children      — the component(s) to render when authorized
 *   requireAdmin  — if true, also checks that user has a moderator/admin role
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontFamily: 'var(--font-sans)',
        color: 'var(--primary)',
        backgroundColor: 'var(--primary-bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--gray-medium)',
            borderTopColor: 'var(--primary-light)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontWeight: 600 }}>Đang tải thông tin tài khoản...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin/moderator gate
  if (requireAdmin && !isModerator(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}