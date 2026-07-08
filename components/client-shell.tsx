"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import ErrorBoundary from "@/components/error-boundary";
import ScrollToTop from "@/components/scroll-to-top";
import SpectralBackground from "@/components/spectral-background";
import { SiteProvider } from "@/lib/site-state";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 12,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SiteProvider>
          <div className="flex min-h-screen flex-col overflow-x-hidden relative">
            <SpectralBackground />

            <SiteHeader />

            {/* Instant, flash-free route swaps — no opacity fade (butter-smooth
                navigation). Per-section scroll-in animations still provide motion. */}
            <div className="flex-1 relative">{children}</div>

            <SiteFooter />
            <ScrollToTop />
          </div>
        </SiteProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
