"""
Enhanced Safety-Aware A* (SA-A*) routing algorithm for production deployment.
Includes water avoidance, bridge routing, and realistic path generation.
"""

import heapq
import math
import numpy as np
from typing import List, Tuple, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
import logging
from geopy.distance import geodesic
import requests
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Node:
    """Represents a node in the routing graph."""
    id: str
    lat: float
    lng: float
    uti_score: float = 0.0
    node_type: str = "street"
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        return isinstance(other, Node) and self.id == other.id


@dataclass
class Edge:
    """Represents an edge between two nodes."""
    from_node: Node
    to_node: Node
    distance_km: float
    avg_uti_score: float = 0.0
    road_type: str = "residential"
    lighting_score: float = 0.5
    foot_traffic_score: float = 0.5
    
    def get_safety_cost(self) -> float:
        """Calculate safety cost for this edge."""
        environmental_risk = 1.0 - (0.3 * self.lighting_score + 0.2 * self.foot_traffic_score)
        return 0.7 * self.avg_uti_score + 0.3 * environmental_risk


@dataclass
class RouteSegment:
    """Represents a segment of a calculated route."""
    from_node: Node
    to_node: Node
    edge: Edge
    cumulative_distance: float
    cumulative_safety_cost: float
    segment_index: int


@dataclass
class PathNode:
    """Node in the A* search with cost information."""
    node: Node
    g_cost: float = float('inf')
    h_cost: float = 0.0
    f_cost: float = float('inf')
    parent: Optional['PathNode'] = None
    
    def __lt__(self, other):
        return self.f_cost < other.f_cost


