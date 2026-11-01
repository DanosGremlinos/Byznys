import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Stránka nenalezena</h1>
      <p className="text-sm text-muted-foreground">Požadovaná stránka neexistuje.</p>
      <Button asChild variant="outline">
        <Link href="/">Zpět na přehled</Link>
      </Button>
    </main>
  );
}
