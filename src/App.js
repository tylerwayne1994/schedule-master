import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ScheduleProvider } from './contexts/ScheduleContext';
import { useSchedule } from './contexts/ScheduleContext';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingOverlay } from './components/LoadingSpinner';
import OfflineBanner from './components/OfflineBanner';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Header from './components/Layout/Header';
import ScheduleGrid from './components/Schedule/ScheduleGrid';
import MyBookings from './components/MyBookings/MyBookings';
import Profile from './components/Profile/Profile';
import { AdminDashboard, HelicopterManagement, UserManagement, InstructorManagement, BookingListManagement, MaintenanceManagement, AdminScheduleManagement } from './components/Admin/AdminPanel';
import CompleteFlightModal from './components/Notifications/CompleteFlightModal';
import UserNotificationModal from './components/Notifications/UserNotificationModal';
import MessageCenter from './components/Notifications/MessageCenter';
import AdminApprovalModal from './components/Notifications/AdminApprovalModal';
import './App.css';
import './styles/responsive.css';
import './styles/accessibility.css';

function AppContent() {
  const { currentUser, loading, isAdmin } = useAuth();
  const { bookings, approveFlightHours } = useSchedule();
  const [authMode, setAuthMode] = useState('login');
  const [currentPage, setCurrentPage] = useState('schedule');
  const [forceShowBookingId, setForceShowBookingId] = useState(null);
  const [userNotifications, setUserNotifications] = useState([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const [showAdminApprovalModal, setShowAdminApprovalModal] = useState(false);
  const [adminApprovalDismissed, setAdminApprovalDismissed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track which notification IDs have already been shown/dismissed (survives reload)
  const [shownNotificationIds, setShownNotificationIds] = useState(() => {
    try {
      const stored = localStorage.getItem('nlh_shown_notification_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nlh_shown_notification_ids', JSON.stringify(shownNotificationIds.slice(-100)));
    } catch { /* ignored */ }
  }, [shownNotificationIds]);

  // Persist dismissed booking IDs in localStorage so they survive page refresh
  const [dismissedBookingIds, setDismissedBookingIds] = useState(() => {
    try {
      const stored = localStorage.getItem('nlh_dismissed_flight_prompts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save dismissed IDs to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('nlh_dismissed_flight_prompts', JSON.stringify(dismissedBookingIds));
    } catch {
      // localStorage might be full or unavailable
    }
  }, [dismissedBookingIds]);

  const dismissBookingPrompt = useCallback((bookingId) => {
    setDismissedBookingIds(prev => {
      if (prev.includes(bookingId)) return prev;
      // Keep only last 50 to prevent localStorage from growing too large
      const updated = [...prev, bookingId].slice(-50);
      return updated;
    });
    setForceShowBookingId(null);
  }, []);

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

    // If user explicitly requested to show a specific booking
    if (forceShowBookingId) {
      const forcedBooking = (bookings || []).find(b => 
        b.id === forceShowBookingId && 
        b.userId === userId &&
        (b.actualHours == null) &&
        (b.actualHoursStatus || 'not_submitted') === 'not_submitted'
      );
      if (forcedBooking) return forcedBooking;
    }

    return (bookings || [])
      .filter(b => b.userId === userId)
      .filter(b => (b.status || 'confirmed') === 'confirmed')
      .filter(b => (b.actualHours == null))
      .filter(b => (b.actualHoursStatus || 'not_submitted') === 'not_submitted')
      .filter(b => !dismissedBookingIds.includes(b.id))
      .filter(isPastEndPlusOneMinute)
      .sort((a, b) => {
        const aEnd = new Date(`${(a.endDate || a.date)}T00:00:00`).getTime();
        const bEnd = new Date(`${(b.endDate || b.date)}T00:00:00`).getTime();
        return aEnd - bEnd;
      })[0];
  }, [bookings, userId, dismissedBookingIds, forceShowBookingId]);

  React.useEffect(() => {
    const loadUserNotifications = async () => {
      if (!currentUser?.id || !isSupabaseConfigured()) {
        setUserNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', currentUser.id)
        .is('read_at', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Failed to load notifications:', error);
      }

      if (!error && data) {
        // Filter out notifications already shown/dismissed in previous sessions
        const unseen = data.filter(n => !shownNotificationIds.includes(n.id));
        setUserNotifications(unseen);
      }
    };

    loadUserNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const activeUserNotification = userNotifications[0] || null;

  // Get pending flight hour approvals for admin
  const pendingApprovals = useMemo(() => {
    if (!isAdmin()) return [];
    return (bookings || []).filter(b => 
      b.actualHoursStatus === 'pending' && 
      b.actualHours != null
    );
  }, [bookings, isAdmin]);

  // Load unread notification count
  const loadUnreadCount = useCallback(async () => {
    if (!currentUser?.id || !isSupabaseConfigured()) {
      setUnreadCount(0);
      return;
    }

    try {
      let query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);

      if (isAdmin()) {
        // Admins see both their own messages and admin broadcast messages
        query = query.or(`recipient_user_id.is.null,recipient_user_id.eq.${currentUser.id}`);
      } else {
        // Regular users only see their own messages
        query = query.eq('recipient_user_id', currentUser.id);
      }

      const { count, error } = await query;

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  }, [currentUser?.id, isAdmin]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Show admin approval popup on login if there are NEW pending approvals
  useEffect(() => {
    if (isAdmin() && pendingApprovals.length > 0 && !adminApprovalDismissed) {
      // Check if these are new approvals the admin hasn't seen yet
      const approvalIds = pendingApprovals.map(b => b.id).sort().join(',');
      const lastSeenApprovals = localStorage.getItem('nlh_admin_seen_approvals');
      if (approvalIds !== lastSeenApprovals) {
        setShowAdminApprovalModal(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pendingApprovals.length, adminApprovalDismissed]);

  const handleApproveFlightHours = async (bookingId) => {
    const result = await approveFlightHours(bookingId);
    if (result?.success) {
      // Refresh unread count after approval
      await loadUnreadCount();
    }
    return result;
  };

  const handleCloseAdminApprovalModal = () => {
    setShowAdminApprovalModal(false);
    setAdminApprovalDismissed(true);
    // Remember which approvals the admin has already seen
    const approvalIds = pendingApprovals.map(b => b.id).sort().join(',');
    localStorage.setItem('nlh_admin_seen_approvals', approvalIds);
  };

  const handleOpenMessageCenter = () => {
    setShowAdminApprovalModal(false);
    setMessageCenterOpen(true);
  };

  const handleOpenFlightReview = useCallback((bookingId) => {
    // Remove from dismissed list and force show this booking
    setDismissedBookingIds(prev => prev.filter(id => id !== bookingId));
    setForceShowBookingId(bookingId);
  }, []);

  const markUserNotificationRead = async (notificationId) => {
    // Optimistically remove from local state first
    setUserNotifications(prev => prev.filter(item => item.id !== notificationId));
    // Track as shown so it never pops up again even if DB update fails
    setShownNotificationIds(prev => prev.includes(notificationId) ? prev : [...prev, notificationId]);
    
    if (!notificationId || !isSupabaseConfigured()) {
      return;
    }

    setNotificationBusy(true);
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    setNotificationBusy(false);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      // Don't re-add to state - user already dismissed it visually
      // The notification will stay in DB but won't bother user this session
    }
  };

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
        return <MyBookings onOpenFlightReview={handleOpenFlightReview} />;
      case 'profile':
        return <Profile />;
      case 'admin':
        return <AdminDashboard />;
      case 'admin-schedule':
        return <AdminScheduleManagement />;
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
      <Header 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        unreadCount={unreadCount}
        onOpenMessages={() => setMessageCenterOpen(true)}
        pendingApprovalCount={pendingApprovals.length}
      />
      <main id="main-content" className="app-content" role="main" aria-label="Main content">
        {renderPage()}
      </main>

      {pendingCompletion && (
        <CompleteFlightModal
          booking={pendingCompletion}
          onClose={() => dismissBookingPrompt(pendingCompletion.id)}
        />
      )}

      {activeUserNotification && (
        <UserNotificationModal
          notification={activeUserNotification}
          busy={notificationBusy}
          onMarkRead={markUserNotificationRead}
          onClose={() => markUserNotificationRead(activeUserNotification.id)}
        />
      )}

      {/* Message Center Drawer */}
      <MessageCenter
        isOpen={messageCenterOpen}
        onClose={() => {
          setMessageCenterOpen(false);
          loadUnreadCount();
        }}
        onApproveHours={handleApproveFlightHours}
      />

      {/* Admin Approval Popup on Login */}
      {showAdminApprovalModal && pendingApprovals.length > 0 && (
        <AdminApprovalModal
          pendingApprovals={pendingApprovals}
          onClose={handleCloseAdminApprovalModal}
          onApprove={handleApproveFlightHours}
          onViewAll={handleOpenMessageCenter}
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
