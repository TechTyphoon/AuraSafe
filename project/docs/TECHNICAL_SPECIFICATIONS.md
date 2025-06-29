# AuraSAFE Technical Specifications

## 1. System Architecture Overview

### 1.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        AuraSAFE System                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Presentation  │    Business     │         Data Layer          │
│     Layer       │     Logic       │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • React Frontend│ • FastAPI       │ • MongoDB (Incidents)       │
│ • Mobile Apps   │ • ML Engine     │ • PostgreSQL (Users)        │
│ • Admin Panel   │ • Route Engine  │ • Redis (Cache)             │
│ • Public API    │ • Auth Service  │ • InfluxDB (Metrics)        │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### 1.2 Microservices Architecture
| Service | Technology | Purpose | Scaling |
|---------|------------|---------|---------|
| Frontend | React 18 + TypeScript | User interface | Horizontal |
| API Gateway | FastAPI + Nginx | Request routing | Horizontal |
| Auth Service | Supabase | Authentication | Managed |
| ML Engine | Python + TensorFlow | Crime prediction | Vertical |
| Route Service | Python + NetworkX | Path optimization | Horizontal |
| Data Service | MongoDB + Redis | Data persistence | Horizontal |
| Notification | WebSocket + FCM | Real-time updates | Horizontal |

## 2. Machine Learning Specifications

### 2.1 STGCN Model Architecture

#### 2.1.1 Network Structure
```python
class STGCNModel(nn.Module):
    def __init__(self, 
                 num_nodes: int = 1024,
                 num_features: int = 10,
                 num_timesteps_input: int = 12,
                 num_timesteps_output: int = 6):
        super().__init__()
        
        # Spatial-Temporal Blocks
        self.st_block1 = STBlock(num_features, 64, num_nodes)
        self.st_block2 = STBlock(64, 128, num_nodes)
        self.st_block3 = STBlock(128, 64, num_nodes)
        
        # Output layer
        self.output_layer = nn.Linear(64, num_timesteps_output)
        
    def forward(self, x, adj_matrix):
        # x shape: (batch_size, num_nodes, num_features, num_timesteps)
        x = self.st_block1(x, adj_matrix)
        x = self.st_block2(x, adj_matrix)
        x = self.st_block3(x, adj_matrix)
        
        # Final prediction
        output = self.output_layer(x)
        return output
```

#### 2.1.2 Model Parameters
| Parameter | Value | Justification |
|-----------|-------|---------------|
| Input Dimensions | 1024 × 10 × 12 | NYC grid cells × features × time steps |
| Hidden Layers | [64, 128, 64] | Optimal from hyperparameter search |
| Dropout Rate | 0.2 | Prevents overfitting |
| Learning Rate | 0.001 | Adam optimizer optimal |
| Batch Size | 32 | Memory-performance balance |
| Training Epochs | 100 | Convergence analysis |

### 2.2 Feature Engineering

#### 2.2.1 Temporal Features
```python
def extract_temporal_features(timestamp):
    """Extract cyclical temporal features"""
    dt = pd.to_datetime(timestamp)
    
    features = {
        'hour_sin': np.sin(2 * np.pi * dt.hour / 24),
        'hour_cos': np.cos(2 * np.pi * dt.hour / 24),
        'day_sin': np.sin(2 * np.pi * dt.dayofweek / 7),
        'day_cos': np.cos(2 * np.pi * dt.dayofweek / 7),
        'month_sin': np.sin(2 * np.pi * dt.month / 12),
        'month_cos': np.cos(2 * np.pi * dt.month / 12),
        'is_weekend': int(dt.dayofweek >= 5),
        'is_holiday': int(dt in holidays.US()),
    }
    
    return features
```

#### 2.2.2 Spatial Features
| Feature | Type | Range | Description |
|---------|------|-------|-------------|
| Latitude | Continuous | [40.4774, 40.9176] | Geographic coordinate |
| Longitude | Continuous | [-74.2591, -73.7004] | Geographic coordinate |
| Grid Cell ID | Categorical | [0, 1023] | Spatial discretization |
| Distance to Center | Continuous | [0, 50] km | Distance to Manhattan |
| Population Density | Continuous | [0, 100000] /km² | Census data |
| POI Density | Continuous | [0, 500] /km² | Points of interest |

### 2.3 Training Pipeline

