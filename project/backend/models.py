"""
Pydantic models for AuraSAFE API request and response validation.
These models ensure type safety and automatic API documentation.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
from geojson_pydantic import Point, LineString, Polygon, FeatureCollection


class LatLng(BaseModel):
    """Geographic coordinate pair with validation."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    lng: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")


class BoundingBox(BaseModel):
    """Geographic bounding box for area queries."""
    ne: LatLng = Field(..., description="Northeast corner")
    sw: LatLng = Field(..., description="Southwest corner")
    
    @validator('ne')
    def validate_bounds(cls, v, values):
        """Ensure northeast is actually northeast of southwest."""
        if 'sw' in values:
            sw = values['sw']
            if v.lat <= sw.lat or v.lng <= sw.lng:
                raise ValueError("Northeast corner must be northeast of southwest corner")
        return v


class RoutePreferences(BaseModel):
    """User preferences for route optimization."""
    safety_weight: float = Field(0.5, ge=0.0, le=1.0, description="Weight for safety vs speed (0=speed only, 1=safety only)")
    max_detour: float = Field(1.5, ge=1.0, le=3.0, description="Maximum detour ratio (1.0=no detour, 2.0=double distance)")
    avoid_areas: Optional[List[str]] = Field(None, description="List of area types to avoid")
    time_of_day_factor: bool = Field(True, description="Consider time-of-day in safety calculations")


# Request Models
class SafeRouteRequest(BaseModel):
    """Request for safe route calculation."""
    start: LatLng = Field(..., description="Starting location")
    end: LatLng = Field(..., description="Destination location")
    preferences: Optional[RoutePreferences] = Field(RoutePreferences(), description="Route optimization preferences")
    departure_time: Optional[datetime] = Field(None, description="Planned departure time (defaults to now)")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HotspotsRequest(BaseModel):
    """Request for crime hotspot predictions."""
    bounds: BoundingBox = Field(..., description="Geographic area of interest")
    timestamp: datetime = Field(default_factory=datetime.now, description="Time for prediction")
    prediction_hours: int = Field(6, ge=1, le=72, description="Hours to predict into the future")
    crime_types: Optional[List[str]] = Field(None, description="Specific crime types to predict")
    confidence_threshold: float = Field(0.3, ge=0.0, le=1.0, description="Minimum confidence for hotspot inclusion")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class IncidentReport(BaseModel):
    """User-submitted incident report."""
    location: LatLng = Field(..., description="Location of incident")
    type: Literal[
        "theft", "assault", "vandalism", "suspicious_activity", 
        "harassment", "drug_activity", "noise_complaint", "other"
    ] = Field(..., description="Type of incident")
    description: str = Field(..., min_length=10, max_length=500, description="Detailed description")
    severity: Literal["low", "medium", "high", "critical"] = Field("medium", description="Incident severity")
    anonymous: bool = Field(True, description="Whether to submit anonymously")
    media_urls: Optional[List[str]] = Field(None, description="URLs to uploaded media")
    occurred_at: Optional[datetime] = Field(None, description="When incident occurred (defaults to now)")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Response Models
class ThreatSegment(BaseModel):
    """Segment of route with elevated threat level."""
    start_idx: int = Field(..., description="Starting index in route coordinates")
    end_idx: int = Field(..., description="Ending index in route coordinates")
    uti_score: float = Field(..., ge=0.0, le=1.0, description="Urban Threat Index score")
    reason: str = Field(..., description="Human-readable reason for threat")
    mitigation: Optional[str] = Field(None, description="Suggested mitigation strategy")


class SafeRouteResponse(BaseModel):
    """Response for safe route calculation."""
    path: LineString = Field(..., description="GeoJSON LineString of optimal route")
    safety_score: float = Field(..., ge=0.0, le=1.0, description="Overall safety score (1.0=safest)")
    distance_km: float = Field(..., ge=0.0, description="Total distance in kilometers")
    estimated_time_minutes: int = Field(..., ge=0, description="Estimated travel time")
    threat_segments: List[ThreatSegment] = Field([], description="High-risk segments along route")
    alternative_routes: Optional[List[Dict[str, Any]]] = Field(None, description="Alternative route options")
    last_updated: datetime = Field(default_factory=datetime.now, description="When route was calculated")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HotspotProperties(BaseModel):
    """Properties for a crime hotspot polygon."""
    uti_score: float = Field(..., ge=0.0, le=1.0, description="Urban Threat Index score")
    crime_types: List[str] = Field(..., description="Predicted crime types")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")
    historical_incidents: int = Field(..., ge=0, description="Historical incident count")
    risk_factors: List[str] = Field([], description="Contributing risk factors")
    recommendations: List[str] = Field([], description="Safety recommendations")


class HotspotsResponse(BaseModel):
    """Response for hotspot predictions."""
    hotspots: FeatureCollection = Field(..., description="GeoJSON FeatureCollection of hotspot polygons")
    generated_at: datetime = Field(default_factory=datetime.now, description="When predictions were generated")
    valid_until: datetime = Field(..., description="When predictions expire")
    model_version: str = Field("1.0", description="ML model version used")
    coverage_area_km2: float = Field(..., ge=0.0, description="Total area covered")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class IncidentReportResponse(BaseModel):
    """Response for incident report submission."""
    status: Literal["success", "pending", "failed"] = Field(..., description="Submission status")
    report_id: str = Field(..., description="Unique report identifier")
    estimated_verification_time: int = Field(..., ge=0, description="Estimated verification time in seconds")
    auto_verified: bool = Field(False, description="Whether report was automatically verified")
    public_id: Optional[str] = Field(None, description="Public identifier for tracking")
    
    
# Database Models (Internal)
class StoredIncident(BaseModel):
    """Internal model for stored incident reports."""
    id: str = Field(..., description="Unique incident identifier")
    location: LatLng
    type: str
    description: str
    severity: str
    verified: bool = False
    verification_score: float = 0.0
    reported_at: datetime
    occurred_at: Optional[datetime]
    reporter_id: Optional[str]  # For non-anonymous reports
    media_urls: List[str] = []
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ModelPrediction(BaseModel):
    """Internal model for ML predictions."""
    location: LatLng
    prediction_time: datetime
    crime_type: str
    probability: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    model_version: str
    features_used: Dict[str, Any]
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Error Models
class APIError(BaseModel):
    """Standardized API error response."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    request_id: Optional[str] = Field(None, description="Request identifier for debugging")
    timestamp: datetime = Field(default_factory=datetime.now, description="When error occurred")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }