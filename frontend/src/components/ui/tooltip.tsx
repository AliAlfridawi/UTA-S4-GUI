import * as React from "react"
import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"

interface TooltipProps {
  content: React.ReactNode
  children?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setIsVisible(true), 200)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 px-3 py-2 text-xs font-medium text-popover-foreground bg-popover border border-border rounded-md shadow-md max-w-xs whitespace-normal",
            positionClasses[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}

interface HelpTooltipProps {
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
}

export function HelpTooltip({ content, side = "top" }: HelpTooltipProps) {
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        className="inline-flex items-center justify-center h-4 w-4 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-full"
        aria-label="Help"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}
