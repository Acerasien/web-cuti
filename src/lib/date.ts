/**
 * Calculates the number of working days between two dates (inclusive),
 * skipping Saturdays, Sundays, and any dates matching the registered holiday set.
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidaySet: Set<string>
): number {
  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = current.toISOString().split("T")[0]; // YYYY-MM-DD

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(dateString);

    if (!isWeekend && !isHoliday) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}
