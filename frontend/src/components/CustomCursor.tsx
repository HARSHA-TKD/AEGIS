import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const interactive = "a, button, [role='button'], input, select, textarea, summary, .tab, .nav-link, .assistant-launcher";

export function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 520, damping: 38, mass: 0.35 });
  const ringY = useSpring(y, { stiffness: 520, damping: 38, mass: 0.35 });
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(!coarse.matches && !reduced.matches);
    update();
    coarse.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("custom-cursor");
      return;
    }

    document.documentElement.classList.add("custom-cursor");
    const move = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
    };
    const over = (event: MouseEvent) => {
      const target = event.target;
      setActive(target instanceof Element && Boolean(target.closest(interactive)));
    };
    const leave = () => setVisible(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    document.addEventListener("mouseleave", leave);
    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      document.removeEventListener("mouseleave", leave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <div className="cursor-layer" aria-hidden="true">
      <motion.div
        className="cursor-ring"
        style={{ x: ringX, y: ringY }}
        initial={false}
        animate={{
          opacity: visible ? 1 : 0,
          scale: active ? 1.7 : 1,
          borderColor: active ? "rgba(var(--accent-rgb), 0.95)" : "rgba(var(--accent-rgb), 0.45)",
        }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      />
      <motion.div
        className="cursor-dot"
        style={{ x, y }}
        initial={false}
        animate={{ opacity: visible ? 1 : 0, scale: active ? 0.65 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}
