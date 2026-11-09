export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Nový",
  contacted: "Osloven",
  converted: "Klient",
  rejected: "Odmítl",
};

export const WEBSITE_STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  in_progress: "Ve výrobě",
  live: "Spuštěný",
  suspended: "Pozastavený",
  cancelled: "Zrušený",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Aktivní",
  paused: "Pozastavené",
  cancelled: "Zrušené",
};

export const EVENT_LABELS: Record<string, string> = {
  created: "Nové předplatné",
  upgraded: "Upgrade",
  downgraded: "Downgrade",
  paused: "Pozastaveno",
  resumed: "Obnoveno",
  cancelled: "Zrušeno",
  payment_received: "Přijatá platba",
  website_suspended: "Web pozastaven",
  website_reactivated: "Web znovu spuštěn",
};
