import React, { useState, useEffect } from 'react';

export default function Avatar({
  src,
  alt = '',
  isAnonymous = false,
  className = '',
  style = {},
  onClick
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Check if this avatar represents an anonymous user
  const isAnon = Boolean(
    isAnonymous ||
    (typeof alt === 'string' && (
      alt.toLowerCase().includes('ẩn danh') ||
      alt.toLowerCase().includes('anonymous')
    ))
  );

  const baseStyle = {
    display: 'inline-block',
    flexShrink: 0,
    aspectRatio: '1 / 1',
    borderRadius: '50%',
    boxSizing: 'border-box',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    ...style
  };

  // 1. Anonymous Avatar (Minimalist, friendly SafeSchool cyan/slate silhouette)
  if (isAnon || (!src && isAnonymous)) {
    return (
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`safe-avatar safe-avatar-anonymous ${className}`}
        style={{
          ...baseStyle,
          backgroundColor: '#e0f2fe',
          border: '1px solid #bae6fd',
        }}
        onClick={onClick}
        title={alt || 'Ẩn danh'}
        aria-label={alt || 'Ẩn danh'}
      >
        {/* Background circle */}
        <circle cx="18" cy="18" r="18" fill="#e0f2fe" />
        {/* Friendly Anonymous Silhouette */}
        <circle cx="18" cy="13.5" r="5" fill="#0284c7" />
        <path
          d="M8 29.5C8 24 12 21 18 21C24 21 28 24 28 29.5C28 30 27.5 30.5 27 30.5H9C8.5 30.5 8 30 8 29.5Z"
          fill="#0284c7"
        />
        {/* Sleek incognito mask/glasses accent */}
        <rect x="12" y="11.5" width="12" height="3.5" rx="1.75" fill="#bae6fd" />
      </svg>
    );
  }

  // 2. Default Member Avatar (Fallback when no src or when image fails to load)
  if (!src || hasError) {
    return (
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`safe-avatar safe-avatar-default ${className}`}
        style={{
          ...baseStyle,
          backgroundColor: '#f1f5f9',
          border: '1px solid #e2e8f0',
        }}
        onClick={onClick}
        title={alt || 'Thành viên'}
        aria-label={alt || 'Thành viên'}
      >
        <circle cx="18" cy="18" r="18" fill="#f1f5f9" />
        <circle cx="18" cy="13.5" r="5" fill="#94a3b8" />
        <path
          d="M8 29.5C8 24 12 21 18 21C24 21 28 24 28 29.5C28 30 27.5 30.5 27 30.5H9C8.5 30.5 8 30 8 29.5Z"
          fill="#94a3b8"
        />
      </svg>
    );
  }

  // 3. Standard User Avatar Image
  return (
    <img
      src={src}
      alt={alt || 'Avatar'}
      className={`safe-avatar ${className}`}
      style={{
        ...baseStyle,
        objectFit: 'cover',
      }}
      onClick={onClick}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

