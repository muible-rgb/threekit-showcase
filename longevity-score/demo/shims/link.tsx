"use client";

import * as React from "react";
import { navigate } from "./navigation";

/**
 * next/link stand-in. Rewrites app-internal hrefs onto the hash so the
 * preview's single URL can hold the whole app. External links are left alone.
 */
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, onClick, prefetch, replace, scroll, ...rest },
  ref,
) {
  const external = /^(https?:|mailto:|tel:)/.test(href);

  return (
    <a
      ref={ref}
      href={external ? href : `#${href}`}
      onClick={(e) => {
        onClick?.(e);
        if (external || e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
        window.scrollTo(0, 0);
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

export default Link;
