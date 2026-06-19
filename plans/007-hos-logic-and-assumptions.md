# HOS Calculation Logic and Assumptions

This document describes the current trip planning simulation used by Trucking Ledger. It is an implementation guide for the backend schedule builder and the frontend daily log graph, not a legal compliance certification.

## Inputs

- Current location, pickup location, dropoff location, and current 70-hour cycle usage.
- Route distance, route duration, route geometry, route legs, and route instructions from the routing service.
- Optional selected coordinates for current, pickup, and dropoff locations.

## Routing Flow

1. The API validates that all three locations are present and that current cycle used is between `0` and `70`.
2. The routing service returns a route with total distance, duration, geometry, waypoints, instructions, and route legs.
3. The HOS builder receives each trip leg with distance, duration, start location, and end location.
4. When route geometry is available, stop locations are interpolated by route-mile progress and reverse geocoded. If lookup fails, the fallback location text is used.

## Schedule Builder State

The HOS builder tracks:

- `hour`: elapsed trip hour from the beginning of the schedule.
- `cycle_used`: current used hours in the 70-hour/8-day cycle.
- `duty_start`: start hour of the current 14-hour driving window.
- `duty_driving`: driving hours since the last 10-hour break.
- `driving_since_break`: driving hours since the last qualifying 30-minute break.
- `route_miles`: cumulative route miles driven.
- `next_fuel_mile`: next 1,000-mile fuel stop threshold.
- `day_miles`: miles allocated into each 24-hour log day.

## Duty Status Rules

- The simulated day begins with 6 hours off duty before driving starts.
- Driving is limited to 11 hours before a 10-hour break is inserted.
- The driving window is limited to 14 hours from `duty_start`.
- A 30-minute off-duty break is inserted after 8 hours of driving since the previous break.
- A 34-hour off-duty restart is inserted when the 70-hour cycle would be exceeded.
- Fuel stops are inserted every 1,000 route miles and are 0.25 hours on duty.
- Pickup and dropoff service events are 1 hour on duty.

## 10-Hour Break Simulation

Each required 10-hour break is recorded as one continuous `off_duty` event and one 10-hour rest stop. The current planner does not split that break into `sleeper_berth` time.

After the full 10-hour break:

- `duty_start` moves to the break end hour.
- `duty_driving` resets to `0`.
- `driving_since_break` resets to `0`.

## Daily Log Construction

1. Events are split into 24-hour days.
2. Empty gaps between events are filled as off duty at the most recent known location.
3. Each segment is converted into day-relative `start` and `end` hours.
4. Duty totals are rounded to two decimals and adjusted so each day sums to 24 hours.
5. Miles are prorated across days by driving segment duration.
6. Cycle recap includes cycle used at day start, cycle used at day end, and available cycle hours.

## Remarks Display

- Graph remarks display a location label above the leader line and the reason below the leader line.
- Location labels are reduced to city/state-style text when comma-separated address components are available. For example, a full geocoder result ending in `Chicago, IL` is displayed as `Chicago, IL`.
- Fallback route-mile labels such as `near route mile 530` are preserved when a city/state location is not available.
- Reasons such as `30 min break`, `10 hour break`, `Pickup`, `Dropoff`, and `Fueling` remain visible below the leader line.
- Remark callouts are drawn from status-change times. Events from 30 minutes through 2 hours use the bracket/prong shape to show the event span.

## Assumptions

- This is a simplified property-carrying driver model using the 70-hour/8-day cycle.
- Adverse driving conditions, split sleeper berth legal optimization, short-haul exemptions, passenger-carrying rules, and jurisdiction-specific exceptions are not modeled.
- Routing duration is treated as drive time and is distributed linearly over route distance.
- Stop locations are approximated by route-mile interpolation and reverse geocoding.
- Service durations are fixed: pickup/dropoff are 1 hour, fuel is 0.25 hours.
- A 10-hour rest break is simulated as off duty time, not sleeper berth time.
- Generated daily logs are planning artifacts and should be reviewed before operational use.
