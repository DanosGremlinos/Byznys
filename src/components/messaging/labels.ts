export const EMAIL_STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  pending_approval: "Ke schválení",
  approved: "Schváleno",
  sending: "Odesílá se",
  sent: "Odesláno",
  failed: "Chyba",
  rejected: "Zamítnuto",
  blocked: "Zablokováno",
  received: "Přijato",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  interested: "Má zájem",
  not_interested: "Nemá zájem",
  question: "Dotaz",
  change_request: "Požadavek na změnu",
};

export const CLASSIFICATION_TONE: Record<string, string> = {
  interested: "bg-emerald-100 text-emerald-800",
  not_interested: "bg-slate-200 text-slate-700",
  question: "bg-sky-100 text-sky-800",
  change_request: "bg-amber-100 text-amber-800",
};

export const KIND_LABELS: Record<string, string> = {
  offer_l1: "L1",
  offer_l2: "L2",
  offer_budget: "Rozpočet",
  offer_l3: "L3",
  dunning_1: "Upomínka 1",
  dunning_2: "Upomínka 2",
  dunning_3: "Upomínka 3",
  reply: "Odpověď",
  custom: "Vlastní",
};
