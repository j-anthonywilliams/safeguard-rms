import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Outlet } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useCallback, createContext } from "react";
import { XIcon, Menu, PanelLeft, LayoutDashboard, ClipboardPlus, Package, Archive, CalendarDays, Users } from "lucide-react";
import { B as Button, b as blink } from "./client-C5cN3m_d.js";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { c as cn, T as TooltipProvider, a as Tooltip, b as TooltipTrigger, d as TooltipContent } from "./router-DEJXeonh.js";
import { c as canManageUsers, g as getDevRole } from "./dev-accounts-BXegeLyU.js";
import "@radix-ui/react-slot";
import "class-variance-authority";
import "@blinkdotnew/sdk";
import "@tanstack/react-query";
import "@radix-ui/react-tooltip";
import "clsx";
import "tailwind-merge";
import "sonner";
function Sheet({ ...props }) {
  return /* @__PURE__ */ jsx(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({
  ...props
}) {
  return /* @__PURE__ */ jsx(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SheetPrimitive.Overlay,
    {
      "data-slot": "sheet-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}) {
  return /* @__PURE__ */ jsxs(SheetPortal, { children: [
    /* @__PURE__ */ jsx(SheetOverlay, {}),
    /* @__PURE__ */ jsxs(
      SheetPrimitive.Content,
      {
        "data-slot": "sheet-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" && "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" && "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" && "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        ),
        ...props,
        children: [
          children,
          /* @__PURE__ */ jsxs(SheetPrimitive.Close, { className: "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none", children: [
            /* @__PURE__ */ jsx(XIcon, { className: "size-4" }),
            /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function Shell({
  sidebar,
  appName = "App",
  children
}) {
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsxs("div", { className: "flex h-dvh w-full overflow-hidden", children: [
    /* @__PURE__ */ jsx("aside", { className: "hidden h-dvh shrink-0 md:block", children: sidebar }),
    /* @__PURE__ */ jsx(Sheet, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsx(
      SheetContent,
      {
        side: "left",
        className: "h-dvh w-64 p-0",
        children: sidebar
      }
    ) }),
    /* @__PURE__ */ jsxs("main", { className: "flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:hidden", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            size: "icon",
            className: "-ml-2",
            "aria-label": "Open menu",
            onClick: () => setOpen(true),
            children: /* @__PURE__ */ jsx(Menu, { className: "size-5" })
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "font-semibold text-sm", children: appName })
      ] }),
      children
    ] })
  ] });
}
const SIDEBAR_KEY = "sidebar_collapsed";
const NAV_ITEMS = [
  {
    href: "/app",
    icon: /* @__PURE__ */ jsx(LayoutDashboard, { className: "h-4 w-4" }),
    label: "Command center",
    active: true
  },
  {
    href: "/app#incidents",
    icon: /* @__PURE__ */ jsx(ClipboardPlus, { className: "h-4 w-4" }),
    label: "Incident reports"
  },
  {
    href: "/app#equipment",
    icon: /* @__PURE__ */ jsx(Package, { className: "h-4 w-4" }),
    label: "Equipment desk"
  },
  {
    href: "/app#evidence",
    icon: /* @__PURE__ */ jsx(Archive, { className: "h-4 w-4" }),
    label: "Property & evidence"
  },
  {
    href: "/app/scheduler",
    icon: /* @__PURE__ */ jsx(CalendarDays, { className: "h-4 w-4" }),
    label: "Scheduler"
  },
  {
    href: "/app/users",
    icon: /* @__PURE__ */ jsx(Users, { className: "h-4 w-4" }),
    label: "User management",
    requiresManagement: true
  }
];
function NavItem({
  item,
  collapsed
}) {
  const link = /* @__PURE__ */ jsxs(
    "a",
    {
      href: item.href,
      className: cn(
        "flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer",
        collapsed ? "justify-center w-8 h-8 mx-auto" : "px-3 py-2 w-full",
        item.active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      ),
      children: [
        /* @__PURE__ */ jsx("span", { className: "shrink-0", children: item.icon }),
        !collapsed && /* @__PURE__ */ jsx("span", { className: "truncate", children: item.label })
      ]
    }
  );
  if (!collapsed) return link;
  return /* @__PURE__ */ jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: link }),
    /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: item.label })
  ] });
}
function AppSidebarShell() {
  const [accessLevel, setAccessLevel] = useState("user");
  const rolesTable = useMemo(
    () => blink.db.table("app_roles"),
    []
  );
  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      if (!state.user) {
        setAccessLevel("user");
        return;
      }
      const devRole = getDevRole();
      if (devRole) {
        setAccessLevel(devRole);
        return;
      }
      rolesTable.list({
        where: { userId: state.user.id },
        limit: 1
      }).then(
        (rows) => setAccessLevel(rows[0]?.role || "user")
      ).catch(() => setAccessLevel("user"));
    });
  }, [rolesTable]);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_KEY) === "true") {
      setCollapsed(true);
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);
  return /* @__PURE__ */ jsx(TooltipProvider, { delayDuration: 0, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "sticky top-0 flex h-dvh flex-col bg-background border-r border-border overflow-hidden",
        "transition-[width] duration-200 ease-linear shrink-0",
        collapsed ? "w-[3rem]" : "w-[15rem]"
      ),
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              "flex items-center gap-2 shrink-0 border-b border-border h-[52px] px-3",
              collapsed && "justify-center px-2"
            ),
            children: [
              !collapsed && /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-7 w-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shrink-0", children: "SG" }),
                /* @__PURE__ */ jsx("span", { className: "flex-1 font-semibold text-sm truncate", children: "SafeGuard RMS" })
              ] }),
              /* @__PURE__ */ jsxs(Tooltip, { children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    className: "h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground",
                    onClick: toggle,
                    children: /* @__PURE__ */ jsx(
                      PanelLeft,
                      {
                        className: cn(
                          "h-4 w-4 transition-transform duration-200",
                          collapsed && "rotate-180"
                        )
                      }
                    )
                  }
                ) }),
                /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: collapsed ? "Expand sidebar" : "Collapse sidebar" })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-h-0 overflow-hidden px-2 py-2 space-y-0.5", children: [
          !collapsed && /* @__PURE__ */ jsx("p", { className: "px-3 pt-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider", children: "Main" }),
          NAV_ITEMS.filter(
            (item) => !item.requiresManagement || canManageUsers(accessLevel)
          ).map((item) => /* @__PURE__ */ jsx(React.Fragment, { children: /* @__PURE__ */ jsx(
            NavItem,
            {
              item,
              collapsed
            }
          ) }, `${item.href}-${item.label}`))
        ] })
      ]
    }
  ) });
}
const SharedLayoutContext = createContext(null);
function SharedAppLayout({
  appName = "App",
  sidebar = /* @__PURE__ */ jsx(AppSidebarShell, {}),
  children
}) {
  const value = React.useMemo(() => ({ appName }), [appName]);
  return /* @__PURE__ */ jsx(SharedLayoutContext.Provider, { value, children: /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh w-full flex-1 flex-col", children: /* @__PURE__ */ jsx(Shell, { appName, sidebar, children }) }) });
}
function AppLayout() {
  return /* @__PURE__ */ jsx(SharedAppLayout, { appName: "SafeGuard RMS", children: /* @__PURE__ */ jsx(Outlet, {}) });
}
export {
  AppLayout as component
};
