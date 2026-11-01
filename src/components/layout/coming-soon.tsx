import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Placeholder for module pages that are built in a later phase. */
export function ComingSoon({ phase, items }: { phase: 1 | 2 | 3; items: string[] }) {
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2 font-medium">
          <Construction className="size-4 text-muted-foreground" />
          Připravujeme ve fázi {phase}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
