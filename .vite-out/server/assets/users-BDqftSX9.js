import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from "react";
import { b as blink, B as Button } from "./client-C5cN3m_d.js";
import { B as BlinkClientBoundary } from "./BlinkClientBoundary-Dbwm73FM.js";
import { C as Card, b as CardHeader, c as CardTitle, d as CardDescription, a as CardContent, I as Input } from "./input-40gxQptb.js";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, LogIn, Users, Search, RefreshCw, UserRound, ShieldCheck } from "lucide-react";
import { c as canManageUsers, b as ACCESS_LEVELS, d as canGrantRole, A as ACCESS_LABELS, g as getDevRole } from "./dev-accounts-BXegeLyU.js";
import "@radix-ui/react-slot";
import "class-variance-authority";
import "./router-DEJXeonh.js";
import "@tanstack/react-router";
import "@tanstack/react-query";
import "@radix-ui/react-tooltip";
import "clsx";
import "tailwind-merge";
import "@blinkdotnew/sdk";
function LoadingShell() {
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center bg-background", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "size-5 animate-pulse" }) });
}
function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessLevel, setAccessLevel] = useState("user");
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const usersTable = useMemo(() => blink.db.table("users"), []);
  const rolesTable = useMemo(() => blink.db.table("app_roles"), []);
  const invitationsTable = useMemo(() => blink.db.table("pending_user_invitations"), []);
  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setCurrentUser(state.user);
      if (!state.isLoading) {
        setAuthLoading(false);
      }
    });
  }, []);
  useEffect(() => {
    if (!currentUser) return;
    const initializeAccess = async () => {
      const devRole = getDevRole();
      if (devRole) {
        setAccessLevel(devRole);
        return;
      }
      try {
        const rows = await rolesTable.list({
          where: {
            userId: currentUser.id
          },
          limit: 1
        });
        setAccessLevel(rows[0]?.role || "user");
      } catch {
        setAccessLevel("user");
      }
    };
    initializeAccess();
  }, [currentUser, rolesTable]);
  const loadDirectory = async () => {
    if (!currentUser) return;
    const [userRows, roleRows, invitationRows] = await Promise.all([usersTable.list({
      orderBy: {
        createdAt: "desc"
      },
      limit: 500
    }), rolesTable.list({
      limit: 500
    }), invitationsTable.list({
      limit: 500
    })]);
    setUsers(userRows);
    setRoles(roleRows);
    setPendingInvitations(invitationRows);
  };
  useEffect(() => {
    if (!currentUser || !canManageUsers(accessLevel)) {
      return;
    }
    loadDirectory().catch((error) => {
      toast.error("Could not load user directory", {
        description: error.message
      });
    });
  }, [accessLevel, currentUser, rolesTable, usersTable, invitationsTable]);
  const roleByUser = useMemo(() => new Map(roles.map((item) => [item.userId, item.role])), [roles]);
  const grantableRoles = useMemo(() => ACCESS_LEVELS.filter((role) => canGrantRole(accessLevel, role)), [accessLevel]);
  useEffect(() => {
    if (grantableRoles.length > 0 && !grantableRoles.includes(newRole)) {
      setNewRole(grantableRoles[0]);
    }
  }, [grantableRoles, newRole]);
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((item) => showArchived ? Number(item.isArchived) === 1 : Number(item.isArchived) !== 1).filter((item) => !query || `${item.displayName || ""} ${item.email}`.toLowerCase().includes(query));
  }, [search, users, showArchived]);
  const refreshDirectory = async () => {
    try {
      await loadDirectory();
      toast.success("Directory refreshed");
    } catch (error) {
      toast.error("Could not refresh directory", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  const sendLoginLink = async (email) => {
    try {
      await blink.auth.sendMagicLink(email);
      toast.success("Login link sent", {
        description: `A secure login link was sent to ${email}.`
      });
    } catch (error) {
      toast.error("Could not send login link", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };
  const updateRole = async (user, targetRole) => {
    const currentRole = roleByUser.get(user.id) || "user";
    if (targetRole === currentRole) {
      return;
    }
    if (!canGrantRole(accessLevel, targetRole)) {
      toast.error("Not authorized", {
        description: `You cannot grant ${ACCESS_LABELS[targetRole]} access.`
      });
      return;
    }
    const existing = roles.find((item) => item.userId === user.id);
    try {
      setBusy(true);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (existing) {
        await rolesTable.update(existing.id, {
          role: targetRole,
          updatedAt: now
        });
      } else {
        await rolesTable.create({
          id: crypto.randomUUID(),
          userId: user.id,
          role: targetRole,
          createdAt: now,
          updatedAt: now
        });
      }
      await loadDirectory();
      toast.success("Permission updated", {
        description: `${user.displayName || user.email} is now ${ACCESS_LABELS[targetRole]}.`
      });
    } catch (error) {
      console.error("UPDATE ROLE ERROR:", error);
      toast.error("Could not update permissions", {
        description: error instanceof Error ? error.message : JSON.stringify(error)
      });
    }
  };
  const openEditProfile = (user) => {
    setEditingUser(user);
    setEditName(user.displayName || "");
    setEditPhone(user.phone || "");
  };
  const saveProfile = async () => {
    if (!editingUser || savingProfile) {
      return;
    }
    try {
      setSavingProfile(true);
      await usersTable.update(editingUser.id, {
        displayName: editName.trim(),
        phone: editPhone.trim()
      });
      await loadDirectory();
      toast.success("Profile updated", {
        description: `${editName.trim() || editingUser.email} was updated.`
      });
      setEditingUser(null);
    } catch (error) {
      console.error("UPDATE PROFILE ERROR:", error);
      toast.error("Could not update profile", {
        description: error instanceof Error ? error.message : JSON.stringify(error)
      });
    } finally {
      setSavingProfile(false);
    }
  };
  const archiveUser = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot archive your own account");
      return;
    }
    try {
      setBusy(true);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await usersTable.update(user.id, {
        isArchived: 1,
        archivedAt: now,
        archivedBy: currentUser?.id || null,
        updatedAt: now
      });
      await loadDirectory();
      toast.success("User archived", {
        description: `${user.displayName || user.email} was moved to Archived Users.`
      });
    } catch (error) {
      toast.error("Could not archive user", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  };
  const restoreUser = async (user) => {
    try {
      setBusy(true);
      await usersTable.update(user.id, {
        isArchived: 0,
        archivedAt: null,
        archivedBy: null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await loadDirectory();
      toast.success("User restored");
    } catch (error) {
      toast.error("Could not restore user", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  };
  const deleteArchivedUser = async (user) => {
    if (Number(user.isArchived) !== 1) {
      toast.error("User must be archived first");
      return;
    }
    const confirmed = window.confirm(`Permanently delete ${user.displayName || user.email}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      setBusy(true);
      const role = roles.find((item) => item.userId === user.id);
      if (role) {
        await rolesTable.delete(role.id);
      }
      await usersTable.delete(user.id);
      await loadDirectory();
      toast.success("User permanently deleted");
    } catch (error) {
      toast.error("Could not delete user", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  };
  const createInvitation = async () => {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!name || !email || busy) {
      return;
    }
    if (!canGrantRole(accessLevel, newRole)) {
      toast.error("Not authorized", {
        description: `You cannot grant ${ACCESS_LABELS[newRole]} access.`
      });
      return;
    }
    const existingUser = users.find((item) => item.email.toLowerCase() === email);
    if (existingUser) {
      toast.error("User already exists", {
        description: "Use the existing user directory entry to change permissions."
      });
      return;
    }
    try {
      setBusy(true);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await invitationsTable.create({
        id: crypto.randomUUID(),
        email,
        displayName: name,
        requestedRole: newRole,
        invitedBy: currentUser?.id || "",
        createdAt: now,
        updatedAt: now
      });
      await blink.auth.sendMagicLink(email);
      toast.success("User invited", {
        description: `${name} was invited as ${ACCESS_LABELS[newRole]}.`
      });
      setNewName("");
      setNewEmail("");
      setNewRole(grantableRoles[0] || "user");
      setShowAddUser(false);
      await refreshDirectory();
    } catch (error) {
      toast.error("Could not create invitation", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  };
  const removeInvitation = async (invitation) => {
    try {
      setBusy(true);
      await invitationsTable.delete(invitation.id);
      await refreshDirectory();
      toast.success("Invitation removed");
    } catch (error) {
      toast.error("Could not remove invitation", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  };
  if (authLoading) {
    return /* @__PURE__ */ jsx(LoadingShell, {});
  }
  if (!currentUser) {
    return /* @__PURE__ */ jsx(AccessDenied, { message: "Please sign in to continue." });
  }
  if (!canManageUsers(accessLevel)) {
    return /* @__PURE__ */ jsx(AccessDenied, { message: "User management is available to admin, support, and backend users." });
  }
  return /* @__PURE__ */ jsx("main", { className: "min-h-dvh bg-background px-4 py-6 md:px-8 md:py-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-6xl space-y-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-between gap-4 sm:flex-row sm:items-end", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-mono text-[10px] uppercase tracking-[0.2em] text-primary", children: "Administration / Directory" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-2 font-serif text-3xl tracking-tight", children: "User management" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Manage SafeGuard users and their application access." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => window.location.assign("/app"), children: [
          /* @__PURE__ */ jsx(ArrowLeft, { className: "size-4" }),
          "Back"
        ] }),
        grantableRoles.length > 0 && /* @__PURE__ */ jsxs(Button, { onClick: () => setShowAddUser(true), children: [
          /* @__PURE__ */ jsx(Plus, { className: "size-4" }),
          "Add user"
        ] })
      ] })
    ] }),
    showAddUser && /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(CardTitle, { children: "Add user" }),
          /* @__PURE__ */ jsx(CardDescription, { children: "Invite a user and assign the SafeGuard access level you are authorized to grant." })
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: () => setShowAddUser(false), "aria-label": "Close add user form", children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
      ] }) }),
      /* @__PURE__ */ jsxs(CardContent, { className: "grid gap-4 md:grid-cols-3", children: [
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Display name" }),
          /* @__PURE__ */ jsx(Input, { value: newName, onChange: (event) => setNewName(event.target.value), placeholder: "Jane Smith" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Email" }),
          /* @__PURE__ */ jsx(Input, { type: "email", value: newEmail, onChange: (event) => setNewEmail(event.target.value), placeholder: "jane.smith@example.com" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Access level" }),
          /* @__PURE__ */ jsx("select", { value: newRole, onChange: (event) => setNewRole(event.target.value), className: "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm", children: grantableRoles.map((role) => /* @__PURE__ */ jsx("option", { value: role, children: ACCESS_LABELS[role] }, role)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "md:col-span-3 flex justify-end gap-2", children: [
          /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setShowAddUser(false), disabled: busy, children: "Cancel" }),
          /* @__PURE__ */ jsxs(Button, { onClick: createInvitation, disabled: busy || !newName.trim() || !newEmail.trim() || !canGrantRole(accessLevel, newRole), children: [
            /* @__PURE__ */ jsx(LogIn, { className: "size-4" }),
            busy ? "Sending invitation…" : "Create & send login link"
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsxs(CardHeader, { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(CardTitle, { className: "flex items-center gap-2 text-base", children: [
            /* @__PURE__ */ jsx(Users, { className: "size-4 text-primary" }),
            "User directory"
          ] }),
          /* @__PURE__ */ jsxs(CardDescription, { className: "mt-1", children: [
            users.length,
            " account",
            users.length === 1 ? "" : "s",
            " · signed in as",
            " ",
            ACCESS_LABELS[accessLevel]
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 lg:items-end", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-3", children: [
            /* @__PURE__ */ jsx(Button, { size: "sm", variant: !showArchived ? "default" : "outline", onClick: () => setShowArchived(false), children: "Active users" }),
            /* @__PURE__ */ jsx(Button, { size: "sm", variant: showArchived ? "default" : "outline", onClick: () => setShowArchived(true), children: "Archived users" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto", children: [
            /* @__PURE__ */ jsxs("div", { className: "relative w-full sm:w-72", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }),
              /* @__PURE__ */ jsx(Input, { className: "pl-9", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search name or email", "aria-label": "Search users" })
            ] }),
            /* @__PURE__ */ jsxs(Button, { variant: "outline", size: "sm", onClick: refreshDirectory, className: "shrink-0", children: [
              /* @__PURE__ */ jsx(RefreshCw, { className: "size-3.5" }),
              "Refresh"
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(CardContent, { className: "p-0", children: /* @__PURE__ */ jsx("div", { className: "divide-y divide-border", children: filteredUsers.length ? filteredUsers.map((item) => {
        const role = roleByUser.get(item.id) || "user";
        const permittedRoles = ACCESS_LEVELS.filter((level) => level === role || canGrantRole(accessLevel, level));
        return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary", children: /* @__PURE__ */ jsx(UserRound, { className: "size-4" }) }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxs("p", { className: "truncate text-sm font-medium", children: [
                item.displayName || "Unnamed user",
                " ",
                item.id === currentUser.id && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: "(you)" })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "truncate text-xs text-muted-foreground", children: item.email })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsx("select", { value: role, disabled: busy, onChange: (event) => updateRole(item, event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-xs", "aria-label": `Permission for ${item.displayName || item.email}`, children: permittedRoles.map((level) => /* @__PURE__ */ jsx("option", { value: level, children: ACCESS_LABELS[level] }, level)) }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: Number(item.emailVerified) ? "Verified" : "Unverified" }),
            Number(item.isArchived) === 1 ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "rounded-md bg-muted px-3 py-2 text-xs", children: "Archived" }),
              /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: () => restoreUser(item), disabled: busy, children: "Restore" }),
              /* @__PURE__ */ jsx(Button, { size: "sm", variant: "destructive", onClick: () => deleteArchivedUser(item), disabled: busy, children: "Delete permanently" })
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: () => openEditProfile(item), disabled: busy || savingProfile, children: "Edit profile" }),
              /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: () => archiveUser(item), disabled: busy || item.id === currentUser?.id, children: "Archive" }),
              /* @__PURE__ */ jsxs(Button, { size: "sm", variant: "outline", onClick: () => sendLoginLink(item.email), disabled: busy, children: [
                /* @__PURE__ */ jsx(LogIn, { className: "size-3.5" }),
                "Login link"
              ] })
            ] })
          ] })
        ] }, item.id);
      }) : /* @__PURE__ */ jsx("div", { className: "px-5 py-12 text-center text-sm text-muted-foreground", children: "No users match your search." }) }) })
    ] }),
    editingUser && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm", children: /* @__PURE__ */ jsxs(Card, { className: "w-full max-w-lg shadow-xl", children: [
      /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(CardTitle, { children: "Edit user profile" }),
          /* @__PURE__ */ jsxs(CardDescription, { children: [
            "Update profile information for ",
            editingUser.email,
            "."
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "icon", onClick: () => setEditingUser(null), disabled: savingProfile, "aria-label": "Close edit profile", children: /* @__PURE__ */ jsx(X, { className: "size-4" }) })
      ] }) }),
      /* @__PURE__ */ jsxs(CardContent, { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Display name" }),
          /* @__PURE__ */ jsx(Input, { value: editName, onChange: (event) => setEditName(event.target.value), placeholder: "Jane Smith" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Phone" }),
          /* @__PURE__ */ jsx(Input, { type: "tel", value: editPhone, onChange: (event) => setEditPhone(event.target.value), placeholder: "(402) 555-1234" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-medium", children: "Email" }),
          /* @__PURE__ */ jsx(Input, { value: editingUser.email, disabled: true }),
          /* @__PURE__ */ jsx("p", { className: "text-[11px] text-muted-foreground", children: "Authentication email cannot be changed from this screen." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [
          /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setEditingUser(null), disabled: savingProfile, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { onClick: saveProfile, disabled: savingProfile || !editName.trim(), children: savingProfile ? "Saving…" : "Save changes" })
        ] })
      ] })
    ] }) }),
    pendingInvitations.length > 0 && /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsxs(CardHeader, { children: [
        /* @__PURE__ */ jsx(CardTitle, { children: "Pending invitations" }),
        /* @__PURE__ */ jsx(CardDescription, { children: "Users who have been invited but are not yet present in the SafeGuard directory." })
      ] }),
      /* @__PURE__ */ jsx(CardContent, { className: "p-0", children: /* @__PURE__ */ jsx("div", { className: "divide-y divide-border", children: pendingInvitations.map((invitation) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: invitation.displayName }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: invitation.email }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px] font-mono uppercase tracking-wider text-primary", children: [
            ACCESS_LABELS[invitation.requestedRole],
            " ",
            "access"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxs(Button, { size: "sm", variant: "outline", onClick: () => sendLoginLink(invitation.email), disabled: busy, children: [
            /* @__PURE__ */ jsx(LogIn, { className: "size-3.5" }),
            "Resend link"
          ] }),
          /* @__PURE__ */ jsx(Button, { size: "sm", variant: "ghost", onClick: () => removeInvitation(invitation), disabled: busy, children: "Remove" })
        ] })
      ] }, invitation.id)) }) })
    ] })
  ] }) });
}
function AccessDenied({
  message
}) {
  return /* @__PURE__ */ jsx("main", { className: "flex min-h-dvh items-center justify-center bg-background px-6", children: /* @__PURE__ */ jsxs(Card, { className: "w-full max-w-md", children: [
    /* @__PURE__ */ jsxs(CardHeader, { children: [
      /* @__PURE__ */ jsx(ShieldCheck, { className: "size-6 text-primary" }),
      /* @__PURE__ */ jsx(CardTitle, { className: "mt-3", children: "Access restricted" }),
      /* @__PURE__ */ jsx(CardDescription, { children: message })
    ] }),
    /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => window.location.assign("/app"), children: "Return to command center" }) })
  ] }) });
}
const SplitComponent = () => /* @__PURE__ */ jsx(BlinkClientBoundary, { fallback: /* @__PURE__ */ jsx(LoadingShell, {}), children: /* @__PURE__ */ jsx(UserManagementPage, {}) });
export {
  SplitComponent as component
};
