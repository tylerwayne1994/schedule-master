import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext();

// Default admin account (for demo mode)
const DEFAULT_ADMIN = {
  id: 'admin-001',
  email: 'admin@nextlevelhelicopters.com',
  password: 'admin123',
  name: 'Admin',
  role: 'admin',
  createdAt: new Date().toISOString()
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  const loadAllProfiles = async () => {
    if (!isSupabaseConfigured()) return;

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && profiles) {
      setUsers(
        profiles.map(profile => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          role: profile.role,
          createdAt: profile.created_at
        }))
      );
    }
  };

  // Initialize auth based on mode (Supabase or demo)
  useEffect(() => {
    if (isSupabaseConfigured()) {
      // Supabase mode
      initSupabaseAuth();
    } else {
      // Demo mode with localStorage
      initDemoAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initSupabaseAuth = async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    
    if (session?.user) {
      await loadUserProfile(session.user.id);
      await loadAllProfiles();
    }
    setLoading(false);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        await loadUserProfile(session.user.id);
        await loadAllProfiles();
      } else {
        setCurrentUser(null);
        setUsers([]);
      }
    });

    return () => subscription.unsubscribe();
  };

  const loadUserProfile = async (userId) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile && !error) {
      setCurrentUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        role: profile.role,
        createdAt: profile.created_at
      });
    }
  };

  const initDemoAuth = () => {
    const storedUsers = localStorage.getItem('nlh_users');
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      const initialUsers = [DEFAULT_ADMIN];
      setUsers(initialUsers);
      localStorage.setItem('nlh_users', JSON.stringify(initialUsers));
    }

    const storedSession = localStorage.getItem('nlh_session');
    if (storedSession) {
      setCurrentUser(JSON.parse(storedSession));
    }
    setLoading(false);
  };

  // Save users to localStorage (demo mode)
  useEffect(() => {
    if (!isSupabaseConfigured() && users.length > 0) {
      localStorage.setItem('nlh_users', JSON.stringify(users));
    }
  }, [users]);

  // ============ AUTH METHODS ============

  const loginWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        redirectTo: window.location.origin
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  };

  const login = async (email, password) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } else {
      // Demo mode
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        const userSession = { ...user };
        delete userSession.password;
        setCurrentUser(userSession);
        localStorage.setItem('nlh_session', JSON.stringify(userSession));
        return { success: true };
      }
      return { success: false, error: 'Invalid email or password' };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
    // Clear all state and storage regardless of signOut result
    setCurrentUser(null);
    setSession(null);
    setUsers([]);
    localStorage.removeItem('nlh_session');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    // Clear any supabase keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    window.location.replace(window.location.origin);
  };

  const register = async (email, password, name) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } else {
      // Demo mode
      if (users.some(u => u.email === email)) {
        return { success: false, error: 'Email already registered' };
      }

      const newUser = {
        id: uuidv4(),
        email,
        password,
        name,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      setUsers(prev => [...prev, newUser]);
      
      const userSession = { ...newUser };
      delete userSession.password;
      setCurrentUser(userSession);
      localStorage.setItem('nlh_session', JSON.stringify(userSession));

      return { success: true };
    }
  };

  const updateUser = async (userId, updates) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          email: updates.email,
          phone: updates.phone,
          address: updates.address
        })
        .eq('id', userId)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }
      if (!data || data.length === 0) {
        return { success: false, error: 'Update failed - profile not found or permission denied' };
      }
      
      if (currentUser?.id === userId) {
        setCurrentUser(prev => ({ ...prev, ...updates }));
      }
      await loadAllProfiles();
      return { success: true };
    } else {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, ...updates } : u
      ));
      
      if (currentUser?.id === userId) {
        const updatedSession = { ...currentUser, ...updates };
        delete updatedSession.password;
        setCurrentUser(updatedSession);
        localStorage.setItem('nlh_session', JSON.stringify(updatedSession));
      }
      return { success: true };
    }
  };

  const deleteUser = async (userId) => {
    if (userId === 'admin-001') {
      return { success: false, error: 'Cannot delete default admin' };
    }
    
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.rpc('delete_user_account', { p_user_id: userId });
        if (error) throw error;
        setUsers(prev => prev.filter(u => u.id !== userId));
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
      return { success: true };
    }
  };

  const getAllUsers = () => {
    if (users.length === 0 && currentUser) {
      return [currentUser];
    }

    return users.map(u => {
      const userCopy = { ...u };
      delete userCopy.password;
      return userCopy;
    });
  };

  const isAdmin = () => currentUser?.role === 'admin';
  
  const hasGoogleCalendarAccess = () => {
    return session?.provider_token != null;
  };

  const getGoogleAccessToken = () => {
    return session?.provider_token;
  };

  const elevateToAdmin = async () => {
    if (currentUser) {
      // Update in localStorage for demo mode
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...currentUser, role: 'admin' };
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        localStorage.setItem('nlh_session', JSON.stringify(updatedUser));
        setUsers(prev => prev.map(u => 
          u.id === currentUser.id ? { ...u, role: 'admin' } : u
        ));
      } else {
        // Update role in Supabase FIRST, then update local state
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', currentUser.id);

        if (error) {
          console.error('Failed to update admin role:', error);
          return { success: false, error: error.message };
        }

        // Now update local state after successful DB update
        setCurrentUser(prev => ({ ...prev, role: 'admin' }));
        await loadAllProfiles();
      }
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  };

  const value = {
    currentUser,
    users: getAllUsers(),
    session,
    login,
    loginWithGoogle,
    logout,
    register,
    updateUser,
    deleteUser,
    isAdmin,
    elevateToAdmin,
    loading,
    isSupabaseMode: isSupabaseConfigured(),
    hasGoogleCalendarAccess,
    getGoogleAccessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
