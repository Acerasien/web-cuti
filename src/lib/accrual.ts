/**
 * Calculates the accrued annual leave days under Model A (Month-Started Accrual)
 * from the cycle start date to the target date.
 *
 * Rule:
 * - Day 1 of the cycle: 1 day is immediately accrued (Month 1 started).
 * - Every completed month anniversary: +1 day accrued (Month N started).
 * - Capped at the cycle's total limit (default: 12 days).
 */
export function getAccruedQuotaDays(
  cycleStart: Date,
  totalDaysLimit: number,
  targetDate: Date = new Date()
): number {
  const start = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth(),
    cycleStart.getDate()
  );
  const target = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );

  if (target < start) {
    return 0; // target is before the cycle start
  }

  // Calculate full months elapsed
  let monthsElapsed =
    (target.getFullYear() - start.getFullYear()) * 12 +
    (target.getMonth() - start.getMonth());

  // Adjust if target day of the month is before start day of the month
  if (target.getDate() < start.getDate()) {
    monthsElapsed--;
  }

  // Month-Started logic: elapsed months + 1
  const monthsStarted = Math.max(0, monthsElapsed) + 1;

  // Cap at the cycle total limit
  return Math.min(totalDaysLimit, monthsStarted);
}
