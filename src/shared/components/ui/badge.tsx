import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand text-white shadow-xs hover:bg-brand-strong",
        secondary:
          "border-transparent bg-brand-soft text-brand-strong hover:bg-brand-soft/80",
        destructive:
          "border-transparent bg-negative text-white shadow-xs hover:opacity-90",
        success:
          "border-brand/25 bg-brand-soft text-brand shadow-xs hover:bg-brand-soft/80",
        warning:
          "border-amber-500/25 bg-amber-500/15 text-warning",
        outline: "border-border text-text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
