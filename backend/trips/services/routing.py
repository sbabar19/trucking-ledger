import os
from math import asin, cos, radians, sin, sqrt

import requests


GEOCODING_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
REVERSE_GEOCODING_URL = 'https://api.mapbox.com/search/geocode/v6/reverse'
DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving/{}'
METERS_PER_MILE = 1609.344
EARTH_RADIUS_MILES = 3958.7613


class RoutingError(Exception):
    pass


def geocode_location(location: str, coordinates: list[float] | None = None) -> dict:
    if _is_coordinate_pair(coordinates):
        return {
            'location': _format_location_text(location),
            'coordinates': [float(coordinates[0]), float(coordinates[1])],
        }

    token = _get_access_token()
    try:
        response = requests.get(
            GEOCODING_URL,
            params={
                'q': location,
                'access_token': token,
                'limit': 1,
                'country': 'us',
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise RoutingError('Mapbox geocoding request failed') from exc
    except ValueError as exc:
        raise RoutingError('Mapbox geocoding response was invalid') from exc

    features = payload.get('features') or []
    if not features:
        raise RoutingError(f'No Mapbox geocoding result for {location}')

    coordinates = features[0].get('geometry', {}).get('coordinates')
    if not _is_coordinate_pair(coordinates):
        raise RoutingError(f'Mapbox geocoding result was invalid for {location}')

    return {
        'location': _format_geocode_feature(features[0]) or _format_location_text(location),
        'coordinates': [float(coordinates[0]), float(coordinates[1])],
    }


def get_route(
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    current_coordinates: list[float] | None = None,
    pickup_coordinates: list[float] | None = None,
    dropoff_coordinates: list[float] | None = None,
) -> dict:
    waypoints = [
        {'label': 'Current', **geocode_location(current_location, current_coordinates)},
        {'label': 'Pickup', **geocode_location(pickup_location, pickup_coordinates)},
        {'label': 'Dropoff', **geocode_location(dropoff_location, dropoff_coordinates)},
    ]
    coordinate_path = ';'.join(
        f'{waypoint["coordinates"][0]},{waypoint["coordinates"][1]}'
        for waypoint in waypoints
    )
    token = _get_access_token()

    try:
        response = requests.get(
            DIRECTIONS_URL.format(coordinate_path),
            params={
                'access_token': token,
                'geometries': 'geojson',
                'overview': 'full',
                'steps': 'true',
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise RoutingError('Mapbox directions request failed') from exc
    except ValueError as exc:
        raise RoutingError('Mapbox directions response was invalid') from exc

    routes = payload.get('routes') or []
    if not routes:
        raise RoutingError('Mapbox directions response did not include a route')

    route = routes[0]
    legs = [_format_leg(leg) for leg in route.get('legs') or []]
    if len(legs) != 2:
        raise RoutingError('Mapbox directions response did not include expected legs')

    return {
        'distance_miles': round(route.get('distance', 0) / METERS_PER_MILE, 2),
        'duration_hours': round(route.get('duration', 0) / 3600, 2),
        'geometry': route.get('geometry') or {'type': 'LineString', 'coordinates': []},
        'waypoints': waypoints,
        'instructions': [instruction for leg in legs for instruction in leg['instructions']],
        'legs': legs,
    }


def build_route_location_resolver(geometry: dict, route_distance_miles: float):
    cache: dict[float, str] = {}

    def resolve(route_mile: float) -> str:
        cache_key = round(max(route_mile, 0.0), 1)
        if cache_key not in cache:
            coordinate = interpolate_route_coordinate(geometry, cache_key, route_distance_miles)
            if coordinate:
                try:
                    cache[cache_key] = reverse_geocode_coordinates(coordinate)
                except RoutingError:
                    cache[cache_key] = _route_mile_label(cache_key)
            else:
                cache[cache_key] = _route_mile_label(cache_key)
        return cache[cache_key]

    return resolve


def interpolate_route_coordinate(geometry: dict, route_mile: float, route_distance_miles: float) -> list[float] | None:
    coordinates = geometry.get('coordinates') if isinstance(geometry, dict) else None
    if not coordinates:
        return None

    valid_coordinates = [coordinate for coordinate in coordinates if _is_coordinate_pair(coordinate)]
    if not valid_coordinates:
        return None
    if len(valid_coordinates) == 1:
        return [float(valid_coordinates[0][0]), float(valid_coordinates[0][1])]

    segment_distances = [
        _haversine_miles(valid_coordinates[index], valid_coordinates[index + 1])
        for index in range(len(valid_coordinates) - 1)
    ]
    geometry_distance = sum(segment_distances)
    if geometry_distance <= 0:
        return [float(valid_coordinates[0][0]), float(valid_coordinates[0][1])]

    route_ratio = route_mile / route_distance_miles if route_distance_miles > 0 else 0.0
    target_distance = geometry_distance * min(max(route_ratio, 0.0), 1.0)
    cursor = 0.0

    for index, segment_distance in enumerate(segment_distances):
        if cursor + segment_distance >= target_distance:
            fraction = (target_distance - cursor) / segment_distance if segment_distance > 0 else 0.0
            start = valid_coordinates[index]
            end = valid_coordinates[index + 1]
            return [
                float(start[0]) + (float(end[0]) - float(start[0])) * fraction,
                float(start[1]) + (float(end[1]) - float(start[1])) * fraction,
            ]
        cursor += segment_distance

    last_coordinate = valid_coordinates[-1]
    return [float(last_coordinate[0]), float(last_coordinate[1])]


def reverse_geocode_coordinates(coordinates: list[float]) -> str:
    token = _get_access_token()
    try:
        response = requests.get(
            REVERSE_GEOCODING_URL,
            params={
                'longitude': coordinates[0],
                'latitude': coordinates[1],
                'access_token': token,
                'country': 'us',
                'types': 'address,place,locality',
                'limit': 1,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise RoutingError('Mapbox reverse geocoding request failed') from exc
    except ValueError as exc:
        raise RoutingError('Mapbox reverse geocoding response was invalid') from exc

    features = payload.get('features') or []
    for feature in features:
        location = _format_reverse_geocode_feature(feature)
        if location:
            return location

    raise RoutingError('Mapbox reverse geocoding response did not include a usable location')


def _get_access_token() -> str:
    token = os.environ.get('MAPBOX_ACCESS_TOKEN')
    if not token:
        raise RoutingError('MAPBOX_ACCESS_TOKEN is not configured')
    return token


def _format_leg(leg: dict) -> dict:
    steps = leg.get('steps') or []
    return {
        'distance_miles': round(leg.get('distance', 0) / METERS_PER_MILE, 2),
        'duration_hours': round(leg.get('duration', 0) / 3600, 2),
        'instructions': [
            {
                'text': step.get('maneuver', {}).get('instruction') or 'Continue',
                'distance_miles': round(step.get('distance', 0) / METERS_PER_MILE, 2),
                'duration_minutes': round(step.get('duration', 0) / 60, 2),
            }
            for step in steps
        ],
    }


def _format_reverse_geocode_feature(feature: dict) -> str | None:
    return _format_geocode_feature(feature)


def _format_geocode_feature(feature: dict) -> str | None:
    properties = feature.get('properties') or {}
    context = properties.get('context') or {}
    place = _context_name(context, 'place') or _context_name(context, 'locality')
    region = _region_code(context)

    if not place and properties.get('feature_type') in ('place', 'locality'):
        place = properties.get('name_preferred') or properties.get('name')

    if place and region:
        return f'{place}, {region}'

    fallback = properties.get('place_formatted') or properties.get('full_address')
    return _format_location_text(fallback) if fallback else None


def _format_location_text(location: str) -> str:
    location_parts = [
        part.strip()
        for part in str(location).split(',')
        if part.strip()
    ]
    if location_parts and location_parts[-1].lower() in ('united states', 'usa', 'us'):
        location_parts = location_parts[:-1]

    if len(location_parts) >= 2:
        return ', '.join(location_parts[-2:])

    return ', '.join(location_parts) or str(location)


def _context_name(context: dict, key: str) -> str | None:
    value = context.get(key)
    if isinstance(value, dict):
        name = value.get('name') or value.get('name_preferred')
        return str(name) if name else None
    return None


def _region_code(context: dict) -> str | None:
    region = context.get('region')
    if not isinstance(region, dict):
        return None

    region_code = region.get('region_code') or region.get('short_code') or region.get('region_code_full')
    if not region_code:
        return None

    code = str(region_code).upper()
    return code.split('-')[-1]


def _haversine_miles(start: list[float], end: list[float]) -> float:
    start_longitude, start_latitude = radians(float(start[0])), radians(float(start[1]))
    end_longitude, end_latitude = radians(float(end[0])), radians(float(end[1]))
    longitude_delta = end_longitude - start_longitude
    latitude_delta = end_latitude - start_latitude
    value = sin(latitude_delta / 2) ** 2 + cos(start_latitude) * cos(end_latitude) * sin(longitude_delta / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * asin(sqrt(value))


def _route_mile_label(route_mile: float) -> str:
    return f'near route mile {round(route_mile)}'


def _is_coordinate_pair(value) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    )
