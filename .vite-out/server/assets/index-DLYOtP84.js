import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useRef, useMemo, useEffect } from "react";
import { b as blink, B as Button } from "./client-C5cN3m_d.js";
import { B as BlinkClientBoundary } from "./BlinkClientBoundary-Dbwm73FM.js";
import { C as Card, a as CardContent, b as CardHeader, c as CardTitle, I as Input } from "./input-40gxQptb.js";
import { toast } from "sonner";
import { UserRound, Settings, LogOut, ShieldCheck, Sun, Moon, MapPin, Archive, Plus, FileText, AlertTriangle, ClipboardPlus, Package, Clock3, Eye, ArrowUpRight, Crosshair, Users, X } from "lucide-react";
import { A as ACCESS_LABELS, g as getDevRole, a as canCreateRecords } from "./dev-accounts-BXegeLyU.js";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { c as cn } from "./router-DEJXeonh.js";
import "@radix-ui/react-slot";
import "class-variance-authority";
import "@blinkdotnew/sdk";
import "@tanstack/react-router";
import "@tanstack/react-query";
import "@radix-ui/react-tooltip";
import "clsx";
import "tailwind-merge";
function DevAccountSwitcher() {
  return null;
}
function Avatar({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    AvatarPrimitive.Root,
    {
      "data-slot": "avatar",
      className: cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      ),
      ...props
    }
  );
}
function AvatarFallback({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    AvatarPrimitive.Fallback,
    {
      "data-slot": "avatar-fallback",
      className: cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      ),
      ...props
    }
  );
}
async function reconcileCurrentUser() {
  const state = await new Promise((resolve) => {
    let settled = false;
    const unsubscribe = blink.auth.onAuthStateChanged((nextState) => {
      if (settled || nextState.isLoading) {
        return;
      }
      settled = true;
      unsubscribe();
      resolve({
        user: nextState.user
      });
    });
  });
  const authUser = state.user;
  if (!authUser?.id || !authUser.email) {
    return null;
  }
  const usersTable = blink.db.table("users");
  const rolesTable = blink.db.table("app_roles");
  const invitationsTable = blink.db.table(
    "pending_user_invitations"
  );
  const email = authUser.email.toLowerCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const [existingUsers, invitations, existingRoles] = await Promise.all([
    usersTable.list({
      where: { id: authUser.id },
      limit: 1
    }),
    invitationsTable.list({
      where: { email },
      limit: 1
    }),
    rolesTable.list({
      where: { userId: authUser.id },
      limit: 1
    })
  ]);
  const existingUser = existingUsers[0];
  const invitation = invitations[0];
  const existingRole = existingRoles[0];
  if (!existingUser) {
    await usersTable.create({
      id: authUser.id,
      email: authUser.email,
      displayName: invitation?.displayName || authUser.displayName || authUser.email.split("@")[0],
      createdAt: now
    });
  }
  if (invitation) {
    if (existingRole) {
      if (existingRole.role !== invitation.requestedRole) {
        await rolesTable.update(existingRole.id, {
          role: invitation.requestedRole,
          updatedAt: now
        });
      }
    } else {
      await rolesTable.create({
        id: crypto.randomUUID(),
        userId: authUser.id,
        role: invitation.requestedRole,
        createdAt: now,
        updatedAt: now
      });
    }
    await invitationsTable.delete(invitation.id);
    return invitation.requestedRole;
  }
  return existingRole?.role || null;
}
function UserAccountMenu() {
  const [user, setUser] = useState(null);
  const [accessLevel, setAccessLevel] = useState("user");
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const rolesTable = useMemo(
    () => blink.db.table("app_roles"),
    []
  );
  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
      if (!state.user) {
        setAccessLevel("user");
        return;
      }
      const initializeUser = async () => {
        if (!state.user) {
          setAccessLevel("user");
          return;
        }
        try {
          const reconciledRole = await reconcileCurrentUser();
          const devRole = getDevRole();
          if (devRole) {
            setAccessLevel(devRole);
            return;
          }
          if (reconciledRole) {
            setAccessLevel(reconciledRole);
            return;
          }
          const rows = await rolesTable.list({
            where: { userId: state.user.id },
            limit: 1
          });
          setAccessLevel(rows[0]?.role || "user");
        } catch {
          setAccessLevel("user");
        }
      };
      initializeUser();
    });
  }, [rolesTable]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);
  const displayName = user?.displayName || user?.email || "Officer";
  const initials = displayName.slice(0, 2).toUpperCase();
  const signOut = async () => {
    setOpen(false);
    await blink.auth.logout();
  };
  return /* @__PURE__ */ jsxs("div", { ref: menuRef, className: "relative", children: [
    /* @__PURE__ */ jsxs(
      Button,
      {
        variant: "ghost",
        type: "button",
        onClick: () => setOpen((value) => !value),
        className: "flex h-auto items-center gap-2 px-2 py-1.5",
        "aria-expanded": open,
        "aria-haspopup": "menu",
        children: [
          /* @__PURE__ */ jsx(Avatar, { className: "h-8 w-8", children: /* @__PURE__ */ jsx(AvatarFallback, { className: "bg-muted text-xs", children: initials }) }),
          /* @__PURE__ */ jsxs("div", { className: "hidden min-w-0 text-left sm:block", children: [
            /* @__PURE__ */ jsx("p", { className: "max-w-40 truncate text-xs font-medium", children: displayName }),
            /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-muted-foreground", children: [
              ACCESS_LABELS[accessLevel],
              " access"
            ] })
          ] })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxs(
      "div",
      {
        role: "menu",
        className: "absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "border-b border-border px-3 py-2", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: displayName }),
            /* @__PURE__ */ jsx("p", { className: "truncate text-xs text-muted-foreground", children: user?.email || "" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [
              ACCESS_LABELS[accessLevel],
              " access"
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "a",
            {
              href: "/app/profile",
              role: "menuitem",
              onClick: () => setOpen(false),
              className: "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
              children: [
                /* @__PURE__ */ jsx(UserRound, { className: "h-4 w-4" }),
                "My profile"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "a",
            {
              href: "/app/profile",
              role: "menuitem",
              onClick: () => setOpen(false),
              className: "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
              children: [
                /* @__PURE__ */ jsx(Settings, { className: "h-4 w-4" }),
                "Account settings"
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "my-1 border-t border-border" }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: signOut,
              className: "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              children: [
                /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4" }),
                "Sign out"
              ]
            }
          )
        ]
      }
    )
  ] });
}
const canApproveIncidents = (level) => ["supervisor", "admin", "backend"].includes(level);
const approvalBadgeClass = {
  Pending: "bg-accent text-accent-foreground",
  Approved: "bg-chart-3/20 text-foreground",
  Rejected: "bg-destructive/15 text-destructive"
};
const getApprovalStatus = (status) => status || "Pending";
const parseCodeDispositions = (incident) => {
  try {
    const parsed = JSON.parse(incident.incidentCodes);
    if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.code === "string")) return parsed.map((item, index) => ({
      code: item.code,
      disposition: item.disposition || incident.disposition || `Disposition ${index + 1}`
    }));
  } catch {
  }
  const codes = incident.incidentCodes.split(",").map((value) => value.trim()).filter(Boolean);
  const dispositions = incident.disposition.split(",").map((value) => value.trim()).filter(Boolean);
  return codes.map((code, index) => ({
    code,
    disposition: dispositions[index] || dispositions[0] || "Not specified"
  }));
};
function LoadingShell() {
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center bg-background", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsx(ShieldCheck, { className: "size-5 animate-pulse text-primary" }),
    " Loading command center…"
  ] }) });
}
function DashboardHome() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [caseFiles, setCaseFiles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [clockBusy, setClockBusy] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [editingIncident, setEditingIncident] = useState(null);
  const [reviewingIncident, setReviewingIncident] = useState(null);
  const [dark, setDark] = useState(false);
  const [accessLevel, setAccessLevel] = useState("user");
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const incidentTable = useMemo(() => blink.db.table("incidents"), []);
  const caseFileTable = useMemo(() => blink.db.table("case_files"), []);
  const equipmentTable = useMemo(() => blink.db.table("equipment"), []);
  const evidenceTable = useMemo(() => blink.db.table("evidence"), []);
  const eventTable = useMemo(() => blink.db.table("custody_events"), []);
  const attendanceTable = useMemo(() => blink.db.table("attendance_logs"), []);
  const rolesTable = useMemo(() => blink.db.table("app_roles"), []);
  const usersTable = useMemo(() => blink.db.table("users"), []);
  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
      if (!state.isLoading) {
        setAuthLoading(false);
        setAuthReady(true);
      }
    });
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("safeguard-theme") === "dark";
    document.documentElement.classList.toggle("dark", saved);
    setTimeout(() => setDark(saved), 0);
  }, []);
  useEffect(() => {
    if (!user) return;
    const devRole = getDevRole();
    if (devRole) {
      setAccessLevel(devRole);
      return;
    }
    rolesTable.list({
      where: {
        userId: user.id
      },
      limit: 1
    }).then((rows) => setAccessLevel(rows[0]?.role || "user")).catch(() => setAccessLevel("user"));
  }, [user, rolesTable]);
  useEffect(() => {
    if (!user) return;
    usersTable.list({
      orderBy: {
        createdAt: "asc"
      },
      limit: 100
    }).then(setDirectoryUsers).catch(() => setDirectoryUsers([]));
  }, [user, usersTable]);
  useEffect(() => {
    if (!user) return;
    const loadRecords = async () => {
      try {
        const [i, cf, eq, ev, ce, attendance] = await Promise.all([incidentTable.list(canApproveIncidents(accessLevel) ? {
          orderBy: {
            createdAt: "desc"
          },
          limit: 100
        } : {
          where: {
            userId: user.id
          },
          orderBy: {
            createdAt: "desc"
          },
          limit: 100
        }), caseFileTable.list({
          where: {
            userId: user.id
          },
          orderBy: {
            updatedAt: "desc"
          },
          limit: 100
        }), equipmentTable.list({
          where: {
            userId: user.id
          },
          orderBy: {
            updatedAt: "desc"
          },
          limit: 8
        }), evidenceTable.list({
          where: {
            userId: user.id
          },
          orderBy: {
            createdAt: "desc"
          },
          limit: 8
        }), eventTable.list({
          where: {
            userId: user.id
          },
          orderBy: {
            eventAt: "desc"
          },
          limit: 10
        }), attendanceTable.list({
          where: {
            userId: user.id
          },
          orderBy: {
            eventAt: "desc"
          },
          limit: 30
        })]);
        setIncidents(i);
        setCaseFiles(cf);
        setEquipment(eq);
        setEvidence(ev);
        setEvents(ce);
        setAttendanceLogs(attendance);
      } catch (error) {
        toast.error("Could not load records", {
          description: error instanceof Error ? error.message : "Please try again."
        });
      }
    };
    loadRecords();
  }, [user, accessLevel, incidentTable, caseFileTable, equipmentTable, evidenceTable, eventTable, attendanceTable]);
  const availableEquipment = useMemo(() => equipment.filter((item) => item.status === "Available").length, [equipment]);
  const activeCases = useMemo(() => caseFiles.filter((file) => !["closed", "archived", "complete"].includes(file.status.toLowerCase())), [caseFiles]);
  const pendingReviews = useMemo(() => incidents.filter((item) => getApprovalStatus(item.approvalStatus) === "Pending"), [incidents]);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("safeguard-theme", String(next));
    document.documentElement.classList.toggle("dark", next);
  };
  const clockEvent = (eventType) => {
    if (!user || clockBusy) return;
    setClockBusy(true);
    const saveLog = (latitude = null, longitude = null, accuracy = null) => {
      const log = {
        userId: user.id,
        eventType,
        eventAt: (/* @__PURE__ */ new Date()).toISOString(),
        latitude,
        longitude,
        accuracy
      };
      attendanceTable.create(log).then((saved) => {
        setAttendanceLogs((current) => [saved, ...current]);
        toast.success(eventType === "clock_in" ? "Clocked in" : "Clocked out", {
          description: latitude === null ? "Time recorded. Location was unavailable." : "Time and GPS location recorded."
        });
      }).catch((error) => toast.error("Could not record attendance", {
        description: error.message
      })).finally(() => setClockBusy(false));
    };
    if (!navigator.geolocation) {
      saveLog();
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => saveLog(position.coords.latitude, position.coords.longitude, position.coords.accuracy), () => saveLog(), {
      enableHighAccuracy: true,
      timeout: 1e4,
      maximumAge: 0
    });
  };
  const lastAttendance = attendanceLogs[0];
  const isClockedIn = lastAttendance?.eventType === "clock_in";
  const approveIncident = async (incident) => {
    if (!canApproveIncidents(accessLevel)) return;
    try {
      const approvedAt = (/* @__PURE__ */ new Date()).toISOString();
      await incidentTable.update(incident.id, {
        approvalStatus: "Approved",
        approvedBy: user?.displayName || user?.email || "Supervisor",
        approvedAt
      });
      setIncidents((current) => current.map((item) => item.id === incident.id ? {
        ...item,
        approvalStatus: "Approved",
        approvedBy: user?.displayName || user?.email || "Supervisor",
        approvedAt
      } : item));
      toast.success("Incident approved", {
        description: `${incident.reportNumber} is now approved.`
      });
    } catch (error) {
      toast.error("Could not approve incident", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  const reviewIncident = (incident) => {
    setReviewingIncident(incident);
    setActivePanel("review");
  };
  const openIncidentEditor = (incident) => {
    setEditingIncident(incident || null);
    setActivePanel("incident");
  };
  const openSupplementalEditor = (incident) => {
    const base = incident.reportNumber.split(".")[0];
    const nextNumber = incidents.filter((item) => item.parentIncidentId === incident.id || item.reportNumber.startsWith(`${base}.`)).length + 1;
    setEditingIncident({
      ...incident,
      id: "",
      reportNumber: `${base}.${nextNumber}`,
      reportType: "Supplemental",
      parentIncidentId: incident.id,
      narrative: "",
      incidentCodes: "[]",
      disposition: "[]",
      approvalStatus: "Pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    setActivePanel("incident");
  };
  const printAllIncidents = () => window.print();
  if (authLoading) return /* @__PURE__ */ jsx(LoadingShell, {});
  if (!user) return /* @__PURE__ */ jsx(LoginGate, {});
  const recordUserId = user.id;
  const displayUser = user || {
    displayName: "Development officer"
  };
  return /* @__PURE__ */ jsxs("div", { className: "min-h-dvh bg-background text-foreground", children: [
    /* @__PURE__ */ jsx("header", { className: "border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-[1440px] items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "size-5" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold tracking-tight", children: "SafeGuard RMS" }),
          /* @__PURE__ */ jsx("p", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: "Operations / Command center" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: toggleTheme, "aria-label": "Toggle light and dark mode", children: dark ? /* @__PURE__ */ jsx(Sun, { className: "size-4" }) : /* @__PURE__ */ jsx(Moon, { className: "size-4" }) }),
        /* @__PURE__ */ jsx(UserAccountMenu, {})
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("main", { className: "mx-auto max-w-[1440px] space-y-7 px-4 py-6 md:px-8 md:py-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-between gap-4 sm:flex-row sm:items-end", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary", children: "Tuesday · September 01, 2026" }),
          /* @__PURE__ */ jsxs("h1", { className: "font-serif text-3xl tracking-tight md:text-4xl", children: [
            "Good evening, ",
            displayUser.displayName?.split(" ")[0] || "Officer",
            "."
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 max-w-xl text-sm text-muted-foreground", children: "Your operational picture at a glance. Keep reports precise, custody continuous, and your team equipped." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary", children: [
              ACCESS_LABELS[accessLevel],
              " access"
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: "Five-level access control is active" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsxs(Button, { variant: isClockedIn ? "outline" : "default", onClick: () => clockEvent(isClockedIn ? "clock_out" : "clock_in"), disabled: clockBusy, children: [
            /* @__PURE__ */ jsx(MapPin, { className: "size-4" }),
            clockBusy ? "Locating…" : isClockedIn ? "Clock out" : "Clock in"
          ] }),
          /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => setActivePanel("evidence"), disabled: !canCreateRecords(accessLevel), children: [
            /* @__PURE__ */ jsx(Archive, { className: "size-4" }),
            "Log property"
          ] }),
          /* @__PURE__ */ jsxs(Button, { onClick: () => openIncidentEditor(), disabled: !canCreateRecords(accessLevel), children: [
            /* @__PURE__ */ jsx(Plus, { className: "size-4" }),
            "New report"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-5", children: [
        /* @__PURE__ */ jsx(Metric, { icon: /* @__PURE__ */ jsx(FileText, {}), label: "Open reports", value: String(incidents.length), detail: "Needs disposition review", accent: "bg-primary" }),
        /* @__PURE__ */ jsx(Metric, { icon: /* @__PURE__ */ jsx(AlertTriangle, {}), label: "Flagged subjects", value: String(incidents.filter((i) => Number(i.violentFlag) || Number(i.banBarFlag)).length), detail: "Violent or ban / bar", accent: "bg-destructive" }),
        /* @__PURE__ */ jsx(Metric, { icon: /* @__PURE__ */ jsx(ClipboardPlus, {}), label: "Active cases", value: String(activeCases.length), detail: "Open operational files", accent: "bg-chart-2" }),
        /* @__PURE__ */ jsx(Metric, { icon: /* @__PURE__ */ jsx(Package, {}), label: "Available equipment", value: String(availableEquipment), detail: `${equipment.length} total tracked`, accent: "bg-chart-3" }),
        /* @__PURE__ */ jsx(Metric, { icon: /* @__PURE__ */ jsx(Clock3, {}), label: "Custody events", value: String(events.length), detail: "Latest activity log", accent: "bg-accent" })
      ] }),
      canApproveIncidents(accessLevel) && /* @__PURE__ */ jsx(Card, { className: "border-primary/30 bg-primary/5", children: /* @__PURE__ */ jsxs(CardContent, { className: "flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground", children: /* @__PURE__ */ jsx(Eye, { className: "size-4" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold", children: "Supervisor review queue" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: pendingReviews.length ? `${pendingReviews.length} report${pendingReviews.length === 1 ? "" : "s"} waiting for approval.` : "No reports are waiting for approval." })
          ] })
        ] }),
        pendingReviews.length > 0 && /* @__PURE__ */ jsxs(Button, { size: "sm", onClick: () => reviewIncident(pendingReviews[0]), children: [
          "Review next",
          /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-3.5" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("section", { id: "incidents", className: "scroll-mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]", children: [
        /* @__PURE__ */ jsxs(Card, { className: "overflow-hidden", children: [
          /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "Recent incident reports" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Your latest reports and review status" })
            ] }),
            /* @__PURE__ */ jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openIncidentEditor(), disabled: !canCreateRecords(accessLevel), children: [
              "Create report",
              /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-3.5" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { className: "p-0", children: incidents.length ? incidents.map((item) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted/30", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground", children: /* @__PURE__ */ jsx(FileText, { className: "size-4" }) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("p", { className: "truncate text-sm font-medium", children: [
                  item.reportNumber,
                  " · ",
                  item.location
                ] }),
                /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-xs", children: parseCodeDispositions(item).map((pair, index) => /* @__PURE__ */ jsxs("span", { className: "rounded bg-secondary px-2 py-1 text-secondary-foreground", children: [
                  /* @__PURE__ */ jsxs("span", { className: "font-mono text-[10px] uppercase tracking-wide text-muted-foreground", children: [
                    "Code ",
                    index + 1
                  ] }),
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "font-medium", children: pair.code }),
                  /* @__PURE__ */ jsx("span", { className: "mx-1 text-muted-foreground", children: "→" }),
                  /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: pair.disposition })
                ] }, `${pair.code}-${index}`)) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: `hidden rounded-full px-2 py-1 font-mono text-[10px] sm:block ${approvalBadgeClass[getApprovalStatus(item.approvalStatus)]}`, children: getApprovalStatus(item.approvalStatus) }),
              /* @__PURE__ */ jsx("span", { className: "hidden rounded-full bg-accent px-2 py-1 font-mono text-[10px] text-accent-foreground sm:block", children: Number(item.violentFlag) ? "VIOLENT" : Number(item.banBarFlag) ? "BAN / BAR" : "STANDARD" }),
              canApproveIncidents(accessLevel) && item.approvalStatus !== "Approved" && /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick: () => approveIncident(item), children: "Approve" }),
              /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick: () => openIncidentEditor(item), disabled: !canCreateRecords(accessLevel), children: "Edit" }),
              /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: () => openSupplementalEditor(item), disabled: !canCreateRecords(accessLevel), children: "Supplement" })
            ] })
          ] }, item.id)) : /* @__PURE__ */ jsx(Empty, { icon: /* @__PURE__ */ jsx(FileText, {}), text: "No reports yet. Start with the facts.", action: () => openIncidentEditor() }) })
        ] }),
        /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsxs(CardHeader, { className: "border-b border-border bg-muted/30 pb-4", children: [
            /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "Custody activity" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Evidence movement, logged live" })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { className: "p-0", children: events.length ? events.slice(0, 5).map((event) => /* @__PURE__ */ jsxs("div", { className: "flex gap-3 border-b border-border px-5 py-4 last:border-0", children: [
            /* @__PURE__ */ jsx("div", { className: "mt-1 size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: event.action }),
              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [
                event.actor,
                " · ",
                event.note || "No note added"
              ] })
            ] })
          ] }, event.id)) : /* @__PURE__ */ jsx(Empty, { icon: /* @__PURE__ */ jsx(Archive, {}), text: "No custody events logged.", action: () => setActivePanel("evidence") }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsx("div", { id: "equipment", className: "scroll-mt-6", children: /* @__PURE__ */ jsx(ActionCard, { icon: /* @__PURE__ */ jsx(Crosshair, {}), title: "Equipment issue desk", description: `${equipment.length} assets tracked · ${availableEquipment} ready to issue`, action: canCreateRecords(accessLevel) ? "Issue equipment" : "Read only", onClick: () => canCreateRecords(accessLevel) && setActivePanel("equipment"), children: /* @__PURE__ */ jsx("div", { className: "flex -space-x-2", children: equipment.slice(0, 4).map((item) => /* @__PURE__ */ jsx("div", { className: "flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary font-mono text-[10px] text-secondary-foreground", children: item.name.slice(0, 1) }, item.id)) }) }) }),
        /* @__PURE__ */ jsx("div", { id: "evidence", className: "scroll-mt-6", children: /* @__PURE__ */ jsx(ActionCard, { icon: /* @__PURE__ */ jsx(Users, {}), title: "Evidence inventory", description: `${evidence.length} property items · chain of custody intact`, action: canCreateRecords(accessLevel) ? "Log property" : "Read only", onClick: () => canCreateRecords(accessLevel) && setActivePanel("evidence"), children: /* @__PURE__ */ jsxs("div", { className: "font-mono text-xs text-muted-foreground", children: [
          "AUDIT READY ",
          /* @__PURE__ */ jsx("span", { className: "text-primary", children: "●" })
        ] }) }) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "Case files" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Manage cases and their related reports." })
            ] }),
            /* @__PURE__ */ jsxs(Button, { variant: "outline", size: "sm", onClick: () => setActivePanel("case"), disabled: !canCreateRecords(accessLevel), children: [
              /* @__PURE__ */ jsx(Plus, { className: "size-3.5" }),
              "New case"
            ] })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { className: "p-0", children: caseFiles.length ? caseFiles.map((file) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium", children: [
                file.caseNumber,
                " · ",
                file.title
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
                file.status,
                " ·",
                " ",
                incidents.filter((item) => item.caseFileId === file.id).length,
                " ",
                "report(s)"
              ] })
            ] }),
            /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: () => setActivePanel("incident"), disabled: !canCreateRecords(accessLevel), children: "Add report" })
          ] }, file.id)) : /* @__PURE__ */ jsx(Empty, { icon: /* @__PURE__ */ jsx(ClipboardPlus, {}), text: "No case files yet.", action: () => setActivePanel("case") }) })
        ] }),
        /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "Printable reports" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Print the incident register." })
            ] }),
            /* @__PURE__ */ jsxs(Button, { variant: "outline", size: "sm", onClick: printAllIncidents, children: [
              /* @__PURE__ */ jsx(FileText, { className: "size-3.5" }),
              "Print all"
            ] })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground", children: [
            incidents.length,
            " report",
            incidents.length === 1 ? "" : "s",
            " ready to print."
          ] }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "hidden print:block", children: [
        /* @__PURE__ */ jsx("h1", { className: "mb-6 text-2xl font-bold", children: "SafeGuard RMS — Incident Report Register" }),
        incidents.map((item) => /* @__PURE__ */ jsxs("article", { className: "mb-8 break-inside-avoid border-b border-foreground pb-5", children: [
          /* @__PURE__ */ jsxs("h2", { className: "text-lg font-bold", children: [
            item.reportNumber,
            " ",
            item.reportType && item.reportType !== "Original" ? `· ${item.reportType}` : ""
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Incident date: ",
            item.incidentDate,
            " · Location: ",
            item.location,
            ",",
            " ",
            item.city,
            ", ",
            item.state,
            " ",
            item.zipCode
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Subject: ",
            item.subjectName,
            " · Flags:",
            " ",
            Number(item.violentFlag) ? "Violent " : "",
            Number(item.banBarFlag) ? "Ban / Bar" : "None"
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Codes / dispositions:",
            " ",
            parseCodeDispositions(item).map((pair) => `${pair.code} — ${pair.disposition}`).join("; ")
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 whitespace-pre-wrap", children: item.narrative })
        ] }, item.id))
      ] })
    ] }),
    activePanel && activePanel !== "review" && /* @__PURE__ */ jsx(Panel, { type: activePanel, userId: recordUserId, accessLevel, directoryUsers, initialIncident: editingIncident, onClose: () => {
      setActivePanel(null);
      setEditingIncident(null);
    }, onSaved: () => {
      setActivePanel(null);
      setEditingIncident(null);
      window.location.reload();
    }, incidentTable, caseFileTable, equipmentTable, evidenceTable, eventTable }),
    /* @__PURE__ */ jsx(DevAccountSwitcher, {})
  ] });
}
function Metric({
  icon,
  label,
  value,
  detail,
  accent
}) {
  return /* @__PURE__ */ jsxs(Card, { className: "relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5", children: [
    /* @__PURE__ */ jsx("div", { className: `absolute inset-y-0 left-0 w-1 ${accent}` }),
    /* @__PURE__ */ jsxs(CardContent, { className: "p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: icon }),
        /* @__PURE__ */ jsx("span", { className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: "Live" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-3xl font-semibold tracking-tight", children: value }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-medium", children: label }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: detail })
    ] })
  ] });
}
function Empty({
  icon,
  text,
  action
}) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3 px-5 py-12 text-center", children: [
    /* @__PURE__ */ jsx("div", { className: "flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground", children: icon }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: text }),
    /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick: action, children: "Get started" })
  ] });
}
function ActionCard({
  icon,
  title,
  description,
  action,
  onClick,
  children
}) {
  return /* @__PURE__ */ jsxs(Card, { className: "flex items-center justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-4", children: [
      /* @__PURE__ */ jsx("div", { className: "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary", children: icon }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold", children: title }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 truncate text-xs text-muted-foreground", children: description })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-3 sm:flex", children: [
      children,
      /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick, disabled: action === "Read only", children: action })
    ] }),
    /* @__PURE__ */ jsx(Button, { variant: "outline", size: "icon", className: "sm:hidden", onClick, disabled: action === "Read only", "aria-label": action, children: /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-4" }) })
  ] });
}
function LoginGate() {
  const [busy, setBusy] = useState(false);
  const openSignIn = () => {
    setBusy(true);
    blink.auth.login();
  };
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center bg-primary px-5", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md rounded-2xl border border-border/30 bg-card p-8 text-card-foreground shadow-lg", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-8 flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("div", { className: "flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "size-5" }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-semibold", children: "SafeGuard RMS" }),
        /* @__PURE__ */ jsx("p", { className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground", children: "Secure operations" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "font-serif text-3xl", children: "Sign in to command." }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Use the secure SafeGuard sign-in to access the records desk." }),
    /* @__PURE__ */ jsxs(Button, { className: "mt-7 w-full", size: "lg", onClick: openSignIn, disabled: busy, children: [
      busy ? "Opening secure sign-in…" : "Continue to secure sign-in",
      /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-4" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "my-5 flex items-center gap-3 text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-border" }),
      "OR",
      /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-border" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-5 text-center text-xs text-muted-foreground", children: "Email, password, account creation, and Google sign-in are handled securely." }),
    false
  ] }) });
}
function Panel({
  type,
  userId,
  accessLevel,
  directoryUsers,
  initialIncident,
  onClose,
  onSaved,
  incidentTable,
  caseFileTable,
  equipmentTable,
  evidenceTable,
  eventTable
}) {
  const [saving, setSaving] = useState(false);
  const [availableEvidence, setAvailableEvidence] = useState([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState([]);
  const [form, setForm] = useState(() => initialIncident ? {
    reportNumber: initialIncident.reportNumber,
    incidentDate: initialIncident.incidentDate,
    location: initialIncident.location,
    city: initialIncident.city || "",
    state: initialIncident.state || "",
    zipCode: initialIncident.zipCode || "",
    subjectName: initialIncident.subjectName,
    subjectPhone: initialIncident.subjectPhone || "",
    subjectDob: initialIncident.subjectDob || "",
    narrative: initialIncident.narrative,
    violentFlag: Number(initialIncident.violentFlag) ? "1" : "",
    banBarFlag: Number(initialIncident.banBarFlag) ? "1" : "",
    assignedTo: initialIncident.userId,
    caseFileId: initialIncident.caseFileId || ""
  } : {
    assignedTo: userId
  });
  const [caseTitle, setCaseTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [codeDispositions, setCodeDispositions] = useState(() => initialIncident ? parseCodeDispositions(initialIncident) : [{
    code: "",
    disposition: ""
  }]);
  useEffect(() => {
    if (type !== "incident") return;
    evidenceTable.list({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      limit: 100
    }).then((rows) => {
      setAvailableEvidence(rows);
      setSelectedEvidenceIds(initialIncident ? rows.filter((item) => item.incidentId === initialIncident.id).map((item) => item.id) : []);
    }).catch((error) => toast.error("Could not load property items", {
      description: error.message
    }));
  }, [type, userId, initialIncident, evidenceTable]);
  const toggleEvidence = (evidenceId) => setSelectedEvidenceIds((current) => current.includes(evidenceId) ? current.filter((id) => id !== evidenceId) : [...current, evidenceId]);
  const updatePair = (index, key, value) => setCodeDispositions((current) => current.map((pair, pairIndex) => pairIndex === index ? {
    ...pair,
    [key]: value
  } : pair));
  const addPair = () => setCodeDispositions((current) => [...current, {
    code: "",
    disposition: ""
  }]);
  const removePair = (index) => setCodeDispositions((current) => current.length === 1 ? current : current.filter((_, pairIndex) => pairIndex !== index));
  const update = (key) => (e) => setForm((prev) => ({
    ...prev,
    [key]: e.target.value
  }));
  const field = (label, key, placeholder = "", type2 = "text") => /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
    /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: label }),
    /* @__PURE__ */ jsx(Input, { type: type2, placeholder, value: form[key] || "", onChange: update(key) })
  ] });
  const equipmentAssignment = type === "equipment" ? /* @__PURE__ */ jsxs("label", { className: "space-y-1.5 sm:col-span-2", children: [
    /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Assign to user" }),
    /* @__PURE__ */ jsxs("select", { className: "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring", value: form.assignedTo || userId, onChange: update("assignedTo"), children: [
      /* @__PURE__ */ jsx("option", { value: userId, children: "Myself" }),
      directoryUsers.filter((item) => item.id !== userId).map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.displayName || item.email }, item.id))
    ] })
  ] }) : null;
  const save = async () => {
    if (!canCreateRecords(accessLevel)) {
      toast.error("Read-only access", {
        description: "Support users can review records but cannot create them."
      });
      return;
    }
    if (type === "case") {
      if (!caseNumber.trim() || !caseTitle.trim()) {
        toast.error("Complete the case fields", {
          description: "Case number and title are required."
        });
        return;
      }
      setSaving(true);
      try {
        await caseFileTable.create({
          userId,
          caseNumber: caseNumber.trim(),
          title: caseTitle.trim(),
          status: "Open",
          leadOfficer: userId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        toast.success("Case file created");
        onSaved();
      } catch (error) {
        toast.error("Could not save case file", {
          description: error instanceof Error ? error.message : "Please try again."
        });
      } finally {
        setSaving(false);
      }
      return;
    }
    const requiredFields = type === "incident" ? [["location", "Location"], ["city", "City"], ["state", "State"], ["zipCode", "ZIP code"], ["subjectName", "Subject name"], ["narrative", "Narrative"]] : type === "equipment" ? [["name", "Equipment name"], ["serialNumber", "Serial number"]] : [["itemNumber", "Item number"], ["description", "Description"], ["location", "Found / stored location"]];
    const missingField = requiredFields.find(([key]) => !form[key]?.trim());
    if (missingField) {
      toast.error("Complete the required fields", {
        description: `${missingField[1]} is required before saving.`
      });
      return;
    }
    const completedPairs = codeDispositions.map((pair) => ({
      code: pair.code.trim(),
      disposition: pair.disposition.trim()
    })).filter((pair) => pair.code || pair.disposition);
    if (type === "incident" && (completedPairs.length === 0 || completedPairs.some((pair) => !pair.code || !pair.disposition))) {
      toast.error("Complete the code and disposition pairs", {
        description: "Each incident code must have its corresponding disposition."
      });
      return;
    }
    setSaving(true);
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (type === "incident") {
        const baseReportNumber = form.reportNumber?.trim() || `SG-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Date.now()).slice(-5)}`;
        const payload = {
          userId,
          reportNumber: baseReportNumber,
          incidentDate: form.incidentDate || now.slice(0, 10),
          location: form.location.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          zipCode: form.zipCode.trim(),
          subjectName: form.subjectName.trim(),
          subjectPhone: form.subjectPhone?.trim() || void 0,
          subjectDob: form.subjectDob?.trim() || void 0,
          violentFlag: form.violentFlag ? 1 : 0,
          banBarFlag: form.banBarFlag ? 1 : 0,
          incidentCodes: JSON.stringify(completedPairs.map((pair) => pair.code)),
          disposition: JSON.stringify(completedPairs),
          narrative: form.narrative.trim(),
          approvalStatus: initialIncident?.approvalStatus === "Rejected" ? "Pending" : initialIncident?.approvalStatus || "Pending",
          reviewFeedback: initialIncident?.approvalStatus === "Rejected" ? null : initialIncident?.reviewFeedback || null,
          reviewedBy: initialIncident?.approvalStatus === "Rejected" ? null : initialIncident?.reviewedBy || null,
          reviewedAt: initialIncident?.approvalStatus === "Rejected" ? null : initialIncident?.reviewedAt || null,
          createdAt: initialIncident?.createdAt || now,
          caseFileId: form.caseFileId || null,
          parentIncidentId: initialIncident?.parentIncidentId || null,
          reportType: initialIncident?.reportType || "Original"
        };
        const savedIncident = initialIncident ? await incidentTable.update(initialIncident.id, payload) : await incidentTable.create(payload);
        const incidentId = savedIncident.id;
        await Promise.all(availableEvidence.filter((item) => item.incidentId === incidentId && !selectedEvidenceIds.includes(item.id)).map((item) => evidenceTable.update(item.id, {
          incidentId: null
        })));
        await Promise.all(selectedEvidenceIds.map((id) => evidenceTable.update(id, {
          incidentId
        })));
      }
      if (type === "equipment") {
        await equipmentTable.create({
          userId,
          name: form.name.trim(),
          serialNumber: form.serialNumber.trim(),
          status: "Available",
          assignedTo: form.assignedTo || userId,
          updatedAt: now
        });
      }
      if (type === "evidence") {
        const item = await evidenceTable.create({
          userId,
          itemNumber: form.itemNumber.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          status: "In custody",
          createdAt: now
        });
        await eventTable.create({
          userId,
          evidenceId: item.id,
          action: "Item received",
          actor: "Current officer",
          note: "Initial intake",
          eventAt: now
        });
      }
      toast.success(type === "incident" ? "Report submitted for supervisor approval" : type === "equipment" ? "Equipment added" : "Evidence logged");
      onSaved();
    } catch (error) {
      toast.error("Could not save record", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5", children: /* @__PURE__ */ jsxs("div", { className: "max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg sm:rounded-2xl sm:p-7", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-6 flex items-start justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("p", { className: "font-mono text-[10px] uppercase tracking-[0.2em] text-primary", children: [
          "Secure data entry · ",
          ACCESS_LABELS[accessLevel]
        ] }),
        /* @__PURE__ */ jsx("h2", { className: "mt-1 font-serif text-2xl", children: type === "case" ? "New case file" : type === "incident" ? initialIncident ? "Edit incident report" : "New incident report" : type === "equipment" ? "Add equipment asset" : "Log property / evidence" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: type === "case" ? "Create a case file to organize related incident reports." : type === "incident" ? "Capture the facts, flags, codes, disposition, and narrative in one review-ready record." : "Required fields are marked by the save validation." })
      ] }),
      /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, "aria-label": "Close", children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: type === "case" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: field("Case number", "caseNumber", "CASE-2026-0001") }),
      /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: field("Case title", "caseTitle", "Burglary investigation") })
    ] }) : type === "incident" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2 grid gap-4 sm:grid-cols-2", children: [
        field("Report number", "reportNumber", "Auto-generated if blank"),
        field("Incident date", "incidentDate", "", "date")
      ] }),
      field("Location", "location", "123 Main St / sector 4"),
      field("City", "city", "Springfield"),
      field("State", "state", "CA"),
      field("ZIP code", "zipCode", "90210"),
      field("Subject name", "subjectName", "Full legal name"),
      field("Contact phone", "subjectPhone", "(555) 000-0000", "tel"),
      field("Date of birth", "subjectDob", "MM / DD / YYYY"),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-medium sm:col-span-2", children: "Report flags" }),
        /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: form.violentFlag === "1", onChange: (event) => setForm((prev) => ({
            ...prev,
            violentFlag: event.target.checked ? "1" : ""
          })), className: "size-4 accent-primary" }),
          "Violent subject / incident"
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: form.banBarFlag === "1", onChange: (event) => setForm((prev) => ({
            ...prev,
            banBarFlag: event.target.checked ? "1" : ""
          })), className: "size-4 accent-primary" }),
          "Ban / bar flag"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3 sm:col-span-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium", children: "Incident codes and dispositions" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Pair every code with the action or outcome it received." })
          ] }),
          /* @__PURE__ */ jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: addPair, children: [
            /* @__PURE__ */ jsx(Plus, { className: "size-3.5" }),
            "Add pair"
          ] })
        ] }),
        codeDispositions.map((pair, index) => /* @__PURE__ */ jsxs("div", { className: "grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1.4fr_auto]", children: [
          /* @__PURE__ */ jsx(Input, { value: pair.code, onChange: (event) => updatePair(index, "code", event.target.value), placeholder: "Code e.g. 240", "aria-label": `Incident code ${index + 1}` }),
          /* @__PURE__ */ jsx(Input, { value: pair.disposition, onChange: (event) => updatePair(index, "disposition", event.target.value), placeholder: "Corresponding disposition", "aria-label": `Disposition for code ${index + 1}` }),
          /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", size: "icon", onClick: () => removePair(index), disabled: codeDispositions.length === 1, "aria-label": `Remove code ${index + 1}`, children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
        ] }, `pair-${index}`))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-medium", children: "Associated property / evidence" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Select one or more items tied to this report." })
        ] }),
        availableEvidence.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: availableEvidence.map((item) => /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/40", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: selectedEvidenceIds.includes(item.id), onChange: () => toggleEvidence(item.id), className: "mt-0.5 size-4 accent-primary" }),
          /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("span", { className: "block font-medium", children: item.itemNumber }),
            /* @__PURE__ */ jsxs("span", { className: "mt-1 block truncate text-xs text-muted-foreground", children: [
              item.description,
              " · ",
              item.location
            ] })
          ] })
        ] }, item.id)) }) : /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "No property items yet. Log property first, then associate it here." })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5 sm:col-span-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Narrative" }),
        /* @__PURE__ */ jsx("textarea", { className: "min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-ring focus-visible:ring-[3px]", placeholder: "Document the facts, sequence, witnesses, and actions taken…", value: form.narrative || "", onChange: update("narrative") })
      ] })
    ] }) : type === "equipment" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      field("Equipment name", "name", "Body camera / radio / kit"),
      field("Serial number", "serialNumber", "Asset identifier"),
      equipmentAssignment
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      field("Item number", "itemNumber", "EV-2026-0001"),
      field("Description", "description", "Describe the item and packaging"),
      field("Found / stored location", "location", "Evidence locker / room")
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-7 flex justify-end gap-2 border-t border-border pt-5", children: [
      /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsxs(Button, { onClick: save, disabled: saving, children: [
        saving ? "Saving…" : initialIncident && type === "incident" ? "Update report" : "Save securely",
        " ",
        /* @__PURE__ */ jsx(ArrowUpRight, { className: "size-4" })
      ] })
    ] })
  ] }) });
}
const SplitComponent = () => /* @__PURE__ */ jsx(BlinkClientBoundary, { fallback: /* @__PURE__ */ jsx(LoadingShell, {}), children: /* @__PURE__ */ jsx(DashboardHome, {}) });
export {
  SplitComponent as component
};