#### 2.3.1 Data Preprocessing
```python
class DataPreprocessor:
    def __init__(self, grid_size=32):
        self.grid_size = grid_size
        self.scaler = StandardScaler()
        
    def create_spatial_grid(self, bounds):
        """Create spatial grid for NYC"""
        lat_range = np.linspace(bounds['south'], bounds['north'], self.grid_size)
        lng_range = np.linspace(bounds['west'], bounds['east'], self.grid_size)
        
        grid = []
        for i, lat in enumerate(lat_range):
            for j, lng in enumerate(lng_range):
                grid.append({
                    'id': i * self.grid_size + j,
                    'lat': lat,
                    'lng': lng,
                    'neighbors': self._get_neighbors(i, j)
                })
        
        return grid
    
    def create_adjacency_matrix(self, grid):
        """Create spatial adjacency matrix"""
        n = len(grid)
        adj_matrix = np.zeros((n, n))
        
        for cell in grid:
            for neighbor_id in cell['neighbors']:
                adj_matrix[cell['id']][neighbor_id] = 1
                
        # Add self-loops
        adj_matrix += np.eye(n)
        
        # Normalize
        degree_matrix = np.diag(np.sum(adj_matrix, axis=1))
        adj_matrix = np.linalg.inv(degree_matrix) @ adj_matrix
        
        return adj_matrix
```

#### 2.3.2 Training Configuration
```yaml
training:
  optimizer: Adam
  learning_rate: 0.001
  weight_decay: 1e-4
  scheduler: ReduceLROnPlateau
  patience: 10
  early_stopping: 20
  
validation:
  split_ratio: 0.2
  strategy: temporal
  metrics: [precision, recall, f1, auc]
  
augmentation:
  noise_level: 0.01
  temporal_jitter: 0.1
  spatial_dropout: 0.05
```

## 3. Routing Algorithm Specifications

### 3.1 Safety-Aware A* Implementation

#### 3.1.1 Core Algorithm
```python
class SafetyAwareAStar:
    def __init__(self, graph, safety_weight=0.5):
        self.graph = graph
        self.safety_weight = safety_weight
        self.distance_weight = 1.0 - safety_weight
        
    def heuristic(self, node, goal, uti_predictions):
        """Enhanced heuristic with safety consideration"""
        # Euclidean distance
        distance_h = self._euclidean_distance(node, goal)
        
        # Safety heuristic
        safety_h = uti_predictions.get(node.id, 0.0)
        
        # Combined heuristic
        return (self.distance_weight * distance_h + 
                self.safety_weight * safety_h)
    
    def edge_cost(self, from_node, to_node, uti_predictions):
        """Calculate edge cost with safety consideration"""
        # Physical distance
        distance = self._euclidean_distance(from_node, to_node)
        
        # Safety cost
        avg_uti = (uti_predictions.get(from_node.id, 0.0) + 
                   uti_predictions.get(to_node.id, 0.0)) / 2.0
        
        # Environmental factors
        lighting_factor = self._get_lighting_factor(from_node, to_node)
        traffic_factor = self._get_traffic_factor(from_node, to_node)
        
        safety_cost = avg_uti * (1 + lighting_factor + traffic_factor)
        
        return (self.distance_weight * distance + 
                self.safety_weight * safety_cost)
```

#### 3.1.2 Graph Representation
| Component | Specification | Implementation |
|-----------|---------------|----------------|
| Nodes | Street intersections | NetworkX Graph |
| Edges | Street segments | Weighted edges |
| Weights | Distance + Safety | Dynamic calculation |
| Storage | In-memory graph | Redis caching |
| Updates | Real-time UTI | Event-driven |

### 3.2 Route Optimization

#### 3.2.1 Multi-Objective Optimization
```python
def pareto_optimal_routes(start, end, objectives=['distance', 'safety', 'time']):
    """Generate Pareto-optimal route alternatives"""
    routes = []
    
    # Generate routes with different weight combinations
    weight_combinations = [
        {'distance': 1.0, 'safety': 0.0, 'time': 0.0},  # Shortest
        {'distance': 0.0, 'safety': 1.0, 'time': 0.0},  # Safest
        {'distance': 0.0, 'safety': 0.0, 'time': 1.0},  # Fastest
        {'distance': 0.3, 'safety': 0.5, 'time': 0.2},  # Balanced
        {'distance': 0.2, 'safety': 0.7, 'time': 0.1},  # Safety-focused
    ]
    
    for weights in weight_combinations:
        route = calculate_weighted_route(start, end, weights)
        if is_pareto_optimal(route, routes):
            routes.append(route)
    
    return routes
```

## 4. Database Specifications

### 4.1 MongoDB Schema

#### 4.1.1 Incidents Collection
```javascript
{
  _id: ObjectId,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  type: String, // enum: theft, assault, vandalism, etc.
  description: String,
  severity: String, // enum: low, medium, high, critical
  timestamp: ISODate,
  reporter_id: String,
  verified: Boolean,
  verification_score: Number,
  metadata: {
    weather: String,
    lighting: String,
    crowd_density: Number
  },
  created_at: ISODate,
  updated_at: ISODate
}
```

