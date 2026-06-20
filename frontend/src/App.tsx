import "@/App.css";

import { planTrip } from "@/api";
import { MapPanel } from "@/components/MapPanel";
import { PlanningHero } from "@/components/planner/PlanningHero";
import { ResultsSection } from "@/components/planner/ResultsSection";
import { TripPlannerForm } from "@/components/planner/TripPlannerForm";
import type {
  FormErrors,
  PlannerFieldKey,
  PlannerLocations,
} from "@/components/planner/types";
import type { LocationSuggestion } from "@/lib/mapboxGeocoding";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  TripPlanRequest,
  TripPlanResponse,
} from "@/types";
import { useState, type FormEvent, type KeyboardEvent } from "react";

const DEFAULT_LOCATIONS: PlannerLocations = {
  current_location: {
    value: "Phoenix, Arizona, United States",
    coordinates: null,
  },
  pickup_location: {
    value: "Alberque Drive, Krum, Texas 76249, United States",
    coordinates: null,
  },
  dropoff_location: { value: "Dallas, Texas, United States", coordinates: null },
};

const DEFAULT_CYCLE_USED = "12";
const CYCLE_USED_MIN = 0;
const CYCLE_USED_MAX = 70;
const BLOCKED_CYCLE_USED_KEYS = new Set(["e", "E", "+", "-"]);

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [locations, setLocations] =
    useState<PlannerLocations>(DEFAULT_LOCATIONS);
  const [currentCycleUsed, setCurrentCycleUsed] = useState(DEFAULT_CYCLE_USED);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [selectedLogDayIndex, setSelectedLogDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const resetPlanner = () => {
    setLocations(DEFAULT_LOCATIONS);
    setCurrentCycleUsed(DEFAULT_CYCLE_USED);
    setResult(null);
    setSelectedLogDayIndex(0);
    setIsLoading(false);
    setErrorMessage("");
    setFormErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateForm(locations, currentCycleUsed);
    if (hasFormErrors(validationErrors)) {
      setFormErrors(validationErrors);
      setErrorMessage("");
      return;
    }

    const request: TripPlanRequest = {
      current_location: locations.current_location.value.trim(),
      pickup_location: locations.pickup_location.value.trim(),
      dropoff_location: locations.dropoff_location.value.trim(),
      current_cycle_used: Number(currentCycleUsed),
      ...(locations.current_location.coordinates
        ? { current_coordinates: locations.current_location.coordinates }
        : {}),
      ...(locations.pickup_location.coordinates
        ? { pickup_coordinates: locations.pickup_location.coordinates }
        : {}),
      ...(locations.dropoff_location.coordinates
        ? { dropoff_coordinates: locations.dropoff_location.coordinates }
        : {}),
    };

    setIsLoading(true);
    setErrorMessage("");
    setFormErrors({});

    try {
      setResult(await planTrip(request));
      setSelectedLogDayIndex(0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Trip planning failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateLocation = (
    field: LocationFieldKey,
    value: string,
    coordinates: Coordinates | null,
  ) => {
    setLocations((previousLocations) => ({
      ...previousLocations,
      [field]: { value, coordinates },
    }));
    setFormErrors((previousErrors) => clearFormError(previousErrors, field));
    setErrorMessage("");
  };

  const updateCurrentCycleUsed = (value: string) => {
    setCurrentCycleUsed(constrainCycleUsedInput(value));
    setFormErrors((previousErrors) =>
      clearFormError(previousErrors, "current_cycle_used"),
    );
    setErrorMessage("");
  };

  const handleSuggestionSelect = (
    field: LocationFieldKey,
    suggestion: LocationSuggestion,
  ) => {
    updateLocation(field, suggestion.label, suggestion.coordinates);
    setErrorMessage("");
  };

  const handlePrintSelectedLogDay = () => {
    window.print();
  };

  const logDayCount = result?.schedule.days.length ?? 0;

  const handlePreviousLogDay = () => {
    setSelectedLogDayIndex((dayIndex) => Math.max(dayIndex - 1, 0));
  };

  const handleNextLogDay = () => {
    setSelectedLogDayIndex((dayIndex) =>
      Math.min(dayIndex + 1, logDayCount - 1),
    );
  };

  const locationSummary: LocationSelectionMap = {
    current_location: {
      label: locations.current_location.value,
      coordinates: locations.current_location.coordinates,
    },
    pickup_location: {
      label: locations.pickup_location.value,
      coordinates: locations.pickup_location.coordinates,
    },
    dropoff_location: {
      label: locations.dropoff_location.value,
      coordinates: locations.dropoff_location.coordinates,
    },
  };

  return (
    <main className="app-shell min-h-dvh overflow-hidden px-3 py-4 text-foreground sm:px-5 lg:px-8">
      <section
        className="mx-auto grid max-w-[1480px] grid-cols-1 gap-5"
        aria-label="Trip planner input"
      >
        <div>
          <PlanningHero
            locations={locations}
            currentCycleUsed={currentCycleUsed}
          />

          <TripPlannerForm
            locations={locations}
            currentCycleUsed={currentCycleUsed}
            formErrors={formErrors}
            errorMessage={errorMessage}
            isLoading={isLoading}
            mapboxToken={mapboxToken}
            onSubmit={handleSubmit}
            onLocationChange={updateLocation}
            onSuggestionSelect={handleSuggestionSelect}
            onCurrentCycleUsedChange={updateCurrentCycleUsed}
            onCycleUsedKeyDown={handleCycleUsedKeyDown}
            onReset={resetPlanner}
          />
        </div>

        <MapPanel
          locations={locationSummary}
          route={result?.route}
          stops={result?.schedule.stops}
        />
      </section>

      <ResultsSection
        result={result}
        isLoading={isLoading}
        selectedLogDayIndex={selectedLogDayIndex}
        onPreviousLogDay={handlePreviousLogDay}
        onNextLogDay={handleNextLogDay}
        onPrintSelectedLogDay={handlePrintSelectedLogDay}
      />
    </main>
  );
}

function validateForm(
  locations: PlannerLocations,
  currentCycleUsed: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!locations.current_location.value.trim()) {
    errors.current_location = "Current location is required.";
  }

  if (!locations.pickup_location.value.trim()) {
    errors.pickup_location = "Pickup location is required.";
  }

  if (!locations.dropoff_location.value.trim()) {
    errors.dropoff_location = "Dropoff location is required.";
  }

  const cycleUsedInput = currentCycleUsed.trim();
  const cycleUsed = Number(cycleUsedInput);

  if (!cycleUsedInput) {
    errors.current_cycle_used = "Current cycle used is required.";
  } else if (!Number.isFinite(cycleUsed)) {
    errors.current_cycle_used = "Current cycle used must be a number.";
  } else if (cycleUsed < CYCLE_USED_MIN || cycleUsed > CYCLE_USED_MAX) {
    errors.current_cycle_used = `Current cycle used must be between ${CYCLE_USED_MIN} and ${CYCLE_USED_MAX} hours.`;
  }

  return errors;
}

function constrainCycleUsedInput(value: string): string {
  if (!value.trim()) {
    return "";
  }

  const cycleUsed = Number(value);
  if (!Number.isFinite(cycleUsed)) {
    return value;
  }

  if (cycleUsed < CYCLE_USED_MIN) {
    return String(CYCLE_USED_MIN);
  }

  if (cycleUsed > CYCLE_USED_MAX) {
    return String(CYCLE_USED_MAX);
  }

  return value;
}

function handleCycleUsedKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (BLOCKED_CYCLE_USED_KEYS.has(event.key)) {
    event.preventDefault();
  }
}

function hasFormErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function clearFormError(errors: FormErrors, field: PlannerFieldKey): FormErrors {
  if (!errors[field]) {
    return errors;
  }

  const nextErrors = { ...errors };
  delete nextErrors[field];
  return nextErrors;
}

export default App;
