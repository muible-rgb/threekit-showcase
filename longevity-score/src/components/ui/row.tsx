import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Rows, not cards. A list is hairlines between items, not a stack of panels.
 * `isMe` is the one place the accent is allowed: your own row.
 */
export function Row({
  className,
  isMe,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isMe?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-gap border-b border-rule py-row",
        isMe && "-mx-pad border-l-[3px] border-l-accent bg-board-2 px-pad",
        className,
      )}
      {...props}
    />
  );
}

/** A section break: a label over a heavier rule. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("label border-b border-rule-2 pb-2 pt-6", className)}>{children}</p>
  );
}
