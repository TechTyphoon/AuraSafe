"""
Database operations for AuraSAFE using MongoDB and Redis.
Handles CRUD operations for incident reports, model predictions, and caching.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
import redis.asyncio as redis
from bson import ObjectId
from pymongo import GeoJSON, GEOSPHERE
from models import StoredIncident, ModelPrediction, LatLng

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and operations for AuraSAFE."""
    
    def __init__(self):
        """Initialize database connections."""
        # MongoDB configuration
        self.mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.db_name = os.getenv("DATABASE_NAME", "aurasafe")
        self.mongo_client: Optional[AsyncIOMotorClient] = None
        self.db = None
        
        # Redis configuration
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client: Optional[redis.Redis] = None
        
        # Collection references
        self.incidents_collection: Optional[AsyncIOMotorCollection] = None
        self.predictions_collection: Optional[AsyncIOMotorCollection] = None
        self.users_collection: Optional[AsyncIOMotorCollection] = None
        
    async def connect(self):
        """Establish database connections."""
        try:
            # Connect to MongoDB
            self.mongo_client = AsyncIOMotorClient(self.mongo_url)
            self.db = self.mongo_client[self.db_name]
            
            # Initialize collections
            self.incidents_collection = self.db.incidents
            self.predictions_collection = self.db.predictions
            self.users_collection = self.db.users
            
            # Create indexes for optimal performance
            await self._create_indexes()
            
            # Connect to Redis
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            
            # Test connections
            await self.mongo_client.admin.command('ping')
            await self.redis_client.ping()
            
            logger.info("Successfully connected to MongoDB and Redis")
            
        except Exception as e:
            logger.error(f"Failed to connect to databases: {e}")
            raise
    
    async def disconnect(self):
        """Close database connections."""
        if self.mongo_client:
            self.mongo_client.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Database connections closed")
    
    async def _create_indexes(self):
        """Create database indexes for optimal query performance."""
        try:
            # Geospatial index for incidents
            await self.incidents_collection.create_index([
                ("location", GEOSPHERE)
            ])
            
            # Temporal indexes
            await self.incidents_collection.create_index("reported_at")
            await self.incidents_collection.create_index("occurred_at")
            
            # Compound indexes for common queries
            await self.incidents_collection.create_index([
                ("type", 1),
                ("severity", 1),
                ("verified", 1)
            ])
            
            # Prediction collection indexes
            await self.predictions_collection.create_index([
                ("location", GEOSPHERE)
            ])
            await self.predictions_collection.create_index("prediction_time")
            await self.predictions_collection.create_index([
                ("crime_type", 1),
                ("prediction_time", -1)
            ])
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
    
    # Incident Report Operations
    async def store_incident(self, incident: StoredIncident) -> str:
        """Store a new incident report in the database."""
        try:
            # Convert Pydantic model to dict for MongoDB
            incident_dict = incident.dict()
            incident_dict['_id'] = ObjectId()
            incident_dict['location'] = {
                "type": "Point",
                "coordinates": [incident.location.lng, incident.location.lat]
            }
            
            # Insert into MongoDB
            result = await self.incidents_collection.insert_one(incident_dict)
            
            # Cache recent incident for real-time updates
            await self._cache_recent_incident(incident_dict)
            
            logger.info(f"Stored incident report: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Failed to store incident: {e}")
            raise
    
    async def get_incidents_in_area(
        self, 
        bounds: Dict[str, LatLng], 
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        incident_types: Optional[List[str]] = None,
        verified_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Retrieve incidents within a geographic bounding box."""
        try:
            # Build MongoDB query
            query = {
                "location": {
                    "$geoWithin": {
                        "$box": [
                            [bounds['sw'].lng, bounds['sw'].lat],
                            [bounds['ne'].lng, bounds['ne'].lat]
                        ]
                    }
                }
            }
            
            # Add time filters
            if start_time or end_time:
                time_filter = {}
                if start_time:
                    time_filter["$gte"] = start_time
                if end_time:
                    time_filter["$lte"] = end_time
                query["occurred_at"] = time_filter
            
            # Add type filter
            if incident_types:
                query["type"] = {"$in": incident_types}
            
            # Add verification filter
            if verified_only:
                query["verified"] = True
            
            # Execute query
            cursor = self.incidents_collection.find(query)
            incidents = await cursor.to_list(length=1000)  # Limit for performance
            
            # Convert ObjectId to string and format coordinates
            for incident in incidents:
                incident['_id'] = str(incident['_id'])
                if 'location' in incident and 'coordinates' in incident['location']:
                    coords = incident['location']['coordinates']
                    incident['location'] = LatLng(lat=coords[1], lng=coords[0])
            
            return incidents
            
        except Exception as e:
            logger.error(f"Failed to retrieve incidents: {e}")
            raise
    
    async def update_incident_verification(self, incident_id: str, verified: bool, score: float):
        """Update incident verification status."""
        try:
            result = await self.incidents_collection.update_one(
                {"_id": ObjectId(incident_id)},
                {
                    "$set": {
                        "verified": verified,
                        "verification_score": score,
                        "verified_at": datetime.now()
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Updated verification for incident {incident_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to update incident verification: {e}")
            raise
    
    # Model Prediction Operations
    async def store_predictions(self, predictions: List[ModelPrediction]):
        """Store ML model predictions in bulk."""
        try:
            prediction_docs = []
            for pred in predictions:
                pred_dict = pred.dict()
                pred_dict['location'] = {
                    "type": "Point",
                    "coordinates": [pred.location.lng, pred.location.lat]
                }
                prediction_docs.append(pred_dict)
            
            # Bulk insert for performance
            if prediction_docs:
                await self.predictions_collection.insert_many(prediction_docs)
                logger.info(f"Stored {len(prediction_docs)} predictions")
            
        except Exception as e:
            logger.error(f"Failed to store predictions: {e}")
            raise
    
    async def get_predictions_in_area(
        self,
        bounds: Dict[str, LatLng],
        prediction_time: datetime,
        crime_types: Optional[List[str]] = None,
        min_confidence: float = 0.3
    ) -> List[Dict[str, Any]]:
        """Retrieve model predictions for a geographic area."""
        try:
            # Build query
            query = {
                "location": {
                    "$geoWithin": {
                        "$box": [
                            [bounds['sw'].lng, bounds['sw'].lat],
                            [bounds['ne'].lng, bounds['ne'].lat]
                        ]
                    }
                },
                "prediction_time": {
                    "$gte": prediction_time - timedelta(hours=1),
                    "$lte": prediction_time + timedelta(hours=1)
                },
                "confidence": {"$gte": min_confidence}
            }
            
            if crime_types:
                query["crime_type"] = {"$in": crime_types}
            
            cursor = self.predictions_collection.find(query)
            predictions = await cursor.to_list(length=5000)
            
            # Format for API response
            for pred in predictions:
                pred['_id'] = str(pred['_id'])
                if 'location' in pred and 'coordinates' in pred['location']:
                    coords = pred['location']['coordinates']
                    pred['location'] = LatLng(lat=coords[1], lng=coords[0])
            
            return predictions
            
        except Exception as e:
            logger.error(f"Failed to retrieve predictions: {e}")
            raise
    
    # Redis Caching Operations
    async def cache_route(self, route_key: str, route_data: Dict[str, Any], ttl_minutes: int = 15):
        """Cache computed route for performance."""
        try:
            await self.redis_client.setex(
                f"route:{route_key}",
                ttl_minutes * 60,
                json.dumps(route_data, default=str)
            )
            logger.debug(f"Cached route: {route_key}")
            
        except Exception as e:
            logger.error(f"Failed to cache route: {e}")
    
    async def get_cached_route(self, route_key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached route if available."""
        try:
            cached_data = await self.redis_client.get(f"route:{route_key}")
            if cached_data:
                return json.loads(cached_data)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached route: {e}")
            return None
    
    async def cache_hotspots(self, area_key: str, hotspots_data: Dict[str, Any], ttl_minutes: int = 30):
        """Cache computed hotspots for performance."""
        try:
            await self.redis_client.setex(
                f"hotspots:{area_key}",
                ttl_minutes * 60,
                json.dumps(hotspots_data, default=str)
            )
            logger.debug(f"Cached hotspots: {area_key}")
            
        except Exception as e:
            logger.error(f"Failed to cache hotspots: {e}")
    
    async def get_cached_hotspots(self, area_key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached hotspots if available."""
        try:
            cached_data = await self.redis_client.get(f"hotspots:{area_key}")
            if cached_data:
                return json.loads(cached_data)
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached hotspots: {e}")
            return None
    
    async def _cache_recent_incident(self, incident_dict: Dict[str, Any]):
        """Cache recent incident for real-time updates."""
        try:
            # Store in Redis list for real-time incident feed
            await self.redis_client.lpush(
                "recent_incidents",
                json.dumps(incident_dict, default=str)
            )
            
            # Keep only last 100 incidents
            await self.redis_client.ltrim("recent_incidents", 0, 99)
            
        except Exception as e:
            logger.error(f"Failed to cache recent incident: {e}")
    
    async def get_recent_incidents(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent incidents from cache."""
        try:
            incidents_json = await self.redis_client.lrange("recent_incidents", 0, limit - 1)
            incidents = [json.loads(incident) for incident in incidents_json]
            return incidents
            
        except Exception as e:
            logger.error(f"Failed to retrieve recent incidents: {e}")
            return []
    
    # Utility Methods
    async def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics for monitoring."""
        try:
            incident_count = await self.incidents_collection.count_documents({})
            prediction_count = await self.predictions_collection.count_documents({})
            
            # Get recent activity
            recent_incidents = await self.incidents_collection.count_documents({
                "reported_at": {"$gte": datetime.now() - timedelta(hours=24)}
            })
            
            return {
                "total_incidents": incident_count,
                "total_predictions": prediction_count,
                "recent_incidents_24h": recent_incidents,
                "database_name": self.db_name,
                "timestamp": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {}


# Global database manager instance
db_manager = DatabaseManager()


async def init_database():
    """Initialize database connections."""
    await db_manager.connect()


async def close_database():
    """Close database connections."""
    await db_manager.disconnect()


# Convenience functions for API endpoints
async def store_incident_report(incident: StoredIncident) -> str:
    """Store incident report (convenience function)."""
    return await db_manager.store_incident(incident)


async def get_area_incidents(bounds, **kwargs) -> List[Dict[str, Any]]:
    """Get incidents in area (convenience function)."""
    return await db_manager.get_incidents_in_area(bounds, **kwargs)


async def store_model_predictions(predictions: List[ModelPrediction]):
    """Store model predictions (convenience function)."""
    await db_manager.store_predictions(predictions)


async def get_area_predictions(bounds, prediction_time, **kwargs) -> List[Dict[str, Any]]:
    """Get predictions in area (convenience function)."""
    return await db_manager.get_predictions_in_area(bounds, prediction_time, **kwargs)