class EnhancedUrbanGraph:
    """
    Enhanced graph representation with real-world routing capabilities.
    """
    
    def __init__(self):
        """Initialize enhanced urban graph."""
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, List[Edge]] = {}
        self.uti_cache: Dict[str, float] = {}
        self.osrm_cache: Dict[str, List[Tuple[float, float]]] = {}
        
    def add_node(self, node: Node):
        """Add a node to the graph."""
        self.nodes[node.id] = node
        if node.id not in self.edges:
            self.edges[node.id] = []
    
    def add_edge(self, edge: Edge):
        """Add an edge to the graph (bidirectional by default)."""
        # Add forward edge
        if edge.from_node.id not in self.edges:
            self.edges[edge.from_node.id] = []
        self.edges[edge.from_node.id].append(edge)
        
        # Add reverse edge
        reverse_edge = Edge(
            from_node=edge.to_node,
            to_node=edge.from_node,
            distance_km=edge.distance_km,
            avg_uti_score=edge.avg_uti_score,
            road_type=edge.road_type,
            lighting_score=edge.lighting_score,
            foot_traffic_score=edge.foot_traffic_score
        )
        
        if edge.to_node.id not in self.edges:
            self.edges[edge.to_node.id] = []
        self.edges[edge.to_node.id].append(reverse_edge)
    
    def get_neighbors(self, node_id: str) -> List[Edge]:
        """Get all edges from a given node."""
        return self.edges.get(node_id, [])
    
    def update_uti_scores(self, uti_predictions: Dict[str, float]):
        """Update UTI scores for nodes and edges."""
        for node_id, uti_score in uti_predictions.items():
            if node_id in self.nodes:
                self.nodes[node_id].uti_score = uti_score
                self.uti_cache[node_id] = uti_score
        
        # Update edge UTI scores
        for node_id, edges in self.edges.items():
            for edge in edges:
                from_uti = self.nodes[edge.from_node.id].uti_score
                to_uti = self.nodes[edge.to_node.id].uti_score
                edge.avg_uti_score = (from_uti + to_uti) / 2.0
    
    async def get_osrm_route(self, start: Tuple[float, float], end: Tuple[float, float]) -> Optional[List[Tuple[float, float]]]:
        """Get route from OSRM routing service."""
        cache_key = f"{start[0]:.4f},{start[1]:.4f}_{end[0]:.4f},{end[1]:.4f}"
        
        if cache_key in self.osrm_cache:
            return self.osrm_cache[cache_key]
        
        try:
            # Use OSRM demo server for walking routes
            url = f"https://router.project-osrm.org/route/v1/walking/{start[1]},{start[0]};{end[1]},{end[0]}"
            params = {
                'overview': 'full',
                'geometries': 'geojson'
            }
            
            response = requests.get(url, params=params, timeout=5)
            data = response.json()
            
            if data.get('routes') and len(data['routes']) > 0:
                coordinates = data['routes'][0]['geometry']['coordinates']
                # Convert to (lat, lng) tuples
                route_points = [(coord[1], coord[0]) for coord in coordinates]
                
                # Cache the result
                self.osrm_cache[cache_key] = route_points
                return route_points
            
        except Exception as e:
            logger.warning(f"OSRM routing failed: {e}")
        
        return None
    
    @classmethod
    def create_enhanced_graph(cls, coordinates: List[Tuple[float, float]], 
                            connection_threshold_km: float = 0.5) -> 'EnhancedUrbanGraph':
        """Create enhanced graph with realistic connections."""
        graph = cls()
        
        # Create nodes
        nodes = []
        for i, (lat, lng) in enumerate(coordinates):
            # Determine node type based on location
            node_type = cls._determine_node_type(lat, lng)
            
            node = Node(
                id=f"node_{i}",
                lat=lat,
                lng=lng,
                uti_score=cls._calculate_initial_uti(lat, lng),
                node_type=node_type
            )
            nodes.append(node)
            graph.add_node(node)
        
        # Create edges with enhanced logic
        for i, node1 in enumerate(nodes):
            for j, node2 in enumerate(nodes):
                if i != j:
                    distance = geodesic((node1.lat, node1.lng), (node2.lat, node2.lng)).kilometers
                    
                    if distance <= connection_threshold_km:
                        # Determine if connection is valid (avoid water bodies)
                        if cls._is_valid_connection(node1, node2):
                            edge = Edge(
                                from_node=node1,
                                to_node=node2,
                                distance_km=distance,
                                avg_uti_score=(node1.uti_score + node2.uti_score) / 2.0,
                                road_type=cls._determine_road_type(node1, node2),
                                lighting_score=cls._calculate_lighting_score(node1, node2),
                                foot_traffic_score=cls._calculate_traffic_score(node1, node2)
                            )
                            graph.add_edge(edge)
        
        return graph
    
    @staticmethod
    def _determine_node_type(lat: float, lng: float) -> str:
        """Determine node type based on location."""
        # Manhattan center
        if 40.7400 <= lat <= 40.7800 and -74.0100 <= lng <= -73.9700:
            return "urban_center"
        # Near water
        elif lng < -74.0050 or lng > -73.9400:
            return "waterfront"
        else:
            return "residential"
    
    @staticmethod
    def _calculate_initial_uti(lat: float, lng: float) -> float:
        """Calculate initial UTI score based on location."""
        # Distance from Times Square (high activity area)
        times_square = (40.7580, -73.9855)
        distance = geodesic((lat, lng), times_square).kilometers
        
        # Base UTI increases with distance from center
        base_uti = min(0.6, distance * 0.1)
        
        # Add some randomness based on coordinates
        coord_hash = hash(f"{lat:.4f},{lng:.4f}") % 100
        variation = coord_hash / 500  # 0 to 0.2
        
        return min(0.8, base_uti + variation)
    
    @staticmethod
    def _is_valid_connection(node1: Node, node2: Node) -> bool:
        """Check if connection between nodes is valid (not crossing water)."""
        # Simple water body avoidance for NYC
        # East River boundary (approximate)
        if (node1.lng < -73.9600 and node2.lng > -73.9500) or \
           (node1.lng > -73.9500 and node2.lng < -73.9600):
            # Check if crossing East River
            if 40.7000 <= min(node1.lat, node2.lat) <= 40.8000:
                return False
        
        # Hudson River boundary (approximate)
        if (node1.lng < -74.0100 and node2.lng > -74.0000) or \
           (node1.lng > -74.0000 and node2.lng < -74.0100):
            # Check if crossing Hudson River
            if 40.7000 <= min(node1.lat, node2.lat) <= 40.8000:
                return False
        
        return True
    
    @staticmethod
    def _determine_road_type(node1: Node, node2: Node) -> str:
        """Determine road type between nodes."""
        if node1.node_type == "urban_center" or node2.node_type == "urban_center":
            return "arterial"
        elif node1.node_type == "waterfront" or node2.node_type == "waterfront":
            return "highway"
        else:
            return "residential"
    
    @staticmethod
    def _calculate_lighting_score(node1: Node, node2: Node) -> float:
        """Calculate lighting score for edge."""
        if node1.node_type == "urban_center" or node2.node_type == "urban_center":
            return 0.9  # Well lit
        elif node1.node_type == "waterfront" or node2.node_type == "waterfront":
            return 0.4  # Poorly lit
        else:
            return 0.6  # Moderate lighting
    
    @staticmethod
    def _calculate_traffic_score(node1: Node, node2: Node) -> float:
        """Calculate foot traffic score for edge."""
        if node1.node_type == "urban_center" or node2.node_type == "urban_center":
            return 0.8  # High traffic
        elif node1.node_type == "waterfront" or node2.node_type == "waterfront":
            return 0.3  # Low traffic
        else:
            return 0.5  # Moderate traffic


