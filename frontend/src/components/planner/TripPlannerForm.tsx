import { LocationInput } from "@/components/LocationInput";
import type {
  FormErrors,
  PlannerLocations,
} from "@/components/planner/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { LocationSuggestion } from "@/lib/mapboxGeocoding";
import type { Coordinates, LocationFieldKey } from "@/types";
import { ArrowRightIcon } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";

interface TripPlannerFormProps {
  locations: PlannerLocations;
  currentCycleUsed: string;
  formErrors: FormErrors;
  errorMessage: string;
  isLoading: boolean;
  mapboxToken?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLocationChange: (
    field: LocationFieldKey,
    value: string,
    coordinates: Coordinates | null,
  ) => void;
  onSuggestionSelect: (
    field: LocationFieldKey,
    suggestion: LocationSuggestion,
  ) => void;
  onCurrentCycleUsedChange: (value: string) => void;
  onCycleUsedKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const CYCLE_USED_MIN = 0;
const CYCLE_USED_MAX = 70;

export function TripPlannerForm({
  locations,
  currentCycleUsed,
  formErrors,
  errorMessage,
  isLoading,
  mapboxToken,
  onSubmit,
  onLocationChange,
  onSuggestionSelect,
  onCurrentCycleUsedChange,
  onCycleUsedKeyDown,
}: TripPlannerFormProps) {
  const currentCycleUsedError = formErrors.current_cycle_used;

  return (
    <Card className="dashboard-card booking-search-card mx-auto max-w-[1320px] rounded-[1.25rem] bg-card py-4 shadow-none ring-1 ring-border/80">
      <CardContent className="px-4 sm:px-5">
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <FieldGroup className="booking-field-grid grid grid-cols-[repeat(3,minmax(190px,1fr))_minmax(150px,0.62fr)_auto] items-start gap-3 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
            <LocationInput
              id="current_location"
              label="Current location"
              value={locations.current_location.value}
              coordinates={locations.current_location.coordinates}
              accessToken={mapboxToken}
              className="booking-field"
              inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
              error={formErrors.current_location}
              onChange={(value) =>
                onLocationChange("current_location", value, null)
              }
              onSelectSuggestion={(suggestion) =>
                onSuggestionSelect("current_location", suggestion)
              }
            />

            <LocationInput
              id="pickup_location"
              label="Pickup location"
              value={locations.pickup_location.value}
              coordinates={locations.pickup_location.coordinates}
              accessToken={mapboxToken}
              className="booking-field"
              inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
              error={formErrors.pickup_location}
              onChange={(value) =>
                onLocationChange("pickup_location", value, null)
              }
              onSelectSuggestion={(suggestion) =>
                onSuggestionSelect("pickup_location", suggestion)
              }
            />

            <LocationInput
              id="dropoff_location"
              label="Dropoff location"
              value={locations.dropoff_location.value}
              coordinates={locations.dropoff_location.coordinates}
              accessToken={mapboxToken}
              className="booking-field"
              inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
              error={formErrors.dropoff_location}
              onChange={(value) =>
                onLocationChange("dropoff_location", value, null)
              }
              onSelectSuggestion={(suggestion) =>
                onSuggestionSelect("dropoff_location", suggestion)
              }
            />

            <Field
              className="booking-field"
              data-invalid={Boolean(currentCycleUsedError) || undefined}
            >
              <FieldLabel htmlFor="current-cycle-used">
                Current cycle used
              </FieldLabel>
              <Input
                id="current-cycle-used"
                type="number"
                className="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
                value={currentCycleUsed}
                onChange={(event) =>
                  onCurrentCycleUsedChange(event.target.value)
                }
                onKeyDown={onCycleUsedKeyDown}
                placeholder="12"
                min={CYCLE_USED_MIN}
                max={CYCLE_USED_MAX}
                step="any"
                inputMode="decimal"
                aria-describedby={
                  currentCycleUsedError
                    ? "current-cycle-used-error"
                    : undefined
                }
                aria-invalid={Boolean(currentCycleUsedError) || undefined}
                required
              />
              <FieldError id="current-cycle-used-error">
                {currentCycleUsedError}
              </FieldError>
            </Field>

            <Button
              type="submit"
              size="lg"
              className="h-12 min-w-32 rounded-lg px-7 text-base font-semibold max-[1180px]:col-span-2 max-[640px]:col-span-1"
              disabled={isLoading}
            >
              {isLoading ? "Planning..." : "Plan"}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </FieldGroup>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
