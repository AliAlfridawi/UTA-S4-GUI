import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  id?: string
  className?: string
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, disabled, label, id, className }, ref) => {
    const inputId = id || React.useId()

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-center gap-2 text-sm cursor-pointer select-none",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <button
          ref={ref}
          id={inputId}
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            "h-4 w-4 shrink-0 rounded border border-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-primary text-primary-foreground" : "bg-background"
          )}
        >
          {checked && <Check className="h-3 w-3 mx-auto" />}
        </button>
        {label && <span>{label}</span>}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

// Switch component for toggle-style checkboxes
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { label?: string }
>(({ className, label, ...props }, ref) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
    {label && <span>{label}</span>}
  </label>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Checkbox, Switch }
