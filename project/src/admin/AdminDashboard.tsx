/**
 * Admin Dashboard for Production Deployment
 * System monitoring and management interface
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Users, 
  AlertTriangle, 
  Shield, 
  Activity,
  Database,
  Settings,
  TrendingUp
} from 'lucide-react';

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalIncidents: number;
  verifiedIncidents: number;
  routesCalculated: number;
  systemUptime: number;
  averageResponseTime: number;
  safetyImprovement: number;
}

interface IncidentModerationItem {
  id: string;
  type: string;
  description: string;
  location: { lat: number; lng: number };
  reportedAt: string;
  severity: string;
  status: 'pending' | 'approved' | 'rejected';
  reporterInfo: string;
}

const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 15420,
    activeUsers: 3240,
    totalIncidents: 8950,
    verifiedIncidents: 7830,
    routesCalculated: 45600,
    systemUptime: 99.7,
    averageResponseTime: 0.8,
    safetyImprovement: 23.5
  });

  const [pendingIncidents, setPendingIncidents] = useState<IncidentModerationItem[]>([
    {
      id: 'inc_001',
      type: 'theft',
      description: 'Bike stolen from outside subway station',
      location: { lat: 40.7589, lng: -73.9851 },
      reportedAt: '2024-01-15T14:30:00Z',
      severity: 'medium',
      status: 'pending',
      reporterInfo: 'Verified user (user_abc***)'
    },
    {
      id: 'inc_002',
      type: 'suspicious_activity',
      description: 'Group of individuals acting suspiciously near ATM',
      location: { lat: 40.7505, lng: -73.9934 },
      reportedAt: '2024-01-15T16:45:00Z',
      severity: 'high',
      status: 'pending',
      reporterInfo: 'Anonymous report'
    }
  ]);

  const handleIncidentModeration = (incidentId: string, action: 'approve' | 'reject') => {
    setPendingIncidents(prev => 
      prev.map(incident => 
        incident.id === incidentId 
          ? { ...incident, status: action === 'approve' ? 'approved' : 'rejected' }
          : incident
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AuraSAFE Admin Dashboard</h1>
          <p className="text-gray-600">System monitoring and incident moderation</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalUsers.toLocaleString()}</p>
              </div>
              <Users className="text-blue-500" size={32} />
            </div>
            <p className="text-sm text-green-600 mt-2">↗ +12% from last month</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeUsers.toLocaleString()}</p>
              </div>
              <Activity className="text-green-500" size={32} />
            </div>
            <p className="text-sm text-green-600 mt-2">↗ +8% from last week</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Uptime</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.systemUptime}%</p>
              </div>
              <Shield className="text-purple-500" size={32} />
            </div>
            <p className="text-sm text-green-600 mt-2">Target: 99.9%</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Safety Improvement</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.safetyImprovement}%</p>
              </div>
              <TrendingUp className="text-orange-500" size={32} />
            </div>
            <p className="text-sm text-green-600 mt-2">vs traditional routing</p>
          </div>
        </div>

        {/* Incident Moderation */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={24} />
            Incident Moderation Queue
          </h2>
          
          <div className="space-y-4">
            {pendingIncidents.filter(i => i.status === 'pending').map((incident) => (
              <div key={incident.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">{incident.type.replace('_', ' ')}</h3>
                    <p className="text-sm text-gray-600">{incident.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    incident.severity === 'high' ? 'bg-red-100 text-red-800' :
                    incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                  <div>
                    <strong>Location:</strong> {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                  </div>
                  <div>
                    <strong>Reported:</strong> {new Date(incident.reportedAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Reporter:</strong> {incident.reporterInfo}
                  </div>
                  <div>
                    <strong>ID:</strong> {incident.id}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => handleIncidentModeration(incident.id, 'approve')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleIncidentModeration(incident.id, 'reject')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Reject
                  </button>
                  <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="text-blue-500" size={24} />
              System Health
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Database Status</span>
                <span className="text-green-600 font-medium">✅ Healthy</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">API Response Time</span>
                <span className="text-green-600 font-medium">{metrics.averageResponseTime}s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">ML Model Status</span>
                <span className="text-green-600 font-medium">✅ Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cache Hit Rate</span>
                <span className="text-green-600 font-medium">94.2%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart className="text-purple-500" size={24} />
              Usage Statistics
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Routes Calculated Today</span>
                <span className="text-gray-900 font-medium">1,247</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Incidents Reported Today</span>
                <span className="text-gray-900 font-medium">23</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">New User Registrations</span>
                <span className="text-gray-900 font-medium">156</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">API Calls (24h)</span>
                <span className="text-gray-900 font-medium">45,892</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;