#### 4.1.2 Predictions Collection
```javascript
{
  _id: ObjectId,
  grid_cell_id: Number,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  prediction_time: ISODate,
  uti_score: Number, // 0.0 to 1.0
  confidence: Number, // 0.0 to 1.0
  crime_types: [String],
  features: {
    temporal: Object,
    spatial: Object,
    environmental: Object
  },
  model_version: String,
  created_at: ISODate
}
```

### 4.2 PostgreSQL Schema (Supabase)

#### 4.2.1 Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  safety_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
```

#### 4.2.2 Routes Table
```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  start_location POINT NOT NULL,
  end_location POINT NOT NULL,
  route_data JSONB NOT NULL,
  safety_score DECIMAL(3,2),
  distance_km DECIMAL(8,3),
  estimated_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial index
CREATE INDEX idx_routes_start_location ON routes USING GIST (start_location);
CREATE INDEX idx_routes_end_location ON routes USING GIST (end_location);
```

### 4.3 Redis Caching Strategy

#### 4.3.1 Cache Structure
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `route:{hash}` | 15 min | Calculated routes |
| `hotspots:{bounds}:{time}` | 30 min | Hotspot predictions |
| `uti:{grid_id}:{hour}` | 60 min | UTI scores |
| `user:{id}:prefs` | 24 hours | User preferences |

#### 4.3.2 Cache Implementation
```python
class CacheManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    async def get_route(self, route_key):
        """Get cached route"""
        cached = await self.redis.get(f"route:{route_key}")
        if cached:
            return json.loads(cached)
        return None
    
    async def set_route(self, route_key, route_data, ttl=900):
        """Cache route for 15 minutes"""
        await self.redis.setex(
            f"route:{route_key}",
            ttl,
            json.dumps(route_data, default=str)
        )
    
    async def get_uti_scores(self, grid_ids, hour):
        """Batch get UTI scores"""
        keys = [f"uti:{grid_id}:{hour}" for grid_id in grid_ids]
        values = await self.redis.mget(keys)
        
        return {
            grid_id: float(value) if value else None
            for grid_id, value in zip(grid_ids, values)
        }
```

## 5. API Specifications

### 5.1 REST API Endpoints

#### 5.1.1 Route Calculation
```yaml
POST /api/v1/route/safe:
  summary: Calculate safe route
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          properties:
            start:
              $ref: '#/components/schemas/LatLng'
            end:
              $ref: '#/components/schemas/LatLng'
            preferences:
              $ref: '#/components/schemas/RoutePreferences'
            departure_time:
              type: string
              format: date-time
  responses:
    200:
      description: Route calculated successfully
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SafeRouteResponse'
    400:
      description: Invalid request parameters
    429:
      description: Rate limit exceeded
    500:
      description: Internal server error
```

#### 5.1.2 Hotspot Prediction
```yaml
POST /api/v1/predict/hotspots:
  summary: Get crime hotspot predictions
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          properties:
            bounds:
              $ref: '#/components/schemas/BoundingBox'
            timestamp:
              type: string
              format: date-time
            prediction_hours:
              type: integer
              minimum: 1
              maximum: 72
            confidence_threshold:
              type: number
              minimum: 0.0
              maximum: 1.0
  responses:
    200:
      description: Hotspots predicted successfully
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/HotspotsResponse'
```

### 5.2 WebSocket API

#### 5.2.1 Real-time Updates
```javascript
// Connection
const ws = new WebSocket('wss://api.aurasafe.app/ws');

// Subscribe to updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'incidents',
  bounds: {
    sw: { lat: 40.7489, lng: -73.9851 },
    ne: { lat: 40.7829, lng: -73.9441 }
  }
}));

// Receive updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  switch (update.type) {
    case 'incident_reported':
      handleNewIncident(update.data);
      break;
    case 'uti_updated':
      handleUTIUpdate(update.data);
      break;
  }
};
```

## 6. Security Specifications

### 6.1 Authentication & Authorization

#### 6.1.1 JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "email": "user@example.com",
    "role": "user",
    "iat": 1640995200,
    "exp": 1641081600,
    "aud": "aurasafe-api",
    "iss": "aurasafe.app"
  }
}
```

#### 6.1.2 Rate Limiting
| Endpoint | Rate Limit | Window | Burst |
|----------|------------|--------|-------|
| `/api/v1/route/*` | 100 req/min | 1 minute | 10 |
| `/api/v1/predict/*` | 50 req/min | 1 minute | 5 |
| `/api/v1/report/*` | 20 req/min | 1 minute | 3 |
| `/api/v1/auth/*` | 10 req/min | 1 minute | 2 |

