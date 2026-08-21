import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePushNotification } from '../../contexts/NotificationContext';
import './PushNotification.css';

const DEFAULT_ICONS = {
  sos: '🚨',
  critical: '⚠️',
  chat: '💬',
  system: '🔔',
  normal: '👍',
};

// Single Push Notification Toast Component with Swipe-to-Dismiss & Navigation
const PushNotificationCard = ({ notification, index, onDismiss }) => {
  const navigate = useNavigate();
  const [touchStartX, setTouchStartX] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const cardRef = useRef(null);

  const { id, title, message, category = 'normal', icon, targetUrl } = notification;

  // Icon selector
  const displayIcon = icon || DEFAULT_ICONS[category] || DEFAULT_ICONS.normal;

  // Handler: Click to navigate
  const handleClick = (e) => {
    // If user was dragging to swipe, don't trigger click navigation
    if (Math.abs(dragOffset) > 10) return;
    
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss(id);
      if (targetUrl) {
        navigate(targetUrl);
      }
    }, 200);
  };

  // Swipe to dismiss gesture handlers (Touch Events)
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (touchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStartX;
    // Only allow swiping right (dismiss direction)
    if (diffX > 0) {
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset > 80) {
      setIsDismissing(true);
      setTimeout(() => onDismiss(id), 250);
    } else {
      setDragOffset(0);
    }
    setTouchStartX(null);
  };

  // Manual Close Button Click
  const handleClose = (e) => {
    e.stopPropagation();
    setIsDismissing(true);
    setTimeout(() => onDismiss(id), 200);
  };

  // Dynamically assign 3D stacking overlay class (stack-0, stack-1, stack-2)
  const stackClass = `stack-${Math.min(index, 3)}`;
  const categoryClass = `category-${category}`;

  return (
    <div
      ref={cardRef}
      className={`push-notif-card ${stackClass} ${categoryClass} ${isDismissing ? 'dismissing' : ''}`}
      style={{
        transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
        opacity: dragOffset > 0 ? Math.max(0, 1 - dragOffset / 200) : undefined,
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="push-notif-inner">
        <div className="push-notif-icon-box">{displayIcon}</div>
        <div className="push-notif-content">
          <div className="push-notif-header-row">
            <div className="push-notif-title">{title}</div>
            <button
              type="button"
              className="push-notif-close-btn"
              onClick={handleClose}
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
          <div className="push-notif-message">{message}</div>
        </div>
      </div>
    </div>
  );
};

// Container rendering the overlay stack of notifications
export default function PushNotificationContainer() {
  const { notifications, dismissNotification } = usePushNotification();

  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="push-notif-container" aria-live="polite">
      {notifications.map((notif, index) => (
        <PushNotificationCard
          key={notif.id}
          notification={notif}
          index={index}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
}
