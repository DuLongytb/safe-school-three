import React, { useState, useEffect } from 'react';

export default function Avatar({ src, alt, className = '', style = {}, onClick }) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const defaultSvg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`default-avatar-svg ${className}`}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        alignSelf: 'flex-start',
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        backgroundColor: '#e2e8f0',
        color: '#64748b',
        padding: '12%',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
    >
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  if (!src || hasError) {
    return defaultSvg;
  }

  return (
    <img
      src={src}
      alt={alt || 'Avatar'}
      className={className}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        alignSelf: 'flex-start',
        aspectRatio: '1 / 1',
        objectFit: 'cover',
        borderRadius: '50%',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
      onError={() => setHasError(true)}
    />
  );
}
