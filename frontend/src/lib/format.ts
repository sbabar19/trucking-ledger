export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

export function formatHours(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return `${formatNumber(value, options)} hr`;
}

export function formatMinutes(value: number): string {
  if (value >= 60) {
    return formatHours(value / 60);
  }

  return `${formatNumber(value)} min`;
}

export function formatHourOffset(
  hour: number,
  options: { compact?: boolean } = {},
): string {
  const day = Math.floor(hour / 24) + 1;
  const hourWithinDay = hour % 24;
  const wholeHours = Math.floor(hourWithinDay);
  const minutes = Math.round((hourWithinDay - wholeHours) * 60);
  const displayHours = minutes === 60 ? wholeHours + 1 : wholeHours;
  const displayMinutes = minutes === 60 ? 0 : minutes;
  const time = `${displayHours.toString().padStart(2, "0")}:${displayMinutes
    .toString()
    .padStart(2, "0")}`;

  return options.compact ? `D${day} ${time}` : `Day ${day}, ${time}`;
}
