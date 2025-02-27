import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center rounded-none border-4 border-brutalist-black font-mono text-base font-bold transition-all",
  {
    variants: {
      variant: {
        default: "bg-brutalist-white text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal",
        primary: "bg-primary text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal",
        secondary: "bg-secondary text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal",
        accent: "bg-accent text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal",
        outline: "bg-transparent border-2 hover:bg-brutalist-black/5"
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 px-3 py-1 text-sm border-2",
        lg: "h-14 px-8 py-4 text-lg",
        icon: "h-9 w-9 p-1"
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
    asChild?: boolean
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