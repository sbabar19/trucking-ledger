import { planTrip } from "@/api";
import "@/App.css";
import { LocationInput } from "@/components/LocationInput";
import { LogSheet } from "@/components/LogSheet";
import { MapPanel } from "@/components/MapPanel";
import { Timeline } from "@/components/Timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  reverseGeocodeLocation,
  type LocationSuggestion,
} from "@/lib/mapboxGeocoding";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  TripPlanRequest,
  TripPlanResponse,
} from "@/types";
import { useState, type FormEvent } from "react";

interface PlannerLocationState {
  value: string;
  coordinates: Coordinates | null;
}

type PlannerLocations = Record<LocationFieldKey, PlannerLocationState>;

const DEFAULT_LOCATIONS: PlannerLocations = {
  current_location: { value: "Dallas, TX", coordinates: null },
  pickup_location: { value: "Phoenix, AZ", coordinates: null },
  dropoff_location: { value: "Los Angeles, CA", coordinates: null },
};

const FIELD_LABELS: Record<LocationFieldKey, string> = {
  current_location: "Current location",
  pickup_location: "Pickup location",
  dropoff_location: "Dropoff location",
};

const DEFAULT_CYCLE_USED = "12";

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [locations, setLocations] =
    useState<PlannerLocations>(DEFAULT_LOCATIONS);
  const [currentCycleUsed, setCurrentCycleUsed] = useState(DEFAULT_CYCLE_USED);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeField, setActiveField] =
    useState<LocationFieldKey>("current_location");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validateForm(locations, currentCycleUsed);
    if (validationMessage) {
      setErrorMessage(validationMessage);
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

    try {
      setResult(await planTrip(request));
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
  };

  const handleSuggestionSelect = (
    field: LocationFieldKey,
    suggestion: LocationSuggestion,
  ) => {
    updateLocation(field, suggestion.label, suggestion.coordinates);
    setErrorMessage("");
  };

  const handleMapClick = async (coordinates: Coordinates) => {
    if (!mapboxToken) {
      return;
    }

    try {
      const suggestion = await reverseGeocodeLocation(coordinates, mapboxToken);
      updateLocation(
        activeField,
        suggestion?.label ??
          `${FIELD_LABELS[activeField]} (${formatCoordinatePair(coordinates)})`,
        coordinates,
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not resolve the selected map location",
      );
    }
  };

  const lastLogDay = result?.schedule.days.at(-1);
  const cycleUsed = lastLogDay?.recap.cycle_used_end ?? null;
  const cycleRemaining = lastLogDay?.recap.cycle_available_end ?? null;
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
    <main className="min-h-screen bg-background p-4 text-foreground md:p-7">
      <section
        className="mx-auto grid max-w-[1480px] grid-cols-1 gap-6"
        aria-label="Trip planner input"
      >
        <Card>
          <CardHeader>
            <CardDescription>Trucking Ledger</CardDescription>
            <CardTitle>Route inputs</CardTitle>
            <CardAction>
              <Badge variant="secondary">70 hr / 8 day cycle</Badge>
            </CardAction>
          </CardHeader>

          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <FieldGroup className="grid grid-cols-[repeat(3,minmax(180px,1fr))_minmax(150px,0.55fr)] items-start gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
                <LocationInput
                  id="current_location"
                  label="Current location"
                  value={locations.current_location.value}
                  coordinates={locations.current_location.coordinates}
                  accessToken={mapboxToken}
                  isActive={activeField === "current_location"}
                  onActivate={() => setActiveField("current_location")}
                  onChange={(value) =>
                    updateLocation("current_location", value, null)
                  }
                  onSelectSuggestion={(suggestion) =>
                    handleSuggestionSelect("current_location", suggestion)
                  }
                />

                <LocationInput
                  id="pickup_location"
                  label="Pickup location"
                  value={locations.pickup_location.value}
                  coordinates={locations.pickup_location.coordinates}
                  accessToken={mapboxToken}
                  isActive={activeField === "pickup_location"}
                  onActivate={() => setActiveField("pickup_location")}
                  onChange={(value) =>
                    updateLocation("pickup_location", value, null)
                  }
                  onSelectSuggestion={(suggestion) =>
                    handleSuggestionSelect("pickup_location", suggestion)
                  }
                />

                <LocationInput
                  id="dropoff_location"
                  label="Dropoff location"
                  value={locations.dropoff_location.value}
                  coordinates={locations.dropoff_location.coordinates}
                  accessToken={mapboxToken}
                  isActive={activeField === "dropoff_location"}
                  onActivate={() => setActiveField("dropoff_location")}
                  onChange={(value) =>
                    updateLocation("dropoff_location", value, null)
                  }
                  onSelectSuggestion={(suggestion) =>
                    handleSuggestionSelect("dropoff_location", suggestion)
                  }
                />

                <Field>
                  <FieldLabel htmlFor="current-cycle-used">
                    Current cycle used
                  </FieldLabel>
                  <Input
                    id="current-cycle-used"
                    value={currentCycleUsed}
                    onChange={(event) =>
                      setCurrentCycleUsed(event.target.value)
                    }
                    placeholder="12"
                    inputMode="decimal"
                  />
                </Field>
              </FieldGroup>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Separator />

              <Button type="submit" size="lg" disabled={isLoading}>
                {isLoading ? "Planning route..." : "Plan compliant trip"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <MapPanel
          activeField={activeField}
          locations={locationSummary}
          route={result?.route}
          onActivateField={setActiveField}
          onMapClick={handleMapClick}
        />
      </section>

      {result || isLoading ? (
        <section
          className="mx-auto mt-6 grid max-w-[1480px] min-w-0 gap-6"
          aria-live="polite"
        >
          <Card>
            <CardHeader>
              <CardDescription>Compliance summary</CardDescription>
              <CardTitle>
                {result ? "Plan generated" : "Awaiting dispatch request"}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-5 gap-3 max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1">
                <Metric
                  label="Total miles"
                  value={
                    result ? formatNumber(result.route.distance_miles) : "---"
                  }
                  isLoading={isLoading && !result}
                />
                <Metric
                  label="Route hours"
                  value={
                    result ? formatHours(result.route.duration_hours) : "---"
                  }
                  isLoading={isLoading && !result}
                />
                <Metric
                  label="Log days"
                  value={result ? String(result.schedule.days.length) : "---"}
                  isLoading={isLoading && !result}
                />
                <Metric
                  label="Cycle used"
                  value={cycleUsed === null ? "---" : formatHours(cycleUsed)}
                  isLoading={isLoading && !result}
                />
                <Metric
                  label="Cycle remaining"
                  value={
                    cycleRemaining === null
                      ? "---"
                      : formatHours(cycleRemaining)
                  }
                  isLoading={isLoading && !result}
                />
              </div>
            </CardContent>

            {result ? (
              <CardFooter
                className="flex flex-wrap gap-2"
                aria-label="Schedule assumptions"
              >
                {result.schedule.assumptions.map((assumption) => (
                  <Badge key={assumption} variant="outline">
                    {assumption}
                  </Badge>
                ))}
              </CardFooter>
            ) : null}
          </Card>

          {isLoading ? (
            <Card role="status">
              <CardHeader>
                <CardTitle>Building compliant plan</CardTitle>
                <CardDescription>
                  Routing, stop scheduling, and daily log sheets are being
                  generated.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-2/3" />
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <>
              <Timeline
                instructions={result.route.instructions}
                stops={result.schedule.stops}
              />
              <Card aria-label="Daily log sheets">
                <CardHeader>
                  <CardDescription>Filled records</CardDescription>
                  <CardTitle>Daily log sheets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 print:block">
                    {result.schedule.days.map((day) => (
                      <LogSheet
                        key={day.day}
                        day={day}
                        stops={result.schedule.stops}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

interface MetricProps {
  label: string;
  value: string;
  isLoading?: boolean;
}

function Metric({ label, value, isLoading = false }: MetricProps) {
  return (
    <Card size="sm" className="min-h-24">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <CardTitle>{value}</CardTitle>
        )}
      </CardHeader>
    </Card>
  );
}

function validateForm(
  locations: PlannerLocations,
  currentCycleUsed: string,
): string {
  if (
    !locations.current_location.value.trim() ||
    !locations.pickup_location.value.trim() ||
    !locations.dropoff_location.value.trim()
  ) {
    return "Current, pickup, and dropoff locations are required.";
  }

  const cycleUsed = Number(currentCycleUsed);
  if (!Number.isFinite(cycleUsed) || cycleUsed < 0 || cycleUsed > 70) {
    return "Current cycle used must be a number between 0 and 70.";
  }

  return "";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

function formatCoordinatePair(coordinates: Coordinates): string {
  return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
}

export default App;
