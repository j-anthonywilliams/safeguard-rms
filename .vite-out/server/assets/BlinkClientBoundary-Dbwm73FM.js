import { jsx } from "react/jsx-runtime";
import { ClientOnly } from "@tanstack/react-router";
function BlinkClientBoundary({
  children,
  fallback = null
}) {
  return /* @__PURE__ */ jsx(ClientOnly, { fallback });
}
export {
  BlinkClientBoundary as B
};
