import { motion } from "framer-motion";
import clsx from "clsx";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (id: string) => void;
  layoutId?: string;
  className?: string;
}

export function Tabs({ tabs, active, onChange, layoutId = "tab-pill", className }: TabsProps) {
  return (
    <div className={clsx("tabs", className)} role="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={clsx("tab", selected && "is-active")}
            onClick={() => onChange(tab.id)}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="tab-pill"
                transition={{ type: "spring", stiffness: 440, damping: 36 }}
              />
            )}
            <span className="tab-label">
              {tab.label}
              {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
