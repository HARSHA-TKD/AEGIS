import { motion } from "framer-motion";
import type { ReactNode } from "react";
import clsx from "clsx";

interface LoadingSwapProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}

export function LoadingSwap({ loading, skeleton, children, className }: LoadingSwapProps) {
  if (loading) {
    return <div className={clsx("page-swap", className)}>{skeleton}</div>;
  }

  return (
    <motion.div
      className={clsx("page-swap", className)}
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
