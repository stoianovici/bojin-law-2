import React from 'react';

export interface LinkProps {
  href: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  [key: string]: any;
}

/**
 * Mock Next.js Link component for Storybook
 */
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onClick?.(e);
      console.log(`Navigate to: ${href}`);
    };

    return (
      <a ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }
);

Link.displayName = 'Link';

export default Link;
