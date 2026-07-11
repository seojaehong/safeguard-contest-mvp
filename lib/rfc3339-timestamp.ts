const RFC3339_OFFSET_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export function isRfc3339OffsetTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = RFC3339_OFFSET_TIMESTAMP.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[7] || 0);
  const offsetMinute = Number(match[8] || 0);
  const calendarDate = new Date(Date.UTC(year, monthIndex, day));

  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== monthIndex
    || calendarDate.getUTCDate() !== day
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}
