import type { Coordinates, LocationFieldKey } from "@/types";

export interface PlannerLocationState {
  value: string;
  coordinates: Coordinates | null;
}

export type PlannerLocations = Record<LocationFieldKey, PlannerLocationState>;
export type PlannerFieldKey = LocationFieldKey | "current_cycle_used";
export type FormErrors = Partial<Record<PlannerFieldKey, string>>;
