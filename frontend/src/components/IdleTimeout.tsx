import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import { clearSession, isAuthenticated } from "../lib/auth";
import { api } from "../lib/api";

const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 29 * 60 * 1000;

export function IdleTimeout() {
  const [warning, setWarning] = useState(false);
  const warningTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const reset = () => {
      setWarning(false);
      if (warningTimer.current) window.clearTimeout(warningTimer.current);
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
      warningTimer.current = window.setTimeout(() => setWarning(true), WARNING_MS);
      logoutTimer.current = window.setTimeout(() => {
        void api.logout().catch(() => undefined);
        clearSession();
        window.location.assign("/login");
      }, IDLE_MS);
    };

    const events = ["pointerdown", "keydown", "scroll", "focus"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((event) => window.removeEventListener(event, reset));
      if (warningTimer.current) window.clearTimeout(warningTimer.current);
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          className="idle-toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <Clock3 size={16} />
          Signing out soon for inactivity. Move your cursor to stay signed in.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
