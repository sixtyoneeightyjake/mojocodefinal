import { memo, forwardRef, type ForwardedRef } from 'react';
import { classNames } from '~/utils/classNames';

type IconSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface BaseIconButtonProps {
  size?: IconSize;
  className?: string;
  iconClassName?: string;
  disabledClassName?: string;
  title?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

type IconButtonWithoutChildrenProps = {
  icon: string;
  children?: undefined;
} & BaseIconButtonProps;

type IconButtonWithChildrenProps = {
  icon?: undefined;
  children: string | JSX.Element | JSX.Element[];
} & BaseIconButtonProps;

type IconButtonProps = IconButtonWithoutChildrenProps | IconButtonWithChildrenProps;

// Componente IconButton com suporte a refs
export const IconButton = memo(
  forwardRef(
    (
      {
        icon,
        size = 'xl',
        className,
        iconClassName,
        disabledClassName,
        disabled = false,
        title,
        onClick,
        children,
      }: IconButtonProps,
      ref: ForwardedRef<HTMLButtonElement>,
    ) => {
      return (
        <button
          ref={ref}
          className={classNames(
            'surface-tracer relative flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(14,17,26,0.72)] text-[rgba(220,224,232,0.76)] transition-[color,background,transform,box-shadow] duration-200 ease-out hover:text-white hover:bg-[rgba(255,43,95,0.18)] hover:-translate-y-[1px] shadow-[0_12px_24px_rgba(4,6,12,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,59,115,0.45)] disabled:cursor-not-allowed',
            getPadding(size),
            {
              [classNames('opacity-40', disabledClassName)]: disabled,
            },
            className,
          )}
          title={title}
          disabled={disabled}
          onClick={(event) => {
            if (disabled) {
              return;
            }

            onClick?.(event);
          }}
        >
          {children ? children : <div className={classNames(icon, getIconSize(size), iconClassName)}></div>}
        </button>
      );
    },
  ),
);

function getIconSize(size: IconSize) {
  if (size === 'sm') {
    return 'text-sm';
  } else if (size === 'md') {
    return 'text-md';
  } else if (size === 'lg') {
    return 'text-lg';
  } else if (size === 'xl') {
    return 'text-xl';
  } else {
    return 'text-2xl';
  }
}

function getPadding(size: IconSize) {
  if (size === 'sm') {
    return 'p-1.5';
  } else if (size === 'md') {
    return 'p-1.5';
  } else if (size === 'lg') {
    return 'p-2';
  } else if (size === 'xl') {
    return 'p-2.5';
  } else {
    return 'p-3';
  }
}
