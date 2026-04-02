import React, { useState, useEffect } from 'react';
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

function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function Header({ currentPage, onNavigate, unreadCount, onOpenMessages, pendingApprovalCount }) {
  const { currentUser, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu when page changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPage]);

  // Close menu on resize if desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <img src={logo} alt="Next Level Helicopters" className="header-logo" />
      </div>

      {/* Mobile hamburger button */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <nav className={`header-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <button 
          className={currentPage === 'schedule' ? 'active' : ''}
          onClick={() => handleNavClick('schedule')}
        >
          Schedule
        </button>
        <button 
          className={currentPage === 'my-bookings' ? 'active' : ''}
          onClick={() => handleNavClick('my-bookings')}
        >
          My Bookings
        </button>
        <button 
          className={currentPage === 'profile' ? 'active' : ''}
          onClick={() => handleNavClick('profile')}
        >
          Profile
        </button>
        {isAdmin() && (
          <>
            <button 
              className={`${currentPage === 'admin' ? 'active' : ''} ${pendingApprovalCount > 0 ? 'has-notifications' : ''}`}
              onClick={() => handleNavClick('admin')}
            >
              Admin
              {pendingApprovalCount > 0 && (
                <span className="nav-notification-dot"></span>
              )}
            </button>
            <button 
              className={currentPage === 'admin-schedule' ? 'active' : ''}
              onClick={() => handleNavClick('admin-schedule')}
            >
              Admin Schedule
            </button>
            <button 
              className={currentPage === 'helicopters' ? 'active' : ''}
              onClick={() => handleNavClick('helicopters')}
            >
              Helicopters
            </button>
            <button 
              className={currentPage === 'bookings' ? 'active' : ''}
              onClick={() => handleNavClick('bookings')}
            >
              Bookings
            </button>
            <button 
              className={currentPage === 'maintenance' ? 'active' : ''}
              onClick={() => handleNavClick('maintenance')}
            >
              Maintenance
            </button>
            <button 
              className={currentPage === 'cfis' ? 'active' : ''}
              onClick={() => handleNavClick('cfis')}
            >
              CFIs
            </button>
            <button 
              className={currentPage === 'users' ? 'active' : ''}
              onClick={() => handleNavClick('users')}
            >
              Users
            </button>
          </>
        )}
        
        {/* Mobile-only user section inside nav */}
        <div className="mobile-user-section">
          <span className="user-name">
            {currentUser?.name}
            {isAdmin() && <span className="admin-badge">Admin</span>}
          </span>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
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
