import type { Coordinates } from "@/types";

const EARTH_RADIUS_MILES = 3958.7613;

export function interpolateRouteCoordinate(
  coordinates: Coordinates[],
  routeMile: number,
  routeDistanceMiles: number,
): Coordinates | null {
  const validCoordinates = coordinates.filter(isCoordinatePair);
  if (!validCoordinates.length) {
    return null;
  }

  if (validCoordinates.length === 1) {
    return validCoordinates[0];
  }

  const segmentDistances = validCoordinates
    .slice(0, -1)
    .map((coordinate, index) =>
      haversineMiles(coordinate, validCoordinates[index + 1]),
    );
  const geometryDistance = segmentDistances.reduce(
    (sum, distance) => sum + distance,
    0,
  );

  if (geometryDistance <= 0) {
    return validCoordinates[0];
  }

  const routeRatio =
    routeDistanceMiles > 0 ? clamp(routeMile / routeDistanceMiles, 0, 1) : 0;
  const targetDistance = geometryDistance * routeRatio;
  let cursor = 0;

  for (const [index, segmentDistance] of segmentDistances.entries()) {
    if (cursor + segmentDistance >= targetDistance) {
      const fraction =
        segmentDistance > 0 ? (targetDistance - cursor) / segmentDistance : 0;
      const start = validCoordinates[index];
      const end = validCoordinates[index + 1];
      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ];
    }

    cursor += segmentDistance;
  }

  return validCoordinates.at(-1) ?? null;
}

export function haversineMiles(
  start: Coordinates,
  end: Coordinates,
): number {
  const startLongitude = toRadians(start[0]);
  const startLatitude = toRadians(start[1]);
  const endLongitude = toRadians(end[0]);
  const endLatitude = toRadians(end[1]);
  const longitudeDelta = endLongitude - startLongitude;
  const latitudeDelta = endLatitude - startLatitude;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(value));
}

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isCoordinatePair(value: unknown): value is Coordinates {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}
