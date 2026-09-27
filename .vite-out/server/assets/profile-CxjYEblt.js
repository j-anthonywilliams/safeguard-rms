import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { b as blink, B as Button } from "./client-C5cN3m_d.js";
import { B as BlinkClientBoundary } from "./BlinkClientBoundary-Dbwm73FM.js";
import { C as Card, b as CardHeader, c as CardTitle, d as CardDescription, a as CardContent, I as Input } from "./input-40gxQptb.js";
import * as LabelPrimitive from "@radix-ui/react-label";
import { c as cn } from "./router-DEJXeonh.js";
import { toast } from "sonner";
import { ArrowLeft, UserRound, Save, KeyRound, Check, ShieldCheck } from "lucide-react";
import "@radix-ui/react-slot";
import "class-variance-authority";
import "@blinkdotnew/sdk";
import "@tanstack/react-router";
import "@tanstack/react-query";
import "@radix-ui/react-tooltip";
import "clsx";
import "tailwind-merge";
function Label({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    LabelPrimitive.Root,
    {
      "data-slot": "label",
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      ),
      ...props
    }
  );
}
function ProfileLoading() {
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center bg-background", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "size-5 animate-pulse text-primary" }) });
}
function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => blink.auth.onAuthStateChanged((state) => {
    setUser(state.user);
    if (!state.isLoading) setLoading(false);
  }), []);
  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      setDisplayName(user.displayName || "");
      setPhone(user.phone || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);
  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updatedUser = await blink.auth.updateMe({
        displayName: displayName.trim()
      });
      setPhone(phone.trim());
      setUser(updatedUser);
      toast.success("Profile updated", {
        description: "Your user settings have been saved."
      });
    } catch (error) {
      toast.error("Could not update profile", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSaving(false);
    }
  };
  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      await blink.auth.sendPasswordResetEmail(user.email);
      toast.success("Password reset email sent", {
        description: `Check ${user.email} for a secure reset link.`
      });
    } catch (error) {
      toast.error("Could not send reset email", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSendingReset(false);
    }
  };
  if (loading) return /* @__PURE__ */ jsx(ProfileLoading, {});
  if (!user) return /* @__PURE__ */ jsx("div", { className: "flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground", children: "Please sign in to manage your profile." });
  return /* @__PURE__ */ jsx("main", { className: "min-h-dvh bg-background px-4 py-6 md:px-8 md:py-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-4xl space-y-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-between gap-4 sm:flex-row sm:items-end", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-mono text-[10px] uppercase tracking-[0.2em] text-primary", children: "Account / Settings" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-2 font-serif text-3xl tracking-tight", children: "Your profile" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Keep your contact details and sign-in credentials current." })
      ] }),
      /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => window.location.assign("/app"), children: [
        /* @__PURE__ */ jsx(ArrowLeft, { className: "size-4" }),
        "Back to command center"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-5 lg:grid-cols-[1.1fr_0.9fr]", children: [
      /* @__PURE__ */ jsxs(Card, { children: [
        /* @__PURE__ */ jsxs(CardHeader, { children: [
          /* @__PURE__ */ jsx("div", { className: "flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary", children: /* @__PURE__ */ jsx(UserRound, { className: "size-5" }) }),
          /* @__PURE__ */ jsx(CardTitle, { className: "mt-4", children: "User details" }),
          /* @__PURE__ */ jsx(CardDescription, { children: "These details appear in your SafeGuard RMS profile." })
        ] }),
        /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs("form", { className: "space-y-5", onSubmit: saveProfile, children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "profile-email", children: "Email address" }),
            /* @__PURE__ */ jsx(Input, { id: "profile-email", value: user.email || "", disabled: true }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Your email is managed by secure authentication." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "display-name", children: "Display name" }),
            /* @__PURE__ */ jsx(Input, { id: "display-name", value: displayName, onChange: (event) => setDisplayName(event.target.value), placeholder: "Your name", required: true })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "phone", children: "Phone number" }),
            /* @__PURE__ */ jsx(Input, { id: "phone", value: phone, onChange: (event) => setPhone(event.target.value), placeholder: "(555) 000-0000" })
          ] }),
          /* @__PURE__ */ jsxs(Button, { type: "submit", disabled: saving, children: [
            /* @__PURE__ */ jsx(Save, { className: "size-4" }),
            saving ? "Saving…" : "Save profile"
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs(Card, { children: [
        /* @__PURE__ */ jsxs(CardHeader, { children: [
          /* @__PURE__ */ jsx("div", { className: "flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground", children: /* @__PURE__ */ jsx(KeyRound, { className: "size-5" }) }),
          /* @__PURE__ */ jsx(CardTitle, { className: "mt-4", children: "Reset password" }),
          /* @__PURE__ */ jsx(CardDescription, { children: "Password changes are completed through a secure email link." })
        ] }),
        /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground", children: [
            "We’ll send a one-time password reset link to ",
            /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground", children: user.email }),
            "."
          ] }),
          /* @__PURE__ */ jsxs(Button, { type: "button", variant: "outline", onClick: sendPasswordReset, disabled: sendingReset, children: [
            /* @__PURE__ */ jsx(Check, { className: "size-4" }),
            sendingReset ? "Sending…" : "Send reset email"
          ] })
        ] }) })
      ] })
    ] })
  ] }) });
}
const SplitComponent = () => /* @__PURE__ */ jsx(BlinkClientBoundary, { fallback: /* @__PURE__ */ jsx(ProfileLoading, {}), children: /* @__PURE__ */ jsx(ProfilePage, {}) });
export {
  SplitComponent as component
};
