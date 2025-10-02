import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'surface-tracer relative inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold uppercase tracking-[0.08em] transition-[color,background-color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,59,115,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,6,12,0.8)] disabled:pointer-events-none disabled:opacity-50 backdrop-blur-sm hover:-translate-y-[1px] active:translate-y-0',
  {
    variants: {
      variant: {
        default:
          'bg-[rgba(255,43,95,0.24)] text-white shadow-[0_18px_38px_rgba(255,43,95,0.18)] hover:bg-[rgba(255,43,95,0.36)] hover:shadow-[0_22px_48px_rgba(255,43,95,0.24)]',
        destructive:
          'bg-[rgba(255,75,110,0.28)] text-white shadow-[0_18px_35px_rgba(255,75,110,0.18)] hover:bg-[rgba(255,75,110,0.42)]',
        outline:
          'border border-[rgba(255,255,255,0.14)] bg-[rgba(12,15,24,0.72)] text-white/80 hover:text-white hover:bg-[rgba(255,59,115,0.12)] shadow-[0_16px_34px_rgba(8,10,16,0.55)]',
        secondary:
          'border border-[rgba(255,255,255,0.08)] bg-[rgba(14,17,26,0.72)] text-[rgba(230,233,240,0.85)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white shadow-[0_14px_32px_rgba(0,0,0,0.45)]',
        ghost:
          'text-[rgba(220,224,232,0.72)] hover:text-white hover:bg-[rgba(255,43,95,0.12)] shadow-none border border-transparent',
        link: 'text-bolt-elements-messages-linkColor underline-offset-4 hover:underline tracking-normal normal-case',
      },
      size: {
        default: 'h-10 px-5 py-2.5',
        sm: 'h-9 rounded-lg px-4 text-xs',
        lg: 'h-12 rounded-xl px-10 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
