import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  RouteWaypoint,
  TripPlanResponse,
} from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef } from "react";
import type { LayerProps } from "react-map-gl/mapbox";
import {
  Layer,
  Map,
  type MapRef,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/mapbox";

interface MapPanelProps {
  locations: LocationSelectionMap;
  route?: TripPlanResponse["route"];
}

const fieldLabels: Record<LocationFieldKey, string> = {
  current_location: "Current",
  pickup_location: "Pickup",
  dropoff_location: "Dropoff",
};

const routeLineLayer: LayerProps = {
  id: "planned-route-line",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#22d3ee",
    "line-width": 5,
    "line-opacity": 0.9,
  },
};

export function MapPanel({ locations, route }: MapPanelProps) {
  const mapRef = useRef<MapRef>(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const routeCoordinates = useMemo(
    () => route?.geometry.coordinates ?? [],
    [route?.geometry.coordinates],
  );
  const selectedCoordinates = useMemo(
    () =>
      Object.values(locations)
        .map((location) => location.coordinates)
        .filter(
          (coordinates): coordinates is Coordinates => coordinates !== null,
        ),
    [locations],
  );
  const cameraCoordinates = routeCoordinates.length
    ? routeCoordinates
    : selectedCoordinates;
  const routeFeature = useMemo(
    () =>
      route
        ? {
            type: "Feature" as const,
            geometry: route.geometry,
            properties: {},
          }
        : null,
    [route],
  );
  const cameraKey = cameraCoordinates
    .map((coordinate) => coordinate.join(","))
    .join("|");

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCoordinates.length) {
      return;
    }

    const bounds = getBounds(cameraCoordinates);
    if (!bounds) {
      return;
    }

    if (cameraCoordinates.length === 1) {
      const [longitude, latitude] = cameraCoordinates[0];
      map.easeTo({ center: [longitude, latitude], zoom: 8, duration: 500 });
      return;
    }

    map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 500 });
  }, [cameraCoordinates, cameraKey]);

  if (!mapboxToken) {
    return <MapFallback route={route} />;
  }

  return (
    <Card className="print:hidden" aria-label="Route map">
      <CardHeader>
        <CardDescription>Route map</CardDescription>
        <CardTitle>{route ? "Live route map" : "Selected locations"}</CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {selectedCoordinates.length} selected
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="h-[min(58vh,560px)] min-h-[360px] overflow-hidden rounded-xl bg-muted max-[900px]:min-h-[310px] max-[560px]:min-h-[280px]">
          <Map
            ref={mapRef}
            initialViewState={{
              longitude: -98.5795,
              latitude: 39.8283,
              zoom: 3.2,
            }}
            mapboxAccessToken={mapboxToken}
            mapStyle="mapbox://styles/mapbox/navigation-night-v1"
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" />
            {routeFeature ? (
              <Source id="planned-route" type="geojson" data={routeFeature}>
                <Layer {...routeLineLayer} />
              </Source>
            ) : null}
            {route
              ? route.waypoints.map((waypoint) => (
                  <Marker
                    key={`${waypoint.label}-${waypoint.location}`}
                    longitude={waypoint.coordinates[0]}
                    latitude={waypoint.coordinates[1]}
                    anchor="bottom"
                  >
                    <WaypointMarker waypoint={waypoint} />
                  </Marker>
                ))
              : Object.entries(locations).map(([field, location]) =>
                  location.coordinates ? (
                    <Marker
                      key={field}
                      longitude={location.coordinates[0]}
                      latitude={location.coordinates[1]}
                      anchor="bottom"
                    >
                      <Badge>{fieldLabels[field as LocationFieldKey]}</Badge>
                    </Marker>
                  ) : null,
                )}
          </Map>
        </div>
      </CardContent>
    </Card>
  );
}

function MapFallback({ route }: Pick<MapPanelProps, "route">) {
  return (
    <Card className="print:hidden" aria-label="Route map fallback">
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Map token not configured</EmptyTitle>
            <EmptyDescription>
              Add a public <code>VITE_MAPBOX_TOKEN</code> to enable autocomplete
              markers and the interactive route map.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
      {route ? (
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {formatNumber(route.distance_miles)} mi
            </Badge>
            <Badge variant="secondary">
              {formatNumber(route.duration_hours)} hr
            </Badge>
            <Badge variant="secondary">{route.waypoints.length} stops</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {route.waypoints.map((waypoint) => (
              <Badge
                key={`${waypoint.label}-${waypoint.location}`}
                variant="outline"
              >
                {waypoint.label}: {waypoint.location}
              </Badge>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function WaypointMarker({ waypoint }: { waypoint: RouteWaypoint }) {
  return <Badge>{waypoint.label}</Badge>;
}

function getBounds(
  coordinates: Coordinates[],
): [number, number, number, number] | null {
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}
