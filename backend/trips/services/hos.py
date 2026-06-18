from dataclasses import dataclass
from math import ceil
from typing import Callable


OFF_DUTY = 'off_duty'
SLEEPER_BERTH = 'sleeper_berth'
DRIVING = 'driving'
ON_DUTY = 'on_duty'

CYCLE_LIMIT_HOURS = 70.0
DRIVING_LIMIT_HOURS = 11.0
DRIVING_WINDOW_HOURS = 14.0
BREAK_DRIVING_LIMIT_HOURS = 8.0
THIRTY_MINUTE_BREAK_HOURS = 0.5
TEN_HOUR_BREAK_HOURS = 10.0
RESTART_HOURS = 34.0
FUEL_INTERVAL_MILES = 1000.0
FUEL_DURATION_HOURS = 0.25
SERVICE_DURATION_HOURS = 1.0
EPSILON = 0.000001
LocationResolver = Callable[[float], str]


@dataclass
class TripLeg:
    name: str
    distance_miles: float
    duration_hours: float
    start_location: str
    end_location: str


@dataclass
class DutyEvent:
    status: str
    start_hour: float
    end_hour: float
    remarks: str
    location: str


def build_schedule(legs: list[TripLeg], current_cycle_used: float, location_resolver: LocationResolver | None = None) -> dict:
    events: list[DutyEvent] = []
    stops: list[dict] = []
    state = {
        'hour': 0.0,
        'cycle_used': float(current_cycle_used),
        'duty_start': 6.0,
        'duty_driving': 0.0,
        'driving_since_break': 0.0,
        'route_miles': 0.0,
        'next_fuel_mile': FUEL_INTERVAL_MILES,
        'day_miles': {},
        'location_resolver': location_resolver,
    }

    _add_event(events, OFF_DUTY, 0.0, 6.0, 'Off duty', 'Trip origin')
    state['hour'] = 6.0

    for index, leg in enumerate(legs):
        _drive_leg(events, stops, state, leg)
        if index == 0:
            _add_service_event(events, stops, state, 'pickup', 'Pickup', leg.end_location)
        elif index == len(legs) - 1:
            _add_service_event(events, stops, state, 'dropoff', 'Dropoff', leg.end_location)

    return {
        'assumptions': [
            'Property-carrying driver',
            '70hrs/8days',
            'No adverse driving conditions',
        ],
        'events': [_event_to_dict(event) for event in events],
        'days': _build_days(events, float(current_cycle_used), state['day_miles']),
        'stops': stops,
    }


def _drive_leg(events: list[DutyEvent], stops: list[dict], state: dict, leg: TripLeg) -> None:
    remaining_duration = max(float(leg.duration_hours), 0.0)
    remaining_distance = max(float(leg.distance_miles), 0.0)
    speed_mph = remaining_distance / remaining_duration if remaining_duration > EPSILON else 0.0

    while remaining_duration > EPSILON:
        target_duration = remaining_duration
        if speed_mph > EPSILON and state['next_fuel_mile'] <= state['route_miles'] + remaining_distance + EPSILON:
            miles_to_fuel = max(state['next_fuel_mile'] - state['route_miles'], 0.0)
            target_duration = min(target_duration, miles_to_fuel / speed_mph)

        if target_duration <= EPSILON:
            _add_fuel_event(events, stops, state)
            state['next_fuel_mile'] += FUEL_INTERVAL_MILES
            continue

        chunk = _legal_drive_chunk(events, stops, state, target_duration)
        if chunk <= EPSILON:
            continue

        start_hour = state['hour']
        end_hour = start_hour + chunk
        start_location = _route_location(state, leg.start_location)
        _add_event(events, DRIVING, start_hour, end_hour, f'Drive toward {leg.name}', start_location)
        state['hour'] = end_hour
        state['cycle_used'] += chunk
        state['duty_driving'] += chunk
        state['driving_since_break'] += chunk
        remaining_duration -= chunk

        miles_driven = chunk * speed_mph if speed_mph > EPSILON else 0.0
        _add_driving_miles(state['day_miles'], start_hour, end_hour, miles_driven)
        state['route_miles'] += miles_driven
        remaining_distance = max(remaining_distance - miles_driven, 0.0)

        if abs(state['route_miles'] - state['next_fuel_mile']) <= EPSILON:
            _add_fuel_event(events, stops, state)
            state['next_fuel_mile'] += FUEL_INTERVAL_MILES

    state['route_miles'] += remaining_distance


