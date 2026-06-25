export const HIERARCHY_RANKS: Record<string, number> = {
  "Non Staff - Skill": 1,
  "Non Staff - Operator": 1,
  "Non Staff - Mekanik": 1,
  "Non Staff - Non Skill": 1,
  "Staff - Foreman": 2,
  "Staff - Supervisor": 3,
  "Staff - Superintendent": 4,
  "Staff - Manager": 5,
  "Staff - General Manager": 6,
};

// Returns true if supervisorLevel is strictly higher than employeeLevel
export function isEligibleSupervisor(employeeLevel: string | null, supervisorLevel: string | null): boolean {
  if (!employeeLevel) return false;
  if (!supervisorLevel) return false;
  const empRank = HIERARCHY_RANKS[employeeLevel] || 0;
  const supRank = HIERARCHY_RANKS[supervisorLevel] || 0;
  return supRank > empRank;
}
