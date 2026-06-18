export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty';

export type Coordinates = [number, number];

export type LocationFieldKey = 'current_location' | 'pickup_location' | 'dropoff_location';

export interface LocationSelection {
  label: string;
  coordinates: Coordinates | null;
}

export type LocationSelectionMap = Record<LocationFieldKey, LocationSelection>;

export type ScheduleStopType = 'pickup' | 'dropoff' | 'fuel' | 'rest' | 'restart';

export interface TripPlanRequest {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used: number;
  current_coordinates?: Coordinates;
  pickup_coordinates?: Coordinates;
  dropoff_coordinates?: Coordinates;
}

export interface RouteInstruction {
  text: string;
  distance_miles: number;
  duration_minutes: number;
}

export interface RouteWaypoint {
  label: string;
  location: string;
  coordinates: Coordinates;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: Coordinates[];
}

export interface ScheduleStop {
  type: ScheduleStopType;
  hour: number;
  duration_hours: number;
  location: string;
}

export interface LogSegment {
  status: DutyStatus;
  start: number;
  end: number;
  remarks: string;
  location: string;
  is_status_change: boolean;
}

export interface DutyStatusTotals {
  off_duty: number;
  sleeper_berth: number;
  driving: number;
  on_duty: number;
}

export interface LogDay {
  day: number;
  label: string;
  segments: LogSegment[];
  totals: DutyStatusTotals;
  total_miles: number;
  recap: {
    cycle_used_start: number;
    cycle_used_end: number;
    cycle_available_end: number;
  };
}

export interface DutyEvent {
  status: DutyStatus;
  start_hour: number;
  end_hour: number;
  remarks: string;
  location: string;
}

export interface TripPlanResponse {
  route: {
    distance_miles: number;
    duration_hours: number;
    geometry: RouteGeometry;
    waypoints: RouteWaypoint[];
    instructions: RouteInstruction[];
  };
  schedule: {
    assumptions: string[];
    events: DutyEvent[];
    days: LogDay[];
    stops: ScheduleStop[];
  };
}
