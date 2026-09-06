import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Text with a hairline border. Square. No fills, ever - DESIGN.md.
 *
 * The accent variant is still an outline, not a fill, and it is subject to the
 * one-accent-per-screen rule like everything else.
 */
const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-chalk disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "hover:border-chalk",
        accent: "btn-accent hover:bg-accent/8",
        quiet: "border-rule-2 text-chalk-dim hover:text-chalk",
        bare: "border-0 text-chalk-dim hover:text-chalk",
      },
      size: {
        lg: "h-12 px-5 text-label",
        md: "h-10 px-4 text-label",
        sm: "h-8 px-3 text-meta",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
