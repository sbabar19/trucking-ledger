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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  RouteWaypoint,
  TripPlanResponse,
} from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LayerProps } from "react-map-gl/mapbox";
import {
  Layer,
  Map,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/mapbox";

interface MapPanelProps {
  activeField: LocationFieldKey;
  locations: LocationSelectionMap;
  route?: TripPlanResponse["route"];
  onActivateField: (field: LocationFieldKey) => void;
  onMapClick: (coordinates: Coordinates) => void;
}

const fieldConfig: Record<
  LocationFieldKey,
  { label: string; className: string }
> = {
  current_location: { label: "Current", className: "waypoint-current" },
  pickup_location: { label: "Pickup", className: "waypoint-pickup" },
  dropoff_location: { label: "Dropoff", className: "waypoint-dropoff" },
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

export function MapPanel({
  activeField,
  locations,
  route,
  onActivateField,
  onMapClick,
}: MapPanelProps) {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const routeCoordinates = route?.geometry.coordinates ?? [];
  const selectedCoordinates = Object.values(locations)
    .map((location) => location.coordinates)
    .filter((coordinates): coordinates is Coordinates => coordinates !== null);
  const bounds = getBounds(
    routeCoordinates.length ? routeCoordinates : selectedCoordinates,
  );
  const center = getCenter(selectedCoordinates);
  const routeFeature = route
    ? {
        type: "Feature" as const,
        geometry: route.geometry,
        properties: {},
      }
    : null;
  const mapKey = `${route ? "route" : "draft"}:${activeField}:${selectedCoordinates.map((coordinate) => coordinate.join(",")).join("|")}`;

  if (!mapboxToken) {
    return <MapFallback route={route} />;
  }

  return (
    <Card className="print:hidden" aria-label="Route map">
      <CardHeader>
        <CardDescription>Route map</CardDescription>
        <CardTitle>
          {route ? "Live route map" : "Place locations on the map"}
        </CardTitle>
        <CardAction>
          <Badge>{fieldConfig[activeField].label}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={activeField}
          onValueChange={(field) => {
            if (field) {
              onActivateField(field as LocationFieldKey);
            }
          }}
          aria-label="Map location target"
        >
          {Object.entries(fieldConfig).map(([field, config]) => (
            <ToggleGroupItem key={field} value={field}>
              {config.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="h-[min(58vh,560px)] min-h-[360px] overflow-hidden rounded-xl bg-muted max-[900px]:min-h-[310px] max-[560px]:min-h-[280px]">
          <Map
            key={mapKey}
            initialViewState={
              bounds
                ? { bounds, fitBoundsOptions: { padding: 70, maxZoom: 12 } }
                : {
                    longitude: center?.[0] ?? -98.5795,
                    latitude: center?.[1] ?? 39.8283,
                    zoom: 3.2,
                  }
            }
            mapboxAccessToken={mapboxToken}
            mapStyle="mapbox://styles/mapbox/navigation-night-v1"
            style={{ width: "100%", height: "100%" }}
            onClick={(event) =>
              onMapClick([event.lngLat.lng, event.lngLat.lat])
            }
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
                      <div
                        className={`draft-waypoint-marker ${fieldConfig[field as LocationFieldKey].className}`}
                      >
                        <span>
                          {fieldConfig[field as LocationFieldKey].label}
                        </span>
                      </div>
                    </Marker>
                  ) : null,
                )}
          </Map>
        </div>

        <CardDescription>
          Click the map to fill the highlighted field. Once the trip is planned,
          this same map shows the route.
        </CardDescription>
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
              Add a public <code>VITE_MAPBOX_TOKEN</code> to enable
              click-to-pick locations, autocomplete, and the interactive route
              map.
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
  return (
    <div className="waypoint-marker">
      <span>{waypoint.label}</span>
    </div>
  );
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

function getCenter(coordinates: Coordinates[]): Coordinates | null {
  if (!coordinates.length) {
    return null;
  }

  const longitude =
    coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) /
    coordinates.length;
  const latitude =
    coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
    coordinates.length;
  return [longitude, latitude];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}
