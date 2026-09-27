import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from "react";
import { b as blink, B as Button } from "./client-C5cN3m_d.js";
import { C as Card, b as CardHeader, c as CardTitle, a as CardContent, I as Input } from "./input-40gxQptb.js";
import { toast } from "sonner";
import { Clock3, Plus, CalendarDays, ChevronLeft, ChevronRight, X, Save } from "lucide-react";
import { A as ACCESS_LABELS, e as canEditSchedule, g as getDevRole } from "./dev-accounts-BXegeLyU.js";
import "@radix-ui/react-slot";
import "class-variance-authority";
import "./router-DEJXeonh.js";
import "@tanstack/react-router";
import "@tanstack/react-query";
import "@radix-ui/react-tooltip";
import "clsx";
import "tailwind-merge";
import "@blinkdotnew/sdk";
const PTO_TYPES = ["Vacation", "Sick", "Civil/Jury Duty", "Military", "Bereavement"];
const formatDate = (date) => date.toISOString().slice(0, 10);
const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const lastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const startOfCalendar = (date) => {
  const first = firstDayOfMonth(date);
  const day = first.getDay();
  return new Date(first.getFullYear(), first.getMonth(), 1 - day);
};
const endOfCalendar = (date) => {
  const last = lastDayOfMonth(date);
  const day = last.getDay();
  return new Date(last.getFullYear(), last.getMonth(), last.getDate() + (6 - day));
};
const datesBetween = (start, end) => {
  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};
