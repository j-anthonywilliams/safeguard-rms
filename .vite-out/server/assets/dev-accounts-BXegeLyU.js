const ACCESS_LEVELS = [
  "user",
  "supervisor",
  "admin",
  "support",
  "backend"
];
const ACCESS_LABELS = {
  user: "User",
  supervisor: "Supervisor",
  admin: "Admin",
  support: "Support",
  backend: "Backend"
};
const canCreateRecords = (level) => level !== "support";
const canManageUsers = (level) => ["admin", "support", "backend"].includes(level);
const canEditSchedule = (level) => ["supervisor", "admin", "support", "backend"].includes(level);
const GRANTABLE_ROLES = {
  user: [],
  supervisor: [],
  admin: ["supervisor", "user"],
  support: ["admin", "supervisor", "user"],
  backend: [
    "backend",
    "support",
    "admin",
    "supervisor",
    "user"
  ]
};
const canGrantRole = (currentRole, targetRole) => GRANTABLE_ROLES[currentRole].includes(targetRole);
function getDevRole() {
  return null;
}
export {
  ACCESS_LABELS as A,
  canCreateRecords as a,
  ACCESS_LEVELS as b,
  canManageUsers as c,
  canGrantRole as d,
  canEditSchedule as e,
  getDevRole as g
};