def _legal_drive_chunk(events: list[DutyEvent], stops: list[dict], state: dict, target_duration: float) -> float:
    if state['cycle_used'] >= CYCLE_LIMIT_HOURS - EPSILON:
        _insert_restart(events, stops, state)
        return 0.0

    if state['driving_since_break'] >= BREAK_DRIVING_LIMIT_HOURS - EPSILON:
        _insert_thirty_minute_break(events, stops, state)
        return 0.0

    remaining_window = state['duty_start'] + DRIVING_WINDOW_HOURS - state['hour']
    remaining_daily_driving = DRIVING_LIMIT_HOURS - state['duty_driving']
    if remaining_window <= EPSILON or remaining_daily_driving <= EPSILON:
        _insert_ten_hour_break(events, stops, state)
        return 0.0

    chunk = min(
        target_duration,
        BREAK_DRIVING_LIMIT_HOURS - state['driving_since_break'],
        remaining_daily_driving,
        remaining_window,
    )
    if state['cycle_used'] + chunk > CYCLE_LIMIT_HOURS + EPSILON:
        _insert_restart(events, stops, state)
        return 0.0
    return chunk


def _add_service_event(events: list[DutyEvent], stops: list[dict], state: dict, stop_type: str, remarks: str, location: str) -> None:
    if state['cycle_used'] + SERVICE_DURATION_HOURS > CYCLE_LIMIT_HOURS + EPSILON:
        _insert_restart(events, stops, state)

    start_hour = state['hour']
    end_hour = start_hour + SERVICE_DURATION_HOURS
    _add_event(events, ON_DUTY, start_hour, end_hour, remarks, location)
    stops.append({
        'type': stop_type,
        'hour': _round_hour(start_hour),
        'duration_hours': SERVICE_DURATION_HOURS,
        'location': location,
    })
    state['hour'] = end_hour
    state['cycle_used'] += SERVICE_DURATION_HOURS
    state['driving_since_break'] = 0.0


def _add_fuel_event(events: list[DutyEvent], stops: list[dict], state: dict) -> None:
    if state['cycle_used'] + FUEL_DURATION_HOURS > CYCLE_LIMIT_HOURS + EPSILON:
        _insert_restart(events, stops, state)

    route_mile = int(round(state['next_fuel_mile']))
    location = _route_location(state, f'near route mile {route_mile}')
    start_hour = state['hour']
    end_hour = start_hour + FUEL_DURATION_HOURS
    _add_event(events, ON_DUTY, start_hour, end_hour, 'Fueling', location)
    stops.append({
        'type': 'fuel',
        'hour': _round_hour(start_hour),
        'duration_hours': FUEL_DURATION_HOURS,
        'location': location,
    })
    state['hour'] = end_hour
    state['cycle_used'] += FUEL_DURATION_HOURS


def _insert_thirty_minute_break(events: list[DutyEvent], stops: list[dict], state: dict) -> None:
    start_hour = state['hour']
    end_hour = start_hour + THIRTY_MINUTE_BREAK_HOURS
    location = _route_location(state, 'break location')
    _add_event(events, OFF_DUTY, start_hour, end_hour, 'Required 30-minute break', location)
    stops.append({
        'type': 'rest',
        'hour': _round_hour(start_hour),
        'duration_hours': THIRTY_MINUTE_BREAK_HOURS,
        'location': location,
    })
    state['hour'] = end_hour
    state['driving_since_break'] = 0.0


def _insert_ten_hour_break(events: list[DutyEvent], stops: list[dict], state: dict) -> None:
    start_hour = state['hour']
    end_hour = start_hour + TEN_HOUR_BREAK_HOURS
    location = _route_location(state, 'break location')
    _add_event(events, OFF_DUTY, start_hour, end_hour, 'Required 10-hour break', location)
    stops.append({
        'type': 'rest',
        'hour': _round_hour(start_hour),
        'duration_hours': TEN_HOUR_BREAK_HOURS,
        'location': location,
    })
    state['hour'] = end_hour
    state['duty_start'] = end_hour
    state['duty_driving'] = 0.0
    state['driving_since_break'] = 0.0


def _insert_restart(events: list[DutyEvent], stops: list[dict], state: dict) -> None:
    start_hour = state['hour']
    end_hour = start_hour + RESTART_HOURS
    location = _route_location(state, 'restart location')
    _add_event(events, OFF_DUTY, start_hour, end_hour, 'Required 34-hour restart', location)
    stops.append({
        'type': 'restart',
        'hour': _round_hour(start_hour),
        'duration_hours': RESTART_HOURS,
        'location': location,
    })
    state['hour'] = end_hour
    state['cycle_used'] = 0.0
    state['duty_start'] = end_hour
    state['duty_driving'] = 0.0
    state['driving_since_break'] = 0.0


