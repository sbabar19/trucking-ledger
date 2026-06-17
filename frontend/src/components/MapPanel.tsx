import 'mapbox-gl/dist/mapbox-gl.css';
import { Layer, Map, Marker, NavigationControl, Source } from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import type { Coordinates, RouteWaypoint, TripPlanResponse } from '../types';

interface MapPanelProps {
  route: TripPlanResponse['route'];
}

const routeLineLayer: LayerProps = {
  id: 'planned-route-line',
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': '#22d3ee',
    'line-width': 5,
    'line-opacity': 0.9,
  },
};

export function MapPanel({ route }: MapPanelProps) {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const bounds = getBounds(route.geometry.coordinates);
  const firstWaypoint = route.waypoints[0];
  const routeFeature = {
    type: 'Feature' as const,
    geometry: route.geometry,
    properties: {},
  };

  if (!mapboxToken) {
    return <MapFallback route={route} />;
  }

  return (
    <section className="planner-card map-card" aria-label="Route map">
      <div className="card-header map-header">
        <div>
          <p className="section-kicker">Route overview</p>
          <h2>Live route map</h2>
        </div>
        <span className="status-pill status-pill-cyan">Mapbox connected</span>
      </div>

      <div className="map-frame">
        <Map
          initialViewState={
            bounds
              ? { bounds, fitBoundsOptions: { padding: 70, maxZoom: 12 } }
              : {
                  longitude: firstWaypoint?.coordinates[0] ?? -98.5795,
                  latitude: firstWaypoint?.coordinates[1] ?? 39.8283,
                  zoom: 3.2,
                }
          }
          mapboxAccessToken={mapboxToken}
          mapStyle="mapbox://styles/mapbox/navigation-night-v1"
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" />
          <Source id="planned-route" type="geojson" data={routeFeature}>
            <Layer {...routeLineLayer} />
          </Source>
          {route.waypoints.map((waypoint) => (
            <Marker
              key={`${waypoint.label}-${waypoint.location}`}
              longitude={waypoint.coordinates[0]}
              latitude={waypoint.coordinates[1]}
              anchor="bottom"
            >
              <WaypointMarker waypoint={waypoint} />
            </Marker>
          ))}
        </Map>
      </div>
    </section>
  );
}

function MapFallback({ route }: MapPanelProps) {
  return (
    <section className="planner-card map-card map-fallback" aria-label="Route map fallback">
      <div className="card-header">
        <p className="section-kicker">Route overview</p>
        <h2>Map token not configured</h2>
      </div>
      <p>
        Add a public <code>VITE_MAPBOX_TOKEN</code> to enable the interactive route map. The planned route details are still available.
      </p>
      <div className="fallback-stats">
        <span>{formatNumber(route.distance_miles)} mi</span>
        <span>{formatNumber(route.duration_hours)} hr</span>
        <span>{route.waypoints.length} stops</span>
      </div>
      <div className="waypoint-list">
        {route.waypoints.map((waypoint) => (
          <span key={`${waypoint.label}-${waypoint.location}`}>{waypoint.label}: {waypoint.location}</span>
        ))}
      </div>
    </section>
  );
}

function WaypointMarker({ waypoint }: { waypoint: RouteWaypoint }) {
  return (
    <div className="waypoint-marker">
      <span>{waypoint.label}</span>
    </div>
  );
}

function getBounds(coordinates: Coordinates[]): [number, number, number, number] | null {
  if (!coordinates.length) {
    return null;
  }

  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}
