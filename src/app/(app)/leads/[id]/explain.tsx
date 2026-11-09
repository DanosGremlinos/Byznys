"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { explainScore } from "../actions";

export function ExplainScore({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<{ text?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => setResult(await explainScore(leadId)))}
        >
          <Sparkles />
          {pending ? "Generuji vysvětlení…" : "Vysvětlit skóre (AI)"}
        </Button>
      </div>
      {result?.text ? <p className="rounded-md bg-muted p-3 text-sm leading-relaxed">{result.text}</p> : null}
      {result?.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
    </div>
  );
}