function SchedulerPage() {
  const [user, setUser] = useState(null);
  const [accessLevel, setAccessLevel] = useState("user");
  const [users, setUsers] = useState([]);
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [ptoRequests, setPtoRequests] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(() => /* @__PURE__ */ new Date());
  const [showShiftEditor, setShowShiftEditor] = useState(false);
  const [showPtoEditor, setShowPtoEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedPtoRequest, setSelectedPtoRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const rolesTable = useMemo(() => blink.db.table("app_roles"), []);
  const usersTable = useMemo(() => blink.db.table("users"), []);
  const scheduleTable = useMemo(() => blink.db.table("schedule_entries"), []);
  const ptoTable = useMemo(() => blink.db.table("pto_requests"), []);
  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
      if (!state.isLoading) {
        setAuthLoading(false);
      }
    });
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
    const load = async () => {
      setLoading(true);
      try {
        const [usersResult, scheduleResult, ptoResult] = await Promise.all([usersTable.list({
          orderBy: {
            createdAt: "asc"
          },
          limit: 500
        }), scheduleTable.list({
          limit: 1e3
        }), ptoTable.list({
          limit: 1e3
        })]);
        setUsers(usersResult);
        setScheduleEntries(scheduleResult);
        setPtoRequests(ptoResult);
      } catch (error) {
        toast.error("Could not load scheduler", {
          description: error instanceof Error ? error.message : "Please try again."
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, usersTable, scheduleTable, ptoTable]);
  const calendarDates = useMemo(() => datesBetween(startOfCalendar(currentMonth), endOfCalendar(currentMonth)), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
  const userName = (userId) => users.find((item) => item.id === userId)?.displayName || users.find((item) => item.id === userId)?.email || userId;
  const openNewShift = (date) => {
    if (!canEditSchedule(accessLevel)) return;
    const shift = date ? {
      id: "",
      userId: user?.id || "",
      shiftDate: date,
      startTime: "08:00",
      endTime: "16:00",
      title: "Regular shift",
      notes: "",
      createdAt: "",
      updatedAt: ""
    } : null;
    setEditingEntry(shift);
    setShowShiftEditor(true);
  };
  const saveShift = async (entry) => {
    if (!canEditSchedule(accessLevel) || !user) return;
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (entry.id) {
        const updated = await scheduleTable.update(entry.id, {
          userId: entry.userId,
          shiftDate: entry.shiftDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.title,
          notes: entry.notes || null,
          updatedAt: now
        });
        setScheduleEntries((current) => current.map((item) => item.id === entry.id ? updated : item));
      } else {
        const created = await scheduleTable.create({
          userId: entry.userId || user.id,
          shiftDate: entry.shiftDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.title,
          notes: entry.notes || null,
          createdAt: now,
          updatedAt: now
        });
        setScheduleEntries((current) => [created, ...current]);
      }
      setShowShiftEditor(false);
      setEditingEntry(null);
      toast.success("Schedule saved");
    } catch (error) {
      toast.error("Could not save schedule entry", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  const submitPtoRequest = async (data) => {
    if (!user) return;
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const created = await ptoTable.create({
        userId: user.id,
        ptoType: data.ptoType,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes || null,
        status: "Pending",
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: now,
        updatedAt: now
      });
      setPtoRequests((current) => [created, ...current]);
      setShowPtoEditor(false);
      toast.success("Time-off request submitted");
    } catch (error) {
      toast.error("Could not submit request", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  const reviewPto = async (request, decision) => {
    if (!canEditSchedule(accessLevel) || !user) return;
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updated = await ptoTable.update(request.id, {
        status: decision,
        reviewedBy: user.id,
        reviewedAt: now,
        updatedAt: now
      });
      setPtoRequests((current) => current.map((item) => item.id === request.id ? updated : item));
      setSelectedPtoRequest(null);
      toast.success(decision === "Approved" ? "Time off approved" : "Time off request denied");
    } catch (error) {
      toast.error("Could not update request", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  if (authLoading || !user || loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Loading scheduler…" }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "min-h-dvh bg-background p-5 md:p-8", children: [
    /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1600px] space-y-6", children: [
      /* @__PURE__ */ jsxs("header", { className: "flex flex-col justify-between gap-4 md:flex-row md:items-end", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "font-mono text-[10px] uppercase tracking-[0.2em] text-primary", children: "Operations" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-1 font-serif text-3xl", children: "Scheduler" }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Staffing, shifts, and time-off management." }),
          /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsxs("span", { className: "rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary", children: [
            ACCESS_LABELS[accessLevel],
            " access"
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => setShowPtoEditor(true), children: [
            /* @__PURE__ */ jsx(Clock3, { className: "size-4" }),
            "Request time off"
          ] }),
          canEditSchedule(accessLevel) && /* @__PURE__ */ jsxs(Button, { onClick: () => openNewShift(), children: [
            /* @__PURE__ */ jsx(Plus, { className: "size-4" }),
            "Add shift"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Card, { children: [
        /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-row items-center justify-between", children: [
          /* @__PURE__ */ jsxs(CardTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(CalendarDays, { className: "size-4" }),
            monthLabel
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
            /* @__PURE__ */ jsx(Button, { variant: "outline", size: "icon", onClick: () => setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)), children: /* @__PURE__ */ jsx(ChevronLeft, { className: "size-4" }) }),
            /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick: () => setCurrentMonth(/* @__PURE__ */ new Date()), children: "Today" }),
            /* @__PURE__ */ jsx(Button, { variant: "outline", size: "icon", onClick: () => setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)), children: /* @__PURE__ */ jsx(ChevronRight, { className: "size-4" }) })
          ] })
        ] }),
        /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-7 overflow-hidden rounded-lg border border-border", children: [
          ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => /* @__PURE__ */ jsx("div", { className: "border-b border-border bg-muted/30 p-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground", children: day.slice(0, 3) }, day)),
          calendarDates.map((date) => {
            const dateString = formatDate(date);
            const inMonth = date.getMonth() === currentMonth.getMonth();
            const entries = scheduleEntries.filter((entry) => entry.shiftDate === dateString);
            const approvedPto = ptoRequests.filter((request) => request.status === "Approved" && request.startDate <= dateString && request.endDate >= dateString);
            return /* @__PURE__ */ jsxs("div", { className: `min-h-32 border-b border-r border-border p-2 ${inMonth ? "bg-card" : "bg-muted/10"}`, children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: `text-xs font-medium ${inMonth ? "text-foreground" : "text-muted-foreground"}`, children: date.getDate() }),
                canEditSchedule(accessLevel) && inMonth && /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", className: "size-6", onClick: () => openNewShift(dateString), "aria-label": `Add shift for ${dateString}`, children: /* @__PURE__ */ jsx(Plus, { className: "size-3" }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                entries.map((entry) => /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
                  if (!canEditSchedule(accessLevel)) return;
                  setEditingEntry(entry);
                  setShowShiftEditor(true);
                }, className: "w-full rounded-md border border-border bg-primary/10 px-2 py-1 text-left text-[10px] hover:bg-primary/20", children: [
                  /* @__PURE__ */ jsx("p", { className: "truncate font-medium", children: userName(entry.userId) }),
                  /* @__PURE__ */ jsxs("p", { className: "truncate text-muted-foreground", children: [
                    entry.startTime,
                    "–",
                    entry.endTime
                  ] })
                ] }, entry.id)),
                approvedPto.map((request) => /* @__PURE__ */ jsxs("div", { className: "rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-[10px]", children: [
                  /* @__PURE__ */ jsx("p", { className: "font-medium", children: userName(request.userId) }),
                  /* @__PURE__ */ jsx("p", { className: "text-muted-foreground", children: request.ptoType })
                ] }, `${request.id}-${dateString}`))
              ] })
            ] }, dateString);
          })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-row items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "My time-off requests" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Requests you have submitted." })
            ] }),
            /* @__PURE__ */ jsxs(Button, { size: "sm", onClick: () => setShowPtoEditor(true), children: [
              /* @__PURE__ */ jsx(Plus, { className: "size-3.5" }),
              "Request"
            ] })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { className: "space-y-2", children: ptoRequests.filter((request) => request.userId === user.id).length ? ptoRequests.filter((request) => request.userId === user.id).map((request) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-border p-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: request.ptoType }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
                request.startDate,
                " through",
                " ",
                request.endDate
              ] })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "rounded-full bg-muted px-2 py-1 text-[10px]", children: request.status })
          ] }, request.id)) : /* @__PURE__ */ jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "No time-off requests." }) })
        ] }),
        canEditSchedule(accessLevel) && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsxs(CardHeader, { children: [
            /* @__PURE__ */ jsx(CardTitle, { className: "text-base", children: "Pending approvals" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Review employee time-off requests." })
          ] }),
          /* @__PURE__ */ jsx(CardContent, { className: "space-y-2", children: ptoRequests.filter((request) => request.status === "Pending").length ? ptoRequests.filter((request) => request.status === "Pending").map((request) => /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setSelectedPtoRequest(request), className: "w-full rounded-lg border border-border p-3 text-left hover:bg-muted/30", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: userName(request.userId) }),
            /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
              request.ptoType,
              " ·",
              " ",
              request.startDate,
              " –",
              " ",
              request.endDate
            ] })
          ] }, request.id)) : /* @__PURE__ */ jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "No pending requests." }) })
        ] })
      ] })
    ] }),
    showShiftEditor && /* @__PURE__ */ jsx(ShiftEditor, { entry: editingEntry, users, currentUserId: user.id, onClose: () => {
      setShowShiftEditor(false);
      setEditingEntry(null);
    }, onSave: saveShift }),
    showPtoEditor && /* @__PURE__ */ jsx(PtoRequestEditor, { onClose: () => setShowPtoEditor(false), onSubmit: submitPtoRequest }),
    selectedPtoRequest && /* @__PURE__ */ jsx(PtoReviewDialog, { request: selectedPtoRequest, userName: userName(selectedPtoRequest.userId), onClose: () => setSelectedPtoRequest(null), onApprove: () => reviewPto(selectedPtoRequest, "Approved"), onDeny: () => reviewPto(selectedPtoRequest, "Denied") })
  ] });
}
function ShiftEditor({
  entry,
  users,
  currentUserId,
  onClose,
  onSave
}) {
  const [form, setForm] = useState(entry || {
    id: "",
    userId: currentUserId,
    shiftDate: formatDate(/* @__PURE__ */ new Date()),
    startTime: "08:00",
    endTime: "16:00",
    title: "Regular shift",
    notes: "",
    createdAt: "",
    updatedAt: ""
  });
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-5 flex items-start justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Schedule" }),
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold", children: entry ? "Edit shift" : "Add shift" })
      ] }),
      /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4", children: [
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Employee" }),
        /* @__PURE__ */ jsx("select", { className: "h-10 w-full rounded-md border border-input bg-background px-3 text-sm", value: form.userId, onChange: (event) => setForm({
          ...form,
          userId: event.target.value
        }), children: users.map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.displayName || item.email }, item.id)) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Date" }),
        /* @__PURE__ */ jsx(Input, { type: "date", value: form.shiftDate, onChange: (event) => setForm({
          ...form,
          shiftDate: event.target.value
        }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Start" }),
          /* @__PURE__ */ jsx(Input, { type: "time", value: form.startTime, onChange: (event) => setForm({
            ...form,
            startTime: event.target.value
          }) })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "End" }),
          /* @__PURE__ */ jsx(Input, { type: "time", value: form.endTime, onChange: (event) => setForm({
            ...form,
            endTime: event.target.value
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Shift title" }),
        /* @__PURE__ */ jsx(Input, { value: form.title, onChange: (event) => setForm({
          ...form,
          title: event.target.value
        }) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Notes" }),
        /* @__PURE__ */ jsx("textarea", { className: "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm", value: form.notes || "", onChange: (event) => setForm({
          ...form,
          notes: event.target.value
        }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsxs(Button, { onClick: () => onSave(form), children: [
        /* @__PURE__ */ jsx(Save, { className: "size-4" }),
        "Save shift"
      ] })
    ] })
  ] }) });
}
function PtoRequestEditor({
  onClose,
  onSubmit
}) {
  const [ptoType, setPtoType] = useState("Vacation");
  const [startDate, setStartDate] = useState(formatDate(/* @__PURE__ */ new Date()));
  const [endDate, setEndDate] = useState(formatDate(/* @__PURE__ */ new Date()));
  const [notes, setNotes] = useState("");
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-5 flex items-start justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Time off" }),
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold", children: "Request time off" })
      ] }),
      /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4", children: [
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "PTO type" }),
        /* @__PURE__ */ jsx("select", { className: "h-10 w-full rounded-md border border-input bg-background px-3 text-sm", value: ptoType, onChange: (event) => setPtoType(event.target.value), children: PTO_TYPES.map((type) => /* @__PURE__ */ jsx("option", { value: type, children: type }, type)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Start date" }),
          /* @__PURE__ */ jsx(Input, { type: "date", value: startDate, onChange: (event) => setStartDate(event.target.value) })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "End date" }),
          /* @__PURE__ */ jsx(Input, { type: "date", value: endDate, onChange: (event) => setEndDate(event.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Notes" }),
        /* @__PURE__ */ jsx("textarea", { className: "min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm", placeholder: "Optional notes for the reviewer...", value: notes, onChange: (event) => setNotes(event.target.value) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsx(Button, { onClick: () => onSubmit({
        ptoType,
        startDate,
        endDate,
        notes
      }), children: "Submit request" })
    ] })
  ] }) });
}
function PtoReviewDialog({
  request,
  userName,
  onClose,
  onApprove,
  onDeny
}) {
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "PTO request" }),
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold", children: userName })
      ] }),
      /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-2 text-sm", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Type:" }),
        " ",
        request.ptoType
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Dates:" }),
        " ",
        request.startDate,
        " through",
        " ",
        request.endDate
      ] }),
      request.notes && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Notes:" }),
        " ",
        request.notes
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: onDeny, children: "Deny" }),
      /* @__PURE__ */ jsx(Button, { onClick: onApprove, children: "Approve" })
    ] })
  ] }) });
}
export {
  SchedulerPage as component
};
