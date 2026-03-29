import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ScheduleProvider } from './contexts/ScheduleContext';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingOverlay } from './components/LoadingSpinner';
import OfflineBanner from './components/OfflineBanner';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Header from './components/Layout/Header';
import ScheduleGrid from './components/Schedule/ScheduleGrid';
import MyBookings from './components/MyBookings/MyBookings';
import Profile from './components/Profile/Profile';
import { AdminDashboard, HelicopterManagement, UserManagement, InstructorManagement, BookingListManagement, MaintenanceManagement } from './components/Admin/AdminPanel';
import './App.css';
import './styles/responsive.css';
import './styles/accessibility.css';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login');
  const [currentPage, setCurrentPage] = useState('schedule');

  if (loading) {
    return <LoadingOverlay text="Loading..." />;
  }

  if (!currentUser) {
    return authMode === 'login' ? (
      <Login onSwitchToRegister={() => setAuthMode('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthMode('login')} />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'schedule':
        return <ScheduleGrid />;
      case 'my-bookings':
        return <MyBookings />;
      case 'profile':
        return <Profile />;
      case 'admin':
        return <AdminDashboard />;
      case 'helicopters':
        return <HelicopterManagement />;
      case 'bookings':
        return <BookingListManagement />;
      case 'maintenance':
        return <MaintenanceManagement />;
      case 'users':
        return <UserManagement />;
      case 'cfis':
        return <InstructorManagement />;
      default:
        return <ScheduleGrid />;
    }
  };

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main id="main-content" className="app-content" role="main" aria-label="Main content">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ScheduleProvider>
          <AppContent />
          <OfflineBanner />
        </ScheduleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
