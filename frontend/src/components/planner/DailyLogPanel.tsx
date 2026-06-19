import { LogSheet } from "@/components/LogSheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LogDay } from "@/types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
} from "lucide-react";

interface DailyLogPanelProps {
  selectedLogDay: LogDay | undefined;
  selectedLogDayIndex: number;
  logDayCount: number;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onPrintSelectedLogDay: () => void;
}

export function DailyLogPanel({
  selectedLogDay,
  selectedLogDayIndex,
  logDayCount,
  onPreviousDay,
  onNextDay,
  onPrintSelectedLogDay,
}: DailyLogPanelProps) {
  return (
    <Card
      className="dashboard-card rounded-[1.25rem] shadow-none ring-1 ring-border/80"
      aria-label="Daily log sheets"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardDescription className="section-kicker-card">
            Filled records
          </CardDescription>
          <CardTitle className="section-title">Daily log sheets</CardTitle>
        </div>
        <div className="log-day-controls" aria-label="Log day navigation">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-lg"
            disabled={selectedLogDayIndex === 0}
            aria-label="Previous log day"
            onClick={onPreviousDay}
          >
            <ChevronLeftIcon />
          </Button>
          <span>
            Day {selectedLogDayIndex + 1} of {logDayCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-lg"
            aria-label={`Print day ${selectedLogDayIndex + 1} log`}
            disabled={!selectedLogDay}
            onClick={onPrintSelectedLogDay}
          >
            <PrinterIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-lg"
            disabled={selectedLogDayIndex >= logDayCount - 1}
            aria-label="Next log day"
            onClick={onNextDay}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="log-sheet-scroll grid gap-6 print:block">
          {selectedLogDay ? (
            <LogSheet key={selectedLogDay.day} day={selectedLogDay} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