def _add_event(events: list[DutyEvent], status: str, start_hour: float, end_hour: float, remarks: str, location: str) -> None:
    if end_hour <= start_hour + EPSILON:
        return
    events.append(DutyEvent(status, start_hour, end_hour, remarks, location))


def _route_location(state: dict, fallback: str) -> str:
    resolver = state.get('location_resolver')
    if not resolver:
        return fallback
    return resolver(state['route_miles'])


def _build_days(events: list[DutyEvent], current_cycle_used: float, day_miles: dict[int, float]) -> list[dict]:
    final_hour = max((event.end_hour for event in events), default=24.0)
    day_count = max(1, ceil(final_hour / 24.0))
    days = []
    cycle_used = current_cycle_used

    for day_index in range(day_count):
        day_start = day_index * 24.0
        day_end = day_start + 24.0
        cycle_start = cycle_used
        segments = []
        totals = {OFF_DUTY: 0.0, SLEEPER_BERTH: 0.0, DRIVING: 0.0, ON_DUTY: 0.0}
        cursor = day_start
        cursor_location = 'Trip origin'

        for event in events:
            if event.end_hour <= day_start + EPSILON or event.start_hour >= day_end - EPSILON:
                continue

            if event.start_hour > cursor + EPSILON:
                _append_day_segment(segments, totals, OFF_DUTY, cursor, min(event.start_hour, day_end), 'Off duty', cursor_location)

            segment_start = max(event.start_hour, day_start)
            segment_end = min(event.end_hour, day_end)
            _append_day_segment(segments, totals, event.status, segment_start, segment_end, event.remarks, event.location)
            if event.status in (DRIVING, ON_DUTY):
                cycle_used += segment_end - segment_start
            if event.remarks == 'Required 34-hour restart' and segment_end >= event.end_hour - EPSILON:
                cycle_used = 0.0
            cursor = max(cursor, segment_end)
            cursor_location = event.location

        if cursor < day_end - EPSILON:
            _append_day_segment(segments, totals, OFF_DUTY, cursor, day_end, 'Off duty', cursor_location)

        rounded_totals = _rounded_totals(totals)
        days.append({
            'day': day_index + 1,
            'label': f'Day {day_index + 1}',
            'segments': segments,
            'totals': rounded_totals,
            'total_miles': _round_miles(day_miles.get(day_index, 0.0)),
            'recap': {
                'cycle_used_start': _round_hour(cycle_start),
                'cycle_used_end': _round_hour(cycle_used),
                'cycle_available_end': _round_hour(max(CYCLE_LIMIT_HOURS - cycle_used, 0.0)),
            },
        })

    return days


def _add_driving_miles(day_miles: dict[int, float], start_hour: float, end_hour: float, miles: float) -> None:
    if end_hour <= start_hour + EPSILON or miles <= EPSILON:
        return

    cursor = start_hour
    duration = end_hour - start_hour
    while cursor < end_hour - EPSILON:
        day_index = int(cursor // 24.0)
        next_day_start = (day_index + 1) * 24.0
        segment_end = min(end_hour, next_day_start)
        day_miles[day_index] = day_miles.get(day_index, 0.0) + miles * ((segment_end - cursor) / duration)
        cursor = segment_end


def _append_day_segment(segments: list[dict], totals: dict, status: str, start_hour: float, end_hour: float, remarks: str, location: str) -> None:
    if end_hour <= start_hour + EPSILON:
        return

    day_start = (start_hour // 24.0) * 24.0
    segments.append({
        'status': status,
        'start': _round_hour(start_hour - day_start),
        'end': _round_hour(end_hour - day_start),
        'remarks': remarks,
        'location': location,
    })
    totals[status] += end_hour - start_hour


def _rounded_totals(totals: dict) -> dict:
    rounded = {status: _round_hour(totals[status]) for status in (OFF_DUTY, SLEEPER_BERTH, DRIVING, ON_DUTY)}
    difference = _round_hour(24.0 - sum(rounded.values()))
    if difference:
        rounded[OFF_DUTY] = _round_hour(rounded[OFF_DUTY] + difference)
    return rounded


def _event_to_dict(event: DutyEvent) -> dict:
    return {
        'status': event.status,
        'start_hour': _round_hour(event.start_hour),
        'end_hour': _round_hour(event.end_hour),
        'remarks': event.remarks,
        'location': event.location,
    }


def _round_hour(value: float) -> float:
    return round(value + 0.0, 2)


def _round_miles(value: float) -> float:
    return round(value + 0.0, 1)
