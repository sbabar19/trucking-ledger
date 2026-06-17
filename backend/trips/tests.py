from django.test import TestCase
from unittest.mock import patch

from trips.services.hos import build_schedule, TripLeg
from trips.services.routing import RoutingError


VALID_REQUEST = {
    'current_location': 'Dallas, TX',
    'pickup_location': 'Phoenix, AZ',
    'dropoff_location': 'Los Angeles, CA',
    'current_cycle_used': 12.5,
}

VALID_REQUEST_WITH_COORDINATES = {
    **VALID_REQUEST,
    'current_coordinates': [-96.797, 32.7767],
    'pickup_coordinates': [-112.074, 33.4484],
    'dropoff_coordinates': [-118.2437, 34.0522],
}

MOCK_ROUTE = {
    'distance_miles': 1234.5,
    'duration_hours': 22.1,
    'geometry': {'type': 'LineString', 'coordinates': [[-96.8, 32.8], [-112.1, 33.4], [-118.2, 34.0]]},
    'waypoints': [
        {'label': 'Current', 'location': 'Dallas, TX', 'coordinates': [-96.8, 32.8]},
        {'label': 'Pickup', 'location': 'Phoenix, AZ', 'coordinates': [-112.1, 33.4]},
        {'label': 'Dropoff', 'location': 'Los Angeles, CA', 'coordinates': [-118.2, 34.0]},
    ],
    'instructions': [
        {'text': 'Head west', 'distance_miles': 10.2, 'duration_minutes': 12.4},
    ],
    'legs': [
        {'distance_miles': 600, 'duration_hours': 9, 'instructions': []},
        {'distance_miles': 400, 'duration_hours': 7, 'instructions': []},
    ],
}


class HOSTests(TestCase):
    def test_short_trip_has_service_events_without_required_breaks(self):
        schedule = build_schedule([
            TripLeg('pickup', 120, 2, 'Dallas, TX', 'Austin, TX'),
            TripLeg('dropoff', 180, 3, 'Austin, TX', 'Houston, TX'),
        ], current_cycle_used=12.5)

        remarks = [event['remarks'] for event in schedule['events']]
        self.assertIn('Pickup', remarks)
        self.assertIn('Dropoff', remarks)
        self.assertNotIn('Required 30-minute break', remarks)
        self.assertNotIn('Required 10-hour break', remarks)

    def test_trip_over_eight_hours_inserts_thirty_minute_break(self):
        schedule = build_schedule([
            TripLeg('pickup', 60, 1, 'A', 'B'),
            TripLeg('dropoff', 540, 9, 'B', 'C'),
        ], current_cycle_used=0)

        breaks = [event for event in schedule['events'] if event['remarks'] == 'Required 30-minute break']
        driving_after_break = [
            event for event in schedule['events']
            if event['status'] == 'driving' and event['start_hour'] >= breaks[0]['end_hour']
        ]
        self.assertTrue(breaks)
        self.assertEqual(breaks[0]['status'], 'off_duty')
        self.assertTrue(driving_after_break)

    def test_trip_over_eleven_hours_inserts_ten_hour_break(self):
        schedule = build_schedule([
            TripLeg('pickup', 60, 1, 'A', 'B'),
            TripLeg('dropoff', 720, 12, 'B', 'C'),
        ], current_cycle_used=0)

        breaks = [event for event in schedule['events'] if event['remarks'] == 'Required 10-hour break']
        self.assertTrue(breaks)
        self.assertEqual(breaks[0]['end_hour'] - breaks[0]['start_hour'], 10.0)

    def test_trip_over_one_thousand_miles_inserts_fuel_stop(self):
        schedule = build_schedule([
            TripLeg('pickup', 800, 8, 'A', 'B'),
            TripLeg('dropoff', 500, 5, 'B', 'C'),
        ], current_cycle_used=0)

        fuel_stops = [stop for stop in schedule['stops'] if stop['type'] == 'fuel']
        self.assertTrue(fuel_stops)
        self.assertEqual(fuel_stops[0]['duration_hours'], 0.25)

    def test_high_cycle_used_inserts_restart_before_exceeding_seventy_hours(self):
        schedule = build_schedule([
            TripLeg('pickup', 60, 1, 'A', 'B'),
            TripLeg('dropoff', 60, 1, 'B', 'C'),
        ], current_cycle_used=69.5)

        restart = [event for event in schedule['events'] if event['remarks'] == 'Required 34-hour restart']
        self.assertTrue(restart)
        self.assertEqual(restart[0]['end_hour'] - restart[0]['start_hour'], 34.0)

    def test_multi_day_trip_totals_sum_to_twenty_four_hours(self):
        schedule = build_schedule([
            TripLeg('pickup', 700, 10, 'A', 'B'),
            TripLeg('dropoff', 1200, 20, 'B', 'C'),
        ], current_cycle_used=0)

        self.assertGreater(len(schedule['days']), 1)
        for day in schedule['days']:
            self.assertEqual(round(sum(day['totals'].values()), 2), 24.0)


class TripPlanAPITests(TestCase):
    def test_invalid_empty_request_returns_400(self):
        response = self.client.post('/api/trips/plan/', data={}, content_type='application/json')

        self.assertEqual(response.status_code, 400)

    def test_cycle_used_below_zero_returns_400(self):
        payload = {**VALID_REQUEST, 'current_cycle_used': -0.1}
        response = self.client.post('/api/trips/plan/', data=payload, content_type='application/json')

        self.assertEqual(response.status_code, 400)

    def test_cycle_used_above_seventy_returns_400(self):
        payload = {**VALID_REQUEST, 'current_cycle_used': 70.1}
        response = self.client.post('/api/trips/plan/', data=payload, content_type='application/json')

        self.assertEqual(response.status_code, 400)

    @patch('trips.views.get_route', side_effect=RoutingError('MAPBOX_ACCESS_TOKEN is not configured'))
    def test_missing_mapbox_token_returns_503(self, mock_get_route):
        response = self.client.post('/api/trips/plan/', data=VALID_REQUEST, content_type='application/json')

        self.assertEqual(response.status_code, 503)
        mock_get_route.assert_called_once()

    @patch('trips.views.get_route', return_value=MOCK_ROUTE)
    def test_successful_request_returns_route_and_schedule(self, mock_get_route):
        response = self.client.post('/api/trips/plan/', data=VALID_REQUEST, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('route', payload)
        self.assertIn('schedule', payload)
        self.assertEqual(payload['route']['geometry']['type'], 'LineString')
        self.assertTrue(payload['route']['instructions'])
        self.assertTrue(payload['schedule']['stops'])
        self.assertTrue(payload['schedule']['events'])
        self.assertTrue(payload['schedule']['days'])
        self.assertTrue(payload['schedule']['days'][0]['segments'])
        mock_get_route.assert_called_once_with('Dallas, TX', 'Phoenix, AZ', 'Los Angeles, CA', None, None, None)

    @patch('trips.views.get_route', return_value=MOCK_ROUTE)
    def test_coordinates_are_forwarded_to_route_lookup(self, mock_get_route):
        response = self.client.post('/api/trips/plan/', data=VALID_REQUEST_WITH_COORDINATES, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        mock_get_route.assert_called_once_with(
            'Dallas, TX',
            'Phoenix, AZ',
            'Los Angeles, CA',
            [-96.797, 32.7767],
            [-112.074, 33.4484],
            [-118.2437, 34.0522],
        )
