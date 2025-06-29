/**
 * AuraSAFE - Production-Ready Urban Safety Application
 * FIXED: Removed duplicate authentication buttons for cleaner UI
 */

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { 
  Shield, 
  MapPin, 
  Activity, 
  AlertTriangle, 
  Menu, 
  X,
  Github,
  ExternalLink,
  User,
  LogIn,
  Settings,
  Globe,
  Zap
} from 'lucide-react';
import MapComponent from './components/MapComponent';
import AuthModal from './components/AuthModal';
import UserProfile from './components/UserProfile';
import { useAuth } from './hooks/useAuth';
import { checkHealth, isBackendAvailable } from './api/apiClient';

interface SystemStatus {
  status: string;
  database: string;
  model_loaded: boolean;
  services: {
    routing: string;
    prediction: string;
    incident_reporting: string;
  };
}

const App: React.FC = () => {
  const { user, loading: authLoading, initialized } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Check system health on startup
  useEffect(() => {
    if (!initialized) return;

    const checkSystemHealth = async () => {
      try {
        const available = await isBackendAvailable();
        setBackendAvailable(available);
        
        if (available) {
          const health = await checkHealth();
          setSystemStatus(health);
        }
      } catch (error) {
        console.log('ℹ️ Backend check failed, continuing in demo mode');
        setBackendAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSystemHealth();
    
    // Check health every 5 minutes (reduced frequency)
    const interval = setInterval(async () => {
      try {
        const available = await isBackendAvailable();
        if (available !== backendAvailable) {
          setBackendAvailable(available);
          if (available) {
            const health = await checkHealth();
            setSystemStatus(health);
          }
        }
      } catch (error) {
        // Silently handle errors during periodic checks
      }
    }, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [initialized, backendAvailable]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'available':
        return 'text-green-500';
      case 'limited':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'available':
        return '🟢';
      case 'limited':
        return '🟡';
      default:
        return '🔴';
    }
  };

  const handleAuthClick = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-400 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-3">Initializing AuraSAFE</h2>
          <p className="text-gray-300">Loading predictive safety systems...</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Globe size={16} />
            <span>Connecting to safety network</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Enhanced Toast Notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
            borderRadius: '12px',
            maxWidth: '400px',
            fontSize: '14px',
            fontWeight: '500'
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 3000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
        containerStyle={{
          top: 80,
        }}
      />

      {/* FIXED Header - Single Authentication Flow */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4 relative z-20 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {showSidebar ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Shield className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  <span className="text-blue-400">Aura</span>
                  <span className="text-white">SAFE</span>
                </h1>
                <p className="text-xs text-gray-400">Predictive Urban Safety Engine</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-900 to-purple-900 rounded-full text-xs border border-blue-700">
              <Zap size={12} className="text-blue-400" />
              <span className="text-blue-200 font-medium">
                {!backendAvailable ? 'Smart Demo' : 'Live Production'}
              </span>
            </div>
          </div>

          {/* FIXED: Single Authentication Section */}
          <div className="flex items-center gap-4">
            {/* System Status */}
            {backendAvailable && systemStatus && (
              <div className="hidden lg:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full">
                  <span>{getStatusIcon(systemStatus.status)}</span>
                  <span className={getStatusColor(systemStatus.status)}>
                    {systemStatus.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full">
                  <Activity size={14} />
                  <span className={getStatusColor(systemStatus.services.prediction)}>
                    ML: {systemStatus.model_loaded ? 'Active' : 'Demo'}
                  </span>
                </div>
              </div>
            )}

            {/* FIXED: Single Authentication Flow */}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-200">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-400">Safety Member</p>
                </div>
                <button
                  onClick={() => setShowUserProfile(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg"
                >
                  <User size={16} />
                  <span className="hidden md:block font-medium">Profile</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAuthClick('signin')}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg transition-colors border border-blue-600 hover:bg-blue-900"
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => handleAuthClick('signup')}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg"
                >
                  <User size={16} />
                  <span>Sign Up</span>
                </button>
              </div>
            )}
            
            <div className="text-xs text-gray-400 font-mono">
              v2.0.0
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Enhanced Sidebar */}
        <aside className={`
          bg-gray-800 border-r border-gray-700 transition-all duration-300 relative z-10 shadow-xl
          ${showSidebar ? 'w-80' : 'w-0 overflow-hidden'}
        `}>
          <div className="p-6 h-full overflow-y-auto">
            {/* User Status */}
            {user ? (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-900 to-emerald-900 border border-green-700 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <User size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-green-400">Authenticated User</h3>
                    <p className="text-xs text-green-300">Premium Safety Features Active</p>
                  </div>
                </div>
                <p className="text-sm text-green-200 mb-2">
                  Welcome back! Your personalized safety preferences are active.
                </p>
                <p className="text-xs text-green-300 font-mono">
                  {user.email}
                </p>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-700 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <LogIn size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-400">Guest Mode</h3>
                    <p className="text-xs text-blue-300">Limited Features</p>
                  </div>
                </div>
                <p className="text-sm text-blue-200 mb-3">
                  Sign up for personalized safety features, route history, and incident reporting.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAuthClick('signin')}
                    className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-xs hover:bg-blue-700 transition-colors font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="flex-1 bg-gradient-to-r from-blue-700 to-purple-700 text-white py-2 px-3 rounded-lg text-xs hover:from-blue-800 hover:to-purple-800 transition-all font-medium"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}

            {/* Project Overview */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-blue-400" />
                About AuraSAFE
              </h2>
              <div className="text-sm text-gray-300 space-y-3">
                <p className="leading-relaxed">
                  AuraSAFE is a production-ready predictive urban safety system that combines 
                  machine learning with real-time data for intelligent route planning 
                  and threat assessment.
                </p>
                <div className="bg-gray-700 p-4 rounded-xl border border-gray-600">
                  <h4 className="font-bold text-blue-400 mb-3">Core Technologies:</h4>
                  <ul className="text-xs space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      Spatio-Temporal Graph Convolutional Networks (STGCN)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      Safety-Aware A* Routing Algorithm
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                      Real-time Urban Threat Index (UTI)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                      Crowdsourced Incident Reporting
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                      Supabase Authentication & Real-time DB
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* System Status Details */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity size={18} className={backendAvailable ? "text-green-400" : "text-blue-400"} />
                System Status
              </h3>
              
              {backendAvailable && systemStatus ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Database</span>
                    <span className={`font-bold ${getStatusColor(systemStatus.database)}`}>
                      {systemStatus.database}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">ML Model</span>
                    <span className={`font-bold ${systemStatus.model_loaded ? 'text-green-500' : 'text-yellow-500'}`}>
                      {systemStatus.model_loaded ? 'Production' : 'Demo Mode'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Authentication</span>
                    <span className="text-green-500 font-bold">Supabase Live</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Real-time</span>
                    <span className="text-green-500 font-bold">Active</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg border border-blue-700">
                    <span className="font-medium">Demo Mode</span>
                    <span className="text-blue-400 font-bold">Active</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Authentication</span>
                    <span className="text-green-400 font-bold">Supabase Live</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Map Display</span>
                    <span className="text-green-400 font-bold">OpenStreetMap</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                    <span className="font-medium">Smart Data</span>
                    <span className="text-green-400 font-bold">Available</span>
                  </div>
                </div>
              )}
            </div>

            {/* Production Features */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-purple-400" />
                Production Features
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-4 bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl border border-blue-600">
                  <h4 className="font-bold text-blue-300 mb-2 flex items-center gap-2">
                    🛣️ Smart Routing
                  </h4>
                  <p className="text-blue-100 text-xs leading-relaxed">
                    AI-powered route optimization with real-time safety assessment and water avoidance
                  </p>
                  <p className="text-xs text-green-400 mt-2 font-medium">
                    ✅ Production Ready
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-red-900 to-red-800 rounded-xl border border-red-600">
                  <h4 className="font-bold text-red-300 mb-2 flex items-center gap-2">
                    🎯 Threat Prediction
                  </h4>
                  <p className="text-red-100 text-xs leading-relaxed">
                    Machine learning crime prediction with stable visualization and consistent results
                  </p>
                  <p className="text-xs text-green-400 mt-2 font-medium">
                    ✅ {backendAvailable ? 'Live ML Models' : 'Smart Demo'}
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-orange-900 to-orange-800 rounded-xl border border-orange-600">
                  <h4 className="font-bold text-orange-300 mb-2 flex items-center gap-2">
                    👥 User Accounts
                  </h4>
                  <p className="text-orange-100 text-xs leading-relaxed">
                    Secure authentication with personalized safety preferences and route history
                  </p>
                  <p className="text-xs text-green-400 mt-2 font-medium">
                    ✅ Supabase Authentication
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-green-900 to-green-800 rounded-xl border border-green-600">
                  <h4 className="font-bold text-green-300 mb-2 flex items-center gap-2">
                    📊 Real-time Data
                  </h4>
                  <p className="text-green-100 text-xs leading-relaxed">
                    Live incident reporting with community verification and stable threat zones
                  </p>
                  <p className="text-xs text-green-400 mt-2 font-medium">
                    ✅ Real-time Database
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Instructions */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-yellow-400" />
                Quick Start Guide
              </h3>
              <div className="text-sm text-gray-300 space-y-3">
                <div className="p-3 bg-gray-700 rounded-lg border-l-4 border-blue-500">
                  <strong className="text-blue-400">1. Create Account:</strong>
                  <p className="text-xs mt-1">Sign up for personalized safety features and route history</p>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg border-l-4 border-green-500">
                  <strong className="text-green-400">2. Set Preferences:</strong>
                  <p className="text-xs mt-1">Configure your safety priorities and emergency contacts</p>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg border-l-4 border-purple-500">
                  <strong className="text-purple-400">3. Plan Routes:</strong>
                  <p className="text-xs mt-1">Click map to set start/end points for intelligent routing</p>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg border-l-4 border-orange-500">
                  <strong className="text-orange-400">4. Report Incidents:</strong>
                  <p className="text-xs mt-1">Help improve community safety with verified reports</p>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="border-t border-gray-600 pt-6">
              <div className="flex flex-col gap-3">
                <a
                  href="https://github.com/yourusername/aurasafe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Github size={16} />
                  GitHub Repository
                </a>
                <a
                  href="/docs"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink size={16} />
                  API Documentation
                </a>
                <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-700 rounded-lg">
                  <p className="font-medium">Production Deployment Ready</p>
                  <p>Real authentication • Smart routing • Threat analysis</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content - Map */}
        <main className="flex-1 relative">
          <MapComponent 
            className="w-full h-full" 
            backendAvailable={backendAvailable}
            user={user}
          />
        </main>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />

      <UserProfile
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
      />

      {/* Enhanced Footer */}
      <div className="absolute bottom-0 right-0 p-3 text-xs text-gray-400 bg-black bg-opacity-75 rounded-tl-xl backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-blue-400" />
          <span>© 2024 AuraSAFE - Production Urban Safety Engine</span>
          {!backendAvailable && <span className="text-blue-400">(Smart Demo)</span>}
        </div>
      </div>
    </div>
  );
};

export default App;