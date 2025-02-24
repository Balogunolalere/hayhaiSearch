import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center rounded-none border-4 border-brutalist-black font-mono text-base font-bold transition-all',
  {
    variants: {
      variant: {
        default: 'bg-primary text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal',
        secondary: 'bg-secondary text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal',
        accent: 'bg-accent text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal',
        outline: 'bg-brutalist-white text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal',
      },
      size: {
        default: 'h-12 px-6 py-2',
        sm: 'h-9 px-4',
        lg: 'h-14 px-8',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

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

Button.displayName = 'Button';

export { Button, buttonVariants };