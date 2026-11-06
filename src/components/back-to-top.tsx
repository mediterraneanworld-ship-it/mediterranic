"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const REVEAL_AFTER_PX = 360;

/** One-click return to the beginning of any page, including the back-office. */
export function BackToTop() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setVisible(window.scrollY > REVEAL_AFTER_PX);
    };
    const scheduleUpdate = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const goToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? "auto" : "smooth" });
    // The button disappears near the top; move keyboard focus somewhere stable.
    document.getElementById("main-content")?.focus({ preventScroll: true });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          type="button"
          onClick={goToTop}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-parchment/20 bg-ink px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-parchment shadow-[0_10px_35px_rgba(11,32,48,0.24)] transition-colors hover:bg-sea focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass sm:right-7"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 14, scale: reducedMotion ? 1 : 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 10, scale: reducedMotion ? 1 : 0.97 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArrowUp size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Top</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
