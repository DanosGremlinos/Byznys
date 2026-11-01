import {
  AlertTriangle,
  Hammer,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MailCheck,
  BarChart3,
  FileText,
  Repeat,
  Search,
  Settings,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Přehled", icon: LayoutDashboard },
      { href: "/leads", label: "Leady", icon: Search },
      { href: "/builder", label: "Builder", icon: Hammer },
    ],
  },
  {
    label: "Zprávy",
    items: [
      { href: "/messaging/queue", label: "Ke schválení", icon: MailCheck },
      { href: "/messaging/inbox", label: "Doručená pošta", icon: Inbox },
      { href: "/messaging/templates", label: "Šablony", icon: FileText },
      { href: "/messaging/stats", label: "Statistiky", icon: BarChart3 },
    ],
  },
  {
    label: "Fakturace",
    items: [
      { href: "/subscriptions", label: "Předplatné", icon: Repeat },
      { href: "/overdue", label: "Neuhrazené platby", icon: AlertTriangle },
    ],
  },
  {
    label: "Nastavení",
    items: [{ href: "/settings/tiers", label: "Tarify", icon: Settings }],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
