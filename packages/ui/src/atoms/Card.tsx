/**
 * Card Component
 *
 * A flexible card component with header, body, and footer composition.
 * Supports Romanian diacritics (ă, â, î, ș, ț) in all content.
 *
 * @example
 * ```tsx
 * <Card
 *   variant="elevated"
 *   header={<h3>Titlu card</h3>}
 *   footer={<Button>Acțiune</Button>}
 * >
 *   Conținutul cardului aici...
 * </Card>
 *
 * <Card variant="outlined">
 *   <p>Card simplu cu contur</p>
 * </Card>
 * ```
 */

import { clsx } from 'clsx';
import { type CardProps } from '@legal-platform/types';

/**
 * Card component with multiple variants and composition support
 *
 * @param variant - Visual style (default, elevated, outlined)
 * @param header - Optional header content
 * @param children - Main card content
 * @param footer - Optional footer content
 * @param className - Additional CSS classes for the card container
 * @param headerClassName - Additional CSS classes for the header
 * @param bodyClassName - Additional CSS classes for the body
 * @param footerClassName - Additional CSS classes for the footer
 */
export const Card = ({
  variant = 'default',
  header,
  children,
  footer,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  ...props
}: CardProps) => {
  // Base card styles
  const baseStyles = 'rounded-xl bg-white transition-all duration-150';

  // Variant-specific styles
  const variantStyles = {
    default: 'border border-neutral-200',
    elevated: 'shadow-lg hover:shadow-xl',
    outlined: 'border-2 border-neutral-300',
  };

  return (
    <div
      className={clsx(baseStyles, variantStyles[variant ?? 'default'], className)}
      role="article"
      {...props}
    >
      {header && (
        <div className={clsx('border-b border-neutral-200 px-6 py-4', headerClassName)}>
          {header}
        </div>
      )}
      <div className={clsx('px-6 py-4', bodyClassName)}>{children}</div>
      {footer && (
        <div className={clsx('border-t border-neutral-200 px-6 py-4', footerClassName)}>
          {footer}
        </div>
      )}
    </div>
  );
};

Card.displayName = 'Card';
