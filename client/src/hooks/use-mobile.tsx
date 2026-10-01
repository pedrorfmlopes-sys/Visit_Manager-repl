import * as React from "react"

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1200

export type ViewportMode = "mobile" | "tablet" | "desktop"

function getViewportMode(): ViewportMode {
  if (typeof window === "undefined") return "desktop"
  if (window.innerWidth < MOBILE_BREAKPOINT) return "mobile"
  if (window.innerWidth < DESKTOP_BREAKPOINT) return "tablet"
  return "desktop"
}

export function useViewportMode() {
  const [mode, setMode] = React.useState<ViewportMode>(getViewportMode)

  React.useEffect(() => {
    const onChange = () => setMode(getViewportMode())
    window.addEventListener("resize", onChange)
    return () => window.removeEventListener("resize", onChange)
  }, [])

  return mode
}

export function useIsMobile() {
  return useViewportMode() === "mobile"
}