class ProductionSafetyAwareAStar:
    """
    Production-ready Safety-Aware A* algorithm with enhanced features.
    """
    
    def __init__(self, graph: EnhancedUrbanGraph, safety_weight: float = 0.5):
        """Initialize enhanced SA-A* algorithm."""
        self.graph = graph
        self.safety_weight = safety_weight
        self.distance_weight = 1.0 - safety_weight
        
    def heuristic(self, node: Node, goal: Node) -> float:
        """Enhanced heuristic with safety considerations."""
        # Distance heuristic
        distance_h = geodesic((node.lat, node.lng), (goal.lat, goal.lng)).kilometers
        
        # Safety heuristic
        safety_h = goal.uti_score
        
        # Combined heuristic
        return self.distance_weight * distance_h + self.safety_weight * safety_h
    
    def calculate_edge_cost(self, edge: Edge) -> float:
        """Enhanced edge cost calculation."""
        distance_cost = edge.distance_km
        safety_cost = edge.get_safety_cost()
        
        # Road type modifier
        road_modifiers = {
            "highway": 0.8,      # Faster but potentially less safe
            "arterial": 1.0,     # Balanced
            "residential": 1.2,  # Slower but potentially safer
            "pedestrian": 1.5    # Slowest but safest
        }
        
        road_modifier = road_modifiers.get(edge.road_type, 1.0)
        
        return (self.distance_weight * distance_cost + 
                self.safety_weight * safety_cost) * road_modifier
    
    async def find_enhanced_path(self, start_coord: Tuple[float, float], 
                               end_coord: Tuple[float, float]) -> Optional[Dict[str, Any]]:
        """Find enhanced path with OSRM integration."""
        # Try OSRM first for realistic routing
        osrm_route = await self.graph.get_osrm_route(start_coord, end_coord)
        
        if osrm_route:
            return await self._process_osrm_route(osrm_route, start_coord, end_coord)
        else:
            # Fallback to graph-based routing
            return self.find_path(start_coord, end_coord)
    
    async def _process_osrm_route(self, osrm_route: List[Tuple[float, float]], 
                                start_coord: Tuple[float, float], 
                                end_coord: Tuple[float, float]) -> Dict[str, Any]:
        """Process OSRM route and add safety analysis."""
        # Convert to GeoJSON format
        coordinates = [[lng, lat] for lat, lng in osrm_route]
        
        # Calculate total distance
        total_distance = 0.0
        for i in range(len(osrm_route) - 1):
            segment_distance = geodesic(osrm_route[i], osrm_route[i + 1]).kilometers
            total_distance += segment_distance
        
        # Analyze safety along the route
        threat_segments = await self._analyze_route_safety(osrm_route)
        
        # Calculate overall safety score
        if threat_segments:
            avg_uti = sum(seg['uti_score'] for seg in threat_segments) / len(threat_segments)
            safety_score = max(0.1, 1.0 - avg_uti)
        else:
            safety_score = 0.8  # Default good safety score
        
        # Estimate travel time (walking speed: 5 km/h)
        estimated_time = int((total_distance / 5.0) * 60)
        
        return {
            'path': {
                'type': 'LineString',
                'coordinates': coordinates
            },
            'safety_score': safety_score,
            'distance_km': round(total_distance, 2),
            'estimated_time_minutes': estimated_time,
            'threat_segments': threat_segments,
            'route_type': 'osrm_enhanced',
            'algorithm_config': {
                'safety_weight': self.safety_weight,
                'distance_weight': self.distance_weight,
                'routing_service': 'OSRM'
            }
        }
    
    async def _analyze_route_safety(self, route_points: List[Tuple[float, float]]) -> List[Dict[str, Any]]:
        """Analyze safety along the route."""
        threat_segments = []
        segment_size = max(1, len(route_points) // 10)  # Divide into ~10 segments
        
        for i in range(0, len(route_points) - segment_size, segment_size):
            segment_start = i
            segment_end = min(i + segment_size, len(route_points) - 1)
            
            # Calculate average UTI for this segment
            segment_points = route_points[segment_start:segment_end + 1]
            avg_uti = self._calculate_segment_uti(segment_points)
            
            if avg_uti > 0.4:  # Threshold for threat segment
                threat_segments.append({
                    'start_idx': segment_start,
                    'end_idx': segment_end,
                    'uti_score': avg_uti,
                    'reason': self._get_threat_reason(avg_uti, segment_points),
                    'mitigation': self._get_mitigation_advice(avg_uti, segment_points)
                })
        
        return threat_segments
    
    def _calculate_segment_uti(self, segment_points: List[Tuple[float, float]]) -> float:
        """Calculate UTI score for a route segment."""
        if not segment_points:
            return 0.0
        
        # Calculate average UTI based on location characteristics
        total_uti = 0.0
        for lat, lng in segment_points:
            # Distance from safe areas (simplified)
            manhattan_center = (40.7589, -73.9851)
            distance_from_center = geodesic((lat, lng), manhattan_center).kilometers
            
            # Base UTI increases with distance from center
            base_uti = min(0.7, distance_from_center * 0.15)
            
            # Add location-specific factors
            if lng < -74.0050:  # Near Hudson River
                base_uti += 0.2
            elif lng > -73.9400:  # Near East River
                base_uti += 0.15
            
            # Time-based factors (would be enhanced with real-time data)
            current_hour = datetime.now().hour
            if 22 <= current_hour or current_hour <= 5:
                base_uti += 0.2
            
            total_uti += min(0.9, base_uti)
        
        return total_uti / len(segment_points)
    
    def find_path(self, start_coord: Tuple[float, float], 
                  end_coord: Tuple[float, float]) -> Optional[Dict[str, Any]]:
        """Fallback graph-based pathfinding."""
        start_node = self._find_nearest_node(start_coord)
        end_node = self._find_nearest_node(end_coord)
        
        if not start_node or not end_node:
            logger.error("Could not find start or end nodes in graph")
            return None
        
        return self._a_star_search(start_node, end_node)
    
    def _find_nearest_node(self, coord: Tuple[float, float]) -> Optional[Node]:
        """Find the nearest node to given coordinates."""
        min_distance = float('inf')
        nearest_node = None
        
        for node in self.graph.nodes.values():
            distance = geodesic(coord, (node.lat, node.lng)).kilometers
            if distance < min_distance:
                min_distance = distance
                nearest_node = node
        
        return nearest_node
    
    def _a_star_search(self, start_node: Node, end_node: Node) -> Optional[Dict[str, Any]]:
        """Enhanced A* search implementation."""
        open_set = []
        closed_set: Set[str] = set()
        path_nodes: Dict[str, PathNode] = {}
        
        start_path = PathNode(
            node=start_node,
            g_cost=0.0,
            h_cost=self.heuristic(start_node, end_node)
        )
        start_path.f_cost = start_path.g_cost + start_path.h_cost
        
        path_nodes[start_node.id] = start_path
        heapq.heappush(open_set, start_path)
        
        nodes_explored = 0
        max_explorations = 15000
        
        while open_set and nodes_explored < max_explorations:
            current_path = heapq.heappop(open_set)
            current_node = current_path.node
            
            nodes_explored += 1
            
            if current_node.id == end_node.id:
                return self._reconstruct_enhanced_path(current_path, start_node, end_node)
            
            closed_set.add(current_node.id)
            
            for edge in self.graph.get_neighbors(current_node.id):
                neighbor = edge.to_node
                
                if neighbor.id in closed_set:
                    continue
                
                edge_cost = self.calculate_edge_cost(edge)
                tentative_g_cost = current_path.g_cost + edge_cost
                
                if neighbor.id not in path_nodes:
                    neighbor_path = PathNode(node=neighbor)
                    path_nodes[neighbor.id] = neighbor_path
                else:
                    neighbor_path = path_nodes[neighbor.id]
                
                if tentative_g_cost < neighbor_path.g_cost:
                    neighbor_path.parent = current_path
                    neighbor_path.g_cost = tentative_g_cost
                    neighbor_path.h_cost = self.heuristic(neighbor, end_node)
                    neighbor_path.f_cost = neighbor_path.g_cost + neighbor_path.h_cost
                    
                    if neighbor_path not in open_set:
                        heapq.heappush(open_set, neighbor_path)
        
        logger.warning(f"No path found after exploring {nodes_explored} nodes")
        return None
    
    def _reconstruct_enhanced_path(self, end_path: PathNode, start_node: Node, 
                                 end_node: Node) -> Dict[str, Any]:
        """Reconstruct path with enhanced information."""
        path_nodes = []
        current = end_path
        
        while current is not None:
            path_nodes.append(current)
            current = current.parent
        
        path_nodes.reverse()
        
        # Build enhanced route information
        coordinates = []
        total_distance = 0.0
        total_safety_cost = 0.0
        threat_segments = []
        
        for i in range(len(path_nodes) - 1):
            from_node = path_nodes[i].node
            to_node = path_nodes[i + 1].node
            
            edge = None
            for e in self.graph.get_neighbors(from_node.id):
                if e.to_node.id == to_node.id:
                    edge = e
                    break
            
            if edge:
                coordinates.append([from_node.lng, from_node.lat])
                total_distance += edge.distance_km
                total_safety_cost += edge.get_safety_cost()
                
                if edge.avg_uti_score > 0.5:
                    threat_segments.append({
                        'start_idx': i,
                        'end_idx': i + 1,
                        'uti_score': edge.avg_uti_score,
                        'reason': self._get_threat_reason(edge.avg_uti_score, [(from_node.lat, from_node.lng)]),
                        'mitigation': self._get_mitigation_advice(edge.avg_uti_score, [(from_node.lat, from_node.lng)])
                    })
        
        if path_nodes:
            final_node = path_nodes[-1].node
            coordinates.append([final_node.lng, final_node.lat])
        
        safety_score = max(0.0, 1.0 - (total_safety_cost / len(path_nodes))) if path_nodes else 0.0
        estimated_time = int((total_distance / 5.0) * 60)
        
        return {
            'path': {
                'type': 'LineString',
                'coordinates': coordinates
            },
            'safety_score': safety_score,
            'distance_km': round(total_distance, 2),
            'estimated_time_minutes': estimated_time,
            'threat_segments': threat_segments,
            'route_type': 'graph_based',
            'nodes_explored': len(path_nodes),
            'algorithm_config': {
                'safety_weight': self.safety_weight,
                'distance_weight': self.distance_weight
            }
        }
    
    def _get_threat_reason(self, uti_score: float, points: List[Tuple[float, float]]) -> str:
        """Generate enhanced threat reason."""
        reasons = []
        
        if uti_score > 0.7:
            reasons.append("High crime prediction area")
        elif uti_score > 0.5:
            reasons.append("Moderate risk area")
        
        # Check location-specific factors
        if points:
            lat, lng = points[0]
            if lng < -74.0050:
                reasons.append("Waterfront area with limited visibility")
            elif lng > -73.9400:
                reasons.append("Industrial area with reduced foot traffic")
        
        # Time-based factors
        current_hour = datetime.now().hour
        if 22 <= current_hour or current_hour <= 5:
            reasons.append("Late night/early morning hours")
        
        return "; ".join(reasons) if reasons else "Elevated risk area"
    
    def _get_mitigation_advice(self, uti_score: float, points: List[Tuple[float, float]]) -> str:
        """Generate enhanced mitigation advice."""
        advice = []
        
        if uti_score > 0.7:
            advice.extend(["Consider alternative route", "Travel with others"])
        elif uti_score > 0.5:
            advice.extend(["Stay alert", "Avoid distractions"])
        
        # Location-specific advice
        if points:
            lat, lng = points[0]
            if lng < -74.0050 or lng > -73.9400:
                advice.append("Use well-lit main roads")
        
        # Time-based advice
        current_hour = datetime.now().hour
        if 22 <= current_hour or current_hour <= 5:
            advice.append("Consider daytime travel")
        
        return "; ".join(advice) if advice else "Exercise normal caution"


class EnhancedRouteOptimizer:
    """
    Enhanced route optimizer with production features.
    """
    
    def __init__(self):
        """Initialize enhanced route optimizer."""
        self.graph: Optional[EnhancedUrbanGraph] = None
        self.sa_astar: Optional[ProductionSafetyAwareAStar] = None
        
    def initialize_graph(self, area_bounds: Dict[str, Tuple[float, float]]) -> bool:
        """Initialize enhanced routing graph."""
        try:
            sw_lat, sw_lng = area_bounds['sw']
            ne_lat, ne_lng = area_bounds['ne']
            
            # Create denser grid for better routing
            coordinates = []
            lat_steps = np.linspace(sw_lat, ne_lat, 25)
            lng_steps = np.linspace(sw_lng, ne_lng, 25)
            
            for lat in lat_steps:
                for lng in lng_steps:
                    coordinates.append((lat, lng))
            
            # Create enhanced graph
            self.graph = EnhancedUrbanGraph.create_enhanced_graph(
                coordinates, 
                connection_threshold_km=0.2
            )
            
            logger.info(f"✅ Enhanced routing graph initialized with {len(self.graph.nodes)} nodes")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize enhanced graph: {e}")
            return False
    
    def calculate_safe_route(self, 
                           start_coord: Tuple[float, float],
                           end_coord: Tuple[float, float],
                           safety_weight: float = 0.5,
                           uti_predictions: Optional[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        """Calculate enhanced safe route."""
        if not self.graph:
            logger.error("Graph not initialized")
            return None
        
        try:
            # Update UTI scores if provided
            if uti_predictions:
                self.graph.update_uti_scores(uti_predictions)
            
            # Create enhanced SA-A* instance
            self.sa_astar = ProductionSafetyAwareAStar(self.graph, safety_weight)
            
            # Calculate route with OSRM integration
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                route_result = loop.run_until_complete(
                    self.sa_astar.find_enhanced_path(start_coord, end_coord)
                )
            finally:
                loop.close()
            
            if route_result:
                logger.info(f"✅ Enhanced route calculated: {route_result['distance_km']}km, "
                          f"safety score: {route_result['safety_score']:.2f}")
            
            return route_result
            
        except Exception as e:
            logger.error(f"❌ Enhanced route calculation failed: {e}")
            return None
    
    def get_alternative_routes(self,
                             start_coord: Tuple[float, float],
                             end_coord: Tuple[float, float],
                             num_alternatives: int = 3) -> List[Dict[str, Any]]:
        """Generate enhanced alternative routes."""
        alternatives = []
        
        # Generate routes with different safety weights
        safety_weights = np.linspace(0.1, 0.9, num_alternatives)
        
        for weight in safety_weights:
            route = self.calculate_safe_route(start_coord, end_coord, safety_weight=weight)
            if route:
                route['route_type'] = self._classify_enhanced_route_type(weight)
                route['optimization_focus'] = self._get_optimization_focus(weight)
                alternatives.append(route)
        
        # Sort by combined score
        alternatives.sort(
            key=lambda r: r['safety_score'] * 0.6 + (1.0 / (r['distance_km'] + 1)) * 0.4, 
            reverse=True
        )
        
        return alternatives
    
    def _classify_enhanced_route_type(self, safety_weight: float) -> str:
        """Classify route type with enhanced categories."""
        if safety_weight < 0.3:
            return "fastest_route"
        elif safety_weight > 0.7:
            return "safest_route"
        else:
            return "balanced_route"
    
    def _get_optimization_focus(self, safety_weight: float) -> str:
        """Get optimization focus description."""
        if safety_weight < 0.3:
            return "Optimized for speed and efficiency"
        elif safety_weight > 0.7:
            return "Optimized for maximum safety"
        else:
            return "Balanced optimization for safety and efficiency"


# Global enhanced route optimizer instance
route_optimizer = EnhancedRouteOptimizer()