### 6.2 Data Encryption

#### 6.2.1 Encryption Standards
| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Data at Rest | AES-256-GCM | AWS KMS |
| Data in Transit | TLS 1.3 | Certificate Authority |
| Database | Transparent Data Encryption | MongoDB Enterprise |
| Backups | AES-256-CBC | Separate key store |

#### 6.2.2 Privacy Protection
```python
class PrivacyManager:
    def __init__(self, k_anonymity=5):
        self.k_anonymity = k_anonymity
        
    def anonymize_location(self, lat, lng, precision=3):
        """Reduce location precision for privacy"""
        return {
            'lat': round(lat, precision),
            'lng': round(lng, precision)
        }
    
    def apply_differential_privacy(self, data, epsilon=1.0):
        """Add calibrated noise for differential privacy"""
        sensitivity = self._calculate_sensitivity(data)
        noise_scale = sensitivity / epsilon
        
        noise = np.random.laplace(0, noise_scale, len(data))
        return data + noise
```

## 7. Performance Specifications

### 7.1 Response Time Requirements

| Operation | Target | Maximum | SLA |
|-----------|--------|---------|-----|
| Route Calculation | < 500ms | < 1000ms | 95% |
| Hotspot Prediction | < 300ms | < 600ms | 95% |
| Incident Reporting | < 200ms | < 400ms | 99% |
| User Authentication | < 100ms | < 200ms | 99% |

### 7.2 Scalability Targets

| Metric | Current | 6 Months | 12 Months |
|--------|---------|----------|-----------|
| Concurrent Users | 10,000 | 50,000 | 100,000 |
| Requests/Second | 5,000 | 25,000 | 50,000 |
| Data Volume | 100GB | 500GB | 1TB |
| Geographic Coverage | NYC | 5 cities | 20 cities |

### 7.3 Resource Requirements

#### 7.3.1 Production Infrastructure
| Component | Specification | Quantity | Purpose |
|-----------|---------------|----------|---------|
| API Servers | 8 vCPU, 16GB RAM | 3 | Load balancing |
| ML Servers | 16 vCPU, 64GB RAM, GPU | 2 | Model inference |
| Database | 8 vCPU, 32GB RAM, SSD | 3 | Data persistence |
| Cache | 4 vCPU, 16GB RAM | 2 | Redis cluster |
| Load Balancer | 4 vCPU, 8GB RAM | 2 | Traffic distribution |

## 8. Monitoring and Observability

### 8.1 Metrics Collection

#### 8.1.1 Application Metrics
```python
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
REQUEST_COUNT = Counter('http_requests_total', 
                       'Total HTTP requests', 
                       ['method', 'endpoint', 'status'])

REQUEST_DURATION = Histogram('http_request_duration_seconds',
                           'HTTP request duration',
                           ['method', 'endpoint'])

# Business metrics
ROUTE_CALCULATIONS = Counter('route_calculations_total',
                           'Total route calculations')

PREDICTION_ACCURACY = Gauge('prediction_accuracy',
                          'Current prediction accuracy')

UTI_SCORES = Histogram('uti_scores',
                      'Distribution of UTI scores')
```

#### 8.1.2 Infrastructure Metrics
| Metric | Source | Frequency | Alert Threshold |
|--------|--------|-----------|-----------------|
| CPU Usage | System | 30s | > 80% |
| Memory Usage | System | 30s | > 85% |
| Disk Usage | System | 60s | > 90% |
| Network I/O | System | 30s | > 1GB/s |
| Database Connections | MongoDB | 30s | > 80% pool |
| Cache Hit Rate | Redis | 60s | < 90% |

### 8.2 Logging Strategy

#### 8.2.1 Log Levels and Structure
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "route-service",
  "trace_id": "abc123def456",
  "user_id": "user_789",
  "message": "Route calculated successfully",
  "metadata": {
    "start_location": [40.7589, -73.9851],
    "end_location": [40.7505, -73.9934],
    "safety_score": 0.89,
    "calculation_time_ms": 450
  }
}
```

#### 8.2.2 Log Retention Policy
| Log Type | Retention | Storage | Purpose |
|----------|-----------|---------|---------|
| Application | 30 days | ELK Stack | Debugging |
| Security | 1 year | Secure storage | Audit |
| Performance | 90 days | InfluxDB | Optimization |
| Business | 2 years | Data warehouse | Analytics |

This comprehensive technical specification provides all the implementation details needed for IEEE conference submission and production deployment.