import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';
import './Layout.css';

function Header({ currentPage, onNavigate }) {
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
