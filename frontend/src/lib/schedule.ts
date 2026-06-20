import type { ScheduleStop } from "@/types";

export function getStopLabel(stop: ScheduleStop): string {
  if (stop.type === "pickup") {
    return "Pickup";
  }
  if (stop.type === "dropoff") {
    return "Dropoff";
  }
  if (stop.type === "fuel") {
    return "Fuel";
  }
  if (stop.type === "restart") {
    return "Restart";
  }
  return stop.duration_hours >= 10 ? "10 hr rest" : "Rest";
}
