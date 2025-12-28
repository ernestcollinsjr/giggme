import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Set to true for pages that need full height minus bottom nav (80px / 5rem) */
  withBottomNav?: boolean;
}

/**
 * PageContainer - A locked layout component that handles height calculations
 * for pages with/without bottom navigation.
 * 
 * IMPORTANT: Do not modify the height calculations here without careful consideration.
 * The 5rem (80px) accounts for the BottomNav component height.
 * 
 * Usage:
 * - For pages WITH bottom nav: <PageContainer withBottomNav>...</PageContainer>
 * - For pages WITHOUT bottom nav: <PageContainer>...</PageContainer>
 */
export function PageContainer({ 
  children, 
  className,
  withBottomNav = false 
}: PageContainerProps) {
  return (
    <div 
      className={cn(
        "bg-background flex flex-col",
        // Height calculation: subtract bottom nav height (5rem = 80px) when needed
        withBottomNav ? "h-[calc(100dvh-5rem)]" : "h-[100dvh]",
        className
      )}
    >
      {children}
    </div>
  );
}
