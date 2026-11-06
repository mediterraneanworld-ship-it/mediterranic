"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    sc_project?: number;
    sc_invisible?: number;
    sc_security?: string;
    sc_remove_link?: number;
    _statcounter?: { record_pageview?: () => void };
  }
}

/** Official Statcounter loader + SPA page views. IDs are public counter identifiers. */
export function SiteAnalytics({ project, security, enabled }: { project: number; security: string; enabled: boolean }) {
  const pathname = usePathname();
  const last = useRef("");
  useEffect(() => {
    if (!enabled || /^\/(admin|checkout|orders)(\/|$)/.test(pathname) || last.current === pathname) return;
    last.current = pathname;
    window.sc_project = project;
    window.sc_security = security;
    window.sc_invisible = 1;
    window.sc_remove_link = 1;
    if (window._statcounter?.record_pageview) {
      window._statcounter.record_pageview();
      return;
    }
    if (document.querySelector('script[data-mediterranic-statcounter]')) return;
    const script = document.createElement("script");
    script.src = "https://www.statcounter.com/counter/counter.js";
    script.async = true;
    script.dataset.mediterranicStatcounter = "true";
    document.body.appendChild(script);
  }, [pathname, project, security, enabled]);
  return null;
}
