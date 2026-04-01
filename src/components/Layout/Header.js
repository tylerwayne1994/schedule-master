import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';
import './Layout.css';
import '../Notifications/MessageCenter.css';

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z" clipRule="evenodd" />
    </svg>
  );
}

function Header({ currentPage, onNavigate, unreadCount, onOpenMessages }) {
  const { currentUser, logout, isAdmin } = useAuth();

  return (
    <header className="app-header">
      <div className="header-brand">
        <img src={logo} alt="Next Level Helicopters" className="header-logo" />
      </div>

      <nav className="header-nav">
        <button 
          className={currentPage === 'schedule' ? 'active' : ''}
          onClick={() => onNavigate('schedule')}
        >
          Schedule
        </button>
        <button 
          className={currentPage === 'my-bookings' ? 'active' : ''}
          onClick={() => onNavigate('my-bookings')}
        >
          My Bookings
        </button>
        <button 
          className={currentPage === 'profile' ? 'active' : ''}
          onClick={() => onNavigate('profile')}
        >
          Profile
        </button>
        {isAdmin() && (
          <>
            <button 
              className={currentPage === 'admin' ? 'active' : ''}
              onClick={() => onNavigate('admin')}
            >
              Admin
            </button>
            <button 
              className={currentPage === 'admin-schedule' ? 'active' : ''}
              onClick={() => onNavigate('admin-schedule')}
            >
              Admin Schedule
            </button>
            <button 
              className={currentPage === 'helicopters' ? 'active' : ''}
              onClick={() => onNavigate('helicopters')}
            >
              Helicopters
            </button>
            <button 
              className={currentPage === 'bookings' ? 'active' : ''}
              onClick={() => onNavigate('bookings')}
            >
              Bookings
            </button>
            <button 
              className={currentPage === 'maintenance' ? 'active' : ''}
              onClick={() => onNavigate('maintenance')}
            >
              Maintenance
            </button>
            <button 
              className={currentPage === 'cfis' ? 'active' : ''}
              onClick={() => onNavigate('cfis')}
            >
              CFIs
            </button>
            <button 
              className={currentPage === 'users' ? 'active' : ''}
              onClick={() => onNavigate('users')}
            >
              Users
            </button>
          </>
        )}
      </nav>

      <div className="header-user">
        <button 
          className="notification-bell" 
          onClick={onOpenMessages}
          aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <span className="user-name">
          {currentUser?.name}
          {isAdmin() && <span className="admin-badge">Admin</span>}
        </span>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Header;
