import React, { useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ScheduleProvider } from './contexts/ScheduleContext';
import { useSchedule } from './contexts/ScheduleContext';
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
import CompleteFlightModal from './components/Notifications/CompleteFlightModal';
import './App.css';
import './styles/responsive.css';
import './styles/accessibility.css';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const { bookings } = useSchedule();
  const [authMode, setAuthMode] = useState('login');
  const [currentPage, setCurrentPage] = useState('schedule');
  const [dismissedBookingId, setDismissedBookingId] = useState(null);

  const userId = currentUser?.id;

  const pendingCompletion = useMemo(() => {
    if (!userId) return null;

    const now = new Date();
    const isPastEndPlusOneMinute = (b) => {
      const endDateStr = b.endDate || b.date;
      const end = new Date(`${endDateStr}T00:00:00`);
      const hours = typeof b.endTime === 'number' ? b.endTime : parseFloat(b.endTime);
      const hourInt = Math.floor(hours);
      const minutes = hours % 1 === 0.5 ? 30 : 0;
      end.setHours(hourInt, minutes, 0, 0);
      end.setMinutes(end.getMinutes() + 1);
      return end <= now;
    };

    return (bookings || [])
      .filter(b => b.userId === userId)
      .filter(b => (b.status || 'confirmed') === 'confirmed')
      .filter(b => (b.actualHours == null))
      .filter(b => b.id !== dismissedBookingId)
      .filter(isPastEndPlusOneMinute)
      .sort((a, b) => {
        const aEnd = new Date(`${(a.endDate || a.date)}T00:00:00`).getTime();
        const bEnd = new Date(`${(b.endDate || b.date)}T00:00:00`).getTime();
        return aEnd - bEnd;
      })[0];
  }, [bookings, userId, dismissedBookingId]);

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

      {pendingCompletion && (
        <CompleteFlightModal
          booking={pendingCompletion}
          onClose={() => setDismissedBookingId(pendingCompletion.id)}
        />
      )}
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
