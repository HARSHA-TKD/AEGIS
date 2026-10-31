import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="breadcrumb-item">
            {item.to && !last ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
            {!last && <ChevronRight size={12} aria-hidden="true" />}
          </span>
        );
      })}
    </nav>
  );
}
