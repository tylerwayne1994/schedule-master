import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedule } from '../../contexts/ScheduleContext';
import './Profile.css';

const ADMIN_PIN = '4001';

function Profile() {
  const { currentUser, updateUser, elevateToAdmin } = useAuth();
  const { getUserBookings } = useSchedule();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    address: currentUser?.address || ''
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    setFormData({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      address: currentUser?.address || ''
    });
  }, [currentUser]);

  const myBookings = getUserBookings(currentUser?.id) || [];
  const completedFlights = myBookings.filter(b => b.status === 'completed').length;
  const totalHours = myBookings
    .filter(b => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => {
      const hours = Number.isFinite(b.actualHours)
        ? b.actualHours
        : ((b.endTime - b.startTime) || 0);
      return sum + hours;
    }, 0);
  // Intentionally do not compute/track total spend

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaveError('');
    const result = await updateUser(currentUser.id, formData);
    if (!result?.success) {
      setSaveError(result?.error || 'Unable to save profile changes');
      return;
    }
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      const result = await elevateToAdmin();
      if (result?.success === false) {
        setPinError(result.error || 'Failed to update role. Check Supabase RLS policies.');
        setPin('');
        return;
      }
      setShowPinModal(false);
      setPin('');
      setPinError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setPinError('Incorrect PIN');
      setPin('');
    }
  };

  const handlePinKeyDown = async (e) => {
    if (e.key === 'Enter') {
      await handlePinSubmit(e);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="profile-title">
            <h1>{currentUser?.name}</h1>
            <span className="profile-role">{currentUser?.role === 'admin' ? 'Administrator' : 'Pilot'}</span>
          </div>
          {currentUser?.role !== 'admin' && (
            <button className="btn-admin-gate" onClick={() => setShowPinModal(true)}>
              Admin
            </button>
          )}
        </div>

        {saved && <div className="save-success">Profile updated successfully!</div>}
        {saveError && <div className="save-error">{saveError}</div>}

        {/* Admin PIN Modal */}
        {showPinModal && (
          <div className="pin-modal-overlay" onClick={() => setShowPinModal(false)}>
            <div className="pin-modal" onClick={e => e.stopPropagation()}>
              <h3>Enter Admin PIN</h3>
              <form onSubmit={handlePinSubmit}>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={handlePinKeyDown}
                  placeholder="Enter PIN"
                  maxLength={4}
                  autoFocus
                />
                {pinError && <div className="pin-error">{pinError}</div>}
                <div className="pin-actions">
                  <button type="submit" className="btn-pin-submit">Enter</button>
                  <button type="button" className="btn-pin-cancel" onClick={() => {
                    setShowPinModal(false);
                    setPin('');
                    setPinError('');
                  }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="profile-stats">
          <div className="stat-box">
            <div className="stat-number">{completedFlights}</div>
            <div className="stat-label">Total Flights</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{totalHours.toFixed(1)}</div>
            <div className="stat-label">Flight Hours</div>
          </div>
        </div>

        <div className="profile-section">
          <div className="section-header">
            <h2>Personal Information</h2>
            {!isEditing && (
              <button className="btn-edit" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            )}
          </div>

          <div className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="field-value">{currentUser?.name}</div>
                )}
              </div>
              <div className="form-group">
                <label>Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                ) : (
                  <div className="field-value">{currentUser?.email}</div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                  />
                ) : (
                  <div className="field-value">{currentUser?.phone || 'Not provided'}</div>
                )}
              </div>
              <div className="form-group">
                <label>Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter address"
                  />
                ) : (
                  <div className="field-value">{currentUser?.address || 'Not provided'}</div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="form-actions">
                <button type="button" className="btn-save" onClick={handleSave}>Save Changes</button>
                <button type="button" className="btn-cancel" onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-section">
          <h2>Account Details</h2>
          <div className="account-details">
            <div className="detail-row">
              <span className="detail-label">Member Since</span>
              <span className="detail-value">
                {new Date(currentUser?.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Type</span>
              <span className="detail-value">{currentUser?.role === 'admin' ? 'Administrator' : 'Standard User'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">User ID</span>
              <span className="detail-value id">{currentUser?.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
