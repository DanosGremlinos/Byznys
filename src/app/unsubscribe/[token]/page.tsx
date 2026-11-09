import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyUnsubscribeToken } from "@/server/email/render";

export const metadata: Metadata = { title: "Odhlášení z e-mailů", robots: { index: false } };

export default function UnsubscribePage(props: PageProps<"/unsubscribe/[token]">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Odhlášení z e-mailů</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Načítám…</p>}>
            <Content {...props} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function Content({ params, searchParams }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const { done } = await searchParams;
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  const email = secret ? verifyUnsubscribeToken(token, secret) : null;
  if (!email) return <p className="text-sm text-destructive">Odkaz pro odhlášení je neplatný.</p>;
  if (done) {
    return (
      <p className="text-sm">
        Adresa <strong>{email}</strong> byla odhlášena. Další e-maily vám už posílat nebudeme.
      </p>
    );
  }
  return (
    <form method="post" action={`/api/unsubscribe/${token}`} className="grid gap-4">
      <p className="text-sm">
        Opravdu chcete odhlásit adresu <strong>{email}</strong> z dalších e-mailů?
      </p>
      <Button type="submit">Odhlásit</Button>
    </form>
  );
}
