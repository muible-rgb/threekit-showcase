import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Minimum height is 52px on the primary variant, not the usual 40. This app is
 * used with cold hands and a raised heart rate.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary: "bg-signal text-ink hover:bg-signal-dim",
        secondary:
          "bg-ink-raised text-paper ring-1 ring-ink-line hover:bg-ink-line/60",
        ghost: "text-paper-dim hover:text-paper hover:bg-ink-raised",
        danger: "bg-risk/15 text-risk ring-1 ring-risk/40 hover:bg-risk/25",
        link: "text-signal underline underline-offset-4 hover:text-signal-dim",
      },
      size: {
        lg: "h-14 px-6 text-lg",
        md: "h-12 px-5",
        sm: "h-9 px-3 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
