from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import TripPlanRequestSerializer
from .services.hos import build_schedule, TripLeg
from .services.routing import get_route, RoutingError


@api_view(['POST'])
def plan_trip(request):
    serializer = TripPlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        route = get_route(
            data['current_location'],
            data['pickup_location'],
            data['dropoff_location'],
            data.get('current_coordinates'),
            data.get('pickup_coordinates'),
            data.get('dropoff_coordinates'),
        )
    except RoutingError as exc:
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE if 'MAPBOX_ACCESS_TOKEN' in str(exc) else status.HTTP_502_BAD_GATEWAY
        return Response({'detail': str(exc)}, status=status_code)

    legs = [
        TripLeg(
            'pickup',
            route['legs'][0]['distance_miles'],
            route['legs'][0]['duration_hours'],
            data['current_location'],
            data['pickup_location'],
        ),
        TripLeg(
            'dropoff',
            route['legs'][1]['distance_miles'],
            route['legs'][1]['duration_hours'],
            data['pickup_location'],
            data['dropoff_location'],
        ),
    ]

    return Response({
        'route': {
            'distance_miles': route['distance_miles'],
            'duration_hours': route['duration_hours'],
            'geometry': route['geometry'],
            'waypoints': route['waypoints'],
            'instructions': route['instructions'],
        },
        'schedule': build_schedule(legs, data['current_cycle_used']),
    })
