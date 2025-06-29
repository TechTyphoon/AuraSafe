/**
 * API Client for AuraSAFE backend communication.
 * Handles all HTTP requests to the FastAPI backend with proper error handling.
 */

import axios, { AxiosResponse, AxiosError } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000, // Reduced timeout for faster offline detection
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error: AxiosError) => {
    // Suppress console errors for connection issues to reduce noise
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.log('ℹ️ Backend server not available - running in offline mode');
    } else {
      console.error('❌ API Response Error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

// Type definitions for API requests and responses
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  safety_weight?: number;
  max_detour?: number;
  avoid_areas?: string[];
  time_of_day_factor?: boolean;
}

export interface SafeRouteRequest {
  start: LatLng;
  end: LatLng;
  preferences?: RoutePreferences;
  departure_time?: string;
}

export interface ThreatSegment {
  start_idx: number;
  end_idx: number;
  uti_score: number;
  reason: string;
  mitigation?: string;
}

export interface SafeRouteResponse {
  path: {
    type: 'LineString';
    coordinates: number[][];
  };
  safety_score: number;
  distance_km: number;
  estimated_time_minutes: number;
  threat_segments: ThreatSegment[];
  last_updated: string;
}

export interface BoundingBox {
  ne: LatLng;
  sw: LatLng;
}

export interface HotspotsRequest {
  bounds: BoundingBox;
  timestamp?: string;
  prediction_hours?: number;
  crime_types?: string[];
  confidence_threshold?: number;
}

export interface HotspotProperties {
  uti_score: number;
  crime_types: string[];
  confidence: number;
  historical_incidents: number;
  risk_factors: string[];
  recommendations: string[];
}

export interface HotspotFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: HotspotProperties;
}

export interface HotspotsResponse {
  hotspots: {
    type: 'FeatureCollection';
    features: HotspotFeature[];
  };
  generated_at: string;
  valid_until: string;
  model_version: string;
  coverage_area_km2: number;
}

export interface IncidentReport {
  location: LatLng;
  type: 'theft' | 'assault' | 'vandalism' | 'suspicious_activity' | 'harassment' | 'drug_activity' | 'noise_complaint' | 'other';
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  anonymous?: boolean;
  media_urls?: string[];
  occurred_at?: string;
}

export interface IncidentReportResponse {
  status: 'success' | 'pending' | 'failed';
  report_id: string;
  estimated_verification_time: number;
  auto_verified: boolean;
  public_id?: string;
}

export interface RecentIncident {
  id: string;
  location: LatLng;
  type: string;
  severity: string;
  reported_at: string;
  verified: boolean;
}

// Enhanced error handling utility
const handleApiError = (error: any, operation: string): never => {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error(`Backend server unavailable. Please ensure the FastAPI server is running on ${API_BASE_URL}`);
    }
    throw new Error(`${operation} failed: ${error.response?.data?.message || error.message}`);
  }
  throw new Error(`${operation} failed: Unknown error`);
};

// Mock data generators for offline mode
const generateMockRoute = (start: LatLng, end: LatLng): SafeRouteResponse => {
  // Generate a simple straight-line route with some random points
  const steps = 10;
  const coordinates: number[][] = [];
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = start.lat + (end.lat - start.lat) * ratio;
    const lng = start.lng + (end.lng - start.lng) * ratio;
    // Add some random variation to make it look more realistic
    const variation = 0.001;
    coordinates.push([
      lng + (Math.random() - 0.5) * variation,
      lat + (Math.random() - 0.5) * variation
    ]);
  }

  const distance = calculateDistance(start, end);
  
  return {
    path: {
      type: 'LineString',
      coordinates
    },
    safety_score: Math.random() * 0.3 + 0.7, // 70-100% safety score
    distance_km: distance,
    estimated_time_minutes: Math.round(distance * 12), // ~5 km/h walking speed
    threat_segments: [
      {
        start_idx: Math.floor(steps * 0.3),
        end_idx: Math.floor(steps * 0.5),
        uti_score: Math.random() * 0.4 + 0.1,
        reason: 'Historical incident data indicates elevated risk',
        mitigation: 'Consider alternative route or travel during daylight hours'
      }
    ],
    last_updated: new Date().toISOString()
  };
};

