import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white shadow-xs hover:bg-brand-strong active:scale-[0.98]",
        destructive:
          "bg-negative text-white shadow-xs hover:opacity-90 active:scale-[0.98]",
        outline:
          "border border-border bg-surface text-text-primary shadow-xs hover:bg-brand-soft/50 hover:text-brand hover:border-brand/40 active:scale-[0.98]",
        secondary:
          "bg-brand-soft text-brand-strong shadow-xs hover:bg-brand-soft/80 active:scale-[0.98]",
        ghost: "hover:bg-brand-soft/40 text-text-primary hover:text-brand",
        link: "text-brand underline-offset-4 hover:underline font-bold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base min-h-[48px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
