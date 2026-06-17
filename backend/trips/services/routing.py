import os

import requests


GEOCODING_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving/{}'
METERS_PER_MILE = 1609.344


class RoutingError(Exception):
    pass


def geocode_location(location: str, coordinates: list[float] | None = None) -> dict:
    if _is_coordinate_pair(coordinates):
        return {
            'location': location,
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
        'location': location,
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


def _is_coordinate_pair(value) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    )
