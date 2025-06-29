/**
 * User Profile Component
 * Displays and manages user profile information
 */

import React, { useState, useEffect } from 'react';
import { User, Settings, Shield, MapPin, Bell, LogOut, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SafetyPreferences {
  safetyWeight: number;
  avoidAreas: string[];
  timeOfDayFactor: boolean;
  emergencyContacts: string[];
  notificationSettings: {
    incidents: boolean;
    routes: boolean;
    emergencies: boolean;
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { user, signOut, updateProfile, getUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    avatar_url: user?.user_metadata?.avatar_url || ''
  });

  const [safetyPrefs, setSafetyPrefs] = useState<SafetyPreferences>({
    safetyWeight: 0.7,
    avoidAreas: [],
    timeOfDayFactor: true,
    emergencyContacts: [],
    notificationSettings: {
      incidents: true,
      routes: true,
      emergencies: true
    }
  });

  // Load user profile on mount
  useEffect(() => {
    if (user && isOpen) {
      loadUserProfile();
    }
  }, [user, isOpen]);

  const loadUserProfile = async () => {
    try {
      const profileData = await getUserProfile();
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          email: profileData.email || '',
          avatar_url: profileData.avatar_url || ''
        });
        
        if (profileData.safety_preferences) {
          setSafetyPrefs(profileData.safety_preferences);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await updateProfile({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        safety_preferences: safetyPrefs
      });

      if (!error) {
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const addEmergencyContact = () => {
    setSafetyPrefs(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, '']
    }));
  };

  const updateEmergencyContact = (index: number, value: string) => {
    setSafetyPrefs(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((contact, i) => 
        i === index ? value : contact
      )
    }));
  };

  const removeEmergencyContact = (index: number) => {
    setSafetyPrefs(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Profile" 
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <User className="text-blue-600" size={24} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {profile.full_name || 'User Profile'}
              </h2>
              <p className="text-sm text-gray-600">{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1"
                >
                  <Save size={16} />
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-300 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-400 flex items-center gap-1"
                >
                  <X size={16} />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Edit2 size={16} />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
            </div>
          </div>

          {/* Safety Preferences */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield size={20} className="text-green-600" />
              Safety Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Safety Priority: {Math.round(safetyPrefs.safetyWeight * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={safetyPrefs.safetyWeight}
                  onChange={(e) => setSafetyPrefs(prev => ({ 
                    ...prev, 
                    safetyWeight: parseFloat(e.target.value) 
                  }))}
                  disabled={!isEditing}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Speed Priority</span>
                  <span>Safety Priority</span>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="timeOfDay"
                  checked={safetyPrefs.timeOfDayFactor}
                  onChange={(e) => setSafetyPrefs(prev => ({ 
                    ...prev, 
                    timeOfDayFactor: e.target.checked 
                  }))}
                  disabled={!isEditing}
                  className="mr-2"
                />
                <label htmlFor="timeOfDay" className="text-sm text-gray-700">
                  Consider time of day in safety calculations
                </label>
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-red-600" />
              Emergency Contacts
            </h3>
            <div className="space-y-2">
              {safetyPrefs.emergencyContacts.map((contact, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={contact}
                    onChange={(e) => updateEmergencyContact(index, e.target.value)}
                    disabled={!isEditing}
                    placeholder="Phone number"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                  {isEditing && (
                    <button
                      onClick={() => removeEmergencyContact(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
              {isEditing && (
                <button
                  onClick={addEmergencyContact}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Emergency Contact
                </button>
              )}
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell size={20} className="text-purple-600" />
              Notification Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Incident Alerts</span>
                <input
                  type="checkbox"
                  checked={safetyPrefs.notificationSettings.incidents}
                  onChange={(e) => setSafetyPrefs(prev => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      incidents: e.target.checked
                    }
                  }))}
                  disabled={!isEditing}
                  className="toggle"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Route Updates</span>
                <input
                  type="checkbox"
                  checked={safetyPrefs.notificationSettings.routes}
                  onChange={(e) => setSafetyPrefs(prev => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      routes: e.target.checked
                    }
                  }))}
                  disabled={!isEditing}
                  className="toggle"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Emergency Notifications</span>
                <input
                  type="checkbox"
                  checked={safetyPrefs.notificationSettings.emergencies}
                  onChange={(e) => setSafetyPrefs(prev => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      emergencies: e.target.checked
                    }
                  }))}
                  disabled={!isEditing}
                  className="toggle"
                />
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="border-t pt-6">
            <button
              onClick={handleSignOut}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;