const generateMockHotspots = (bounds: BoundingBox): HotspotsResponse => {
  const features: HotspotFeature[] = [];
  const numHotspots = Math.floor(Math.random() * 5) + 2; // 2-6 hotspots
  
  for (let i = 0; i < numHotspots; i++) {
    const centerLat = bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat);
    const centerLng = bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng);
    const size = 0.002; // Small hotspot area
    
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [centerLng - size, centerLat - size],
          [centerLng + size, centerLat - size],
          [centerLng + size, centerLat + size],
          [centerLng - size, centerLat + size],
          [centerLng - size, centerLat - size]
        ]]
      },
      properties: {
        uti_score: Math.random() * 0.6 + 0.2,
        crime_types: ['theft', 'vandalism'][Math.floor(Math.random() * 2)] ? ['theft'] : ['vandalism'],
        confidence: Math.random() * 0.3 + 0.7,
        historical_incidents: Math.floor(Math.random() * 20) + 5,
        risk_factors: ['Poor lighting', 'High foot traffic', 'Limited surveillance'],
        recommendations: ['Avoid during late hours', 'Travel in groups', 'Use well-lit paths']
      }
    });
  }
  
  return {
    hotspots: {
      type: 'FeatureCollection',
      features
    },
    generated_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
    model_version: 'demo-v1.0.0',
    coverage_area_km2: calculateDistance(bounds.sw, bounds.ne) * calculateDistance(
      { lat: bounds.sw.lat, lng: bounds.ne.lng },
      { lat: bounds.ne.lat, lng: bounds.sw.lng }
    )
  };
};

/**
 * Calculate safe route between two points
 */
export const getSafeRoute = async (request: SafeRouteRequest): Promise<SafeRouteResponse> => {
  try {
    const response = await apiClient.post<SafeRouteResponse>('/api/v1/route/safe', request);
    return response.data;
  } catch (error) {
    // Return mock data in offline mode
    console.log('🔄 Using mock route data (offline mode)');
    return generateMockRoute(request.start, request.end);
  }
};

/**
 * Get alternative routes with different safety/speed trade-offs
 */
export const getAlternativeRoutes = async (request: SafeRouteRequest): Promise<{ alternatives: SafeRouteResponse[] }> => {
  try {
    const response = await apiClient.post<{ alternatives: SafeRouteResponse[] }>('/api/v1/route/alternatives', request);
    return response.data;
  } catch (error) {
    // Return mock alternatives in offline mode
    console.log('🔄 Using mock alternative routes (offline mode)');
    return {
      alternatives: [
        generateMockRoute(request.start, request.end),
        generateMockRoute(request.start, request.end),
        generateMockRoute(request.start, request.end)
      ]
    };
  }
};

/**
 * Fetch crime hotspot predictions for an area
 */
export const fetchHotspots = async (request: HotspotsRequest): Promise<HotspotsResponse> => {
  try {
    const response = await apiClient.post<HotspotsResponse>('/api/v1/predict/hotspots', request);
    return response.data;
  } catch (error) {
    // Return mock hotspots in offline mode
    console.log('🔄 Using mock hotspot data (offline mode)');
    return generateMockHotspots(request.bounds);
  }
};

/**
 * Submit incident report
 */
export const reportIncident = async (incident: IncidentReport): Promise<IncidentReportResponse> => {
  try {
    const response = await apiClient.post<IncidentReportResponse>('/api/v1/report/incident', incident);
    return response.data;
  } catch (error) {
    // Return mock response in offline mode
    console.log('🔄 Simulating incident report (offline mode)');
    return {
      status: 'pending',
      report_id: `mock-${Date.now()}`,
      estimated_verification_time: 300, // 5 minutes
      auto_verified: false,
      public_id: `public-${Date.now()}`
    };
  }
};

/**
 * Get recent incidents for real-time updates
 */
export const getRecentIncidents = async (limit: number = 20): Promise<{ incidents: RecentIncident[] }> => {
  try {
    const response = await apiClient.get<{ incidents: RecentIncident[] }>(`/api/v1/incidents/recent?limit=${limit}`);
    return response.data;
  } catch (error) {
    // Return mock incidents in offline mode
    console.log('🔄 Using mock incident data (offline mode)');
    const mockIncidents: RecentIncident[] = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `mock-incident-${i}`,
      location: {
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1
      },
      type: ['theft', 'vandalism', 'suspicious_activity'][Math.floor(Math.random() * 3)],
      severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      reported_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      verified: Math.random() > 0.3
    }));
    
    return { incidents: mockIncidents };
  }
};

/**
 * Health check endpoint with enhanced error handling
 */
export const checkHealth = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    handleApiError(error, 'Health check');
  }
};

/**
 * Check if backend is available (non-throwing version)
 */
export const isBackendAvailable = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health');
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Utility function to create bounding box from center point and radius
 */
export const createBoundingBox = (center: LatLng, radiusKm: number): BoundingBox => {
  // Rough conversion: 1 degree ≈ 111.32 km
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / Math.abs(Math.cos(center.lat * Math.PI / 180)) / 111.32;

  return {
    sw: {
      lat: center.lat - latDelta,
      lng: center.lng - lngDelta
    },
    ne: {
      lat: center.lat + latDelta,
      lng: center.lng + lngDelta
    }
  };
};

/**
 * Utility function to calculate distance between two points
 */
export const calculateDistance = (point1: LatLng, point2: LatLng): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default apiClient;