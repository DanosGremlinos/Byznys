"use client";

import { AlertTriangle, FileText, Send, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveAndSend, rejectDraft, saveDraft, saveDraftContract, type ActionState } from "../actions";

type Props = {
  email: {
    id: string;
    toAddress: string;
    subject: string;
    bodyText: string;
    status: string;
    error: string | null;
  };
  blacklisted: boolean;
  attachments: { id: string; url: string; filename: string; contentType: string }[];
  contract: { id: string; body: string } | null;
};

const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].filter((k) => k !== "unsubscribeUrl");

export function QueueEditor({ email, blacklisted, attachments, contract }: Props) {
  const [sendState, send, sending] = useActionState<ActionState, FormData>(
    approveAndSend.bind(null, email.id),
    {},
  );
  const [saveState, save, saving] = useActionState<ActionState, FormData>(saveDraft.bind(null, email.id), {});
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.bodyText);
  const missing = placeholders(`${subject}\n${body}`);
  const state = sendState.ok || sendState.error ? sendState : saveState;

  return (
    <div className="grid gap-4">
      {blacklisted ? (
        <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          Adresa příjemce je na blacklistu. Odeslání bude zablokováno.
        </p>
      ) : null}
      {email.error && email.status !== "pending_approval" ? (
        <p className="rounded-md bg-muted p-3 text-sm">{email.error}</p>
      ) : null}
      <form className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="toAddress">Komu</Label>
          <Input id="toAddress" name="toAddress" type="email" defaultValue={email.toAddress} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="subject">Předmět</Label>
          <Input
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bodyText">Text e-mailu</Label>
          <Textarea
            id="bodyText"
            name="bodyText"
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Odkaz pro odhlášení se doplní automaticky při odeslání (místo {"{{unsubscribeUrl}}"}, nebo jako
            patička).
          </p>
        </div>
        {missing.length ? (
          <p className="text-sm text-amber-700">
            Nevyplněné proměnné: {missing.map((m) => `{{${m}}}`).join(", ")} – před odesláním je nahraďte.
          </p>
        ) : null}
        {attachments.length ? (
          <div className="grid gap-1 text-sm">
            <span className="font-medium">Přílohy</span>
            {attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="size-4" />
                {a.filename} {a.contentType.startsWith("image/") ? "(vložený obrázek)" : ""}
              </a>
            ))}
          </div>
        ) : null}
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-700">{state.ok}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            formAction={send}
            disabled={sending || saving || blacklisted || missing.length > 0}
          >
            <Send />
            {sending ? "Odesílám…" : "Schválit a odeslat"}
          </Button>
          <Button type="submit" variant="outline" formAction={save} disabled={sending || saving}>
            Uložit
          </Button>
          <Button
            type="submit"
            variant="ghost"
            formAction={rejectDraft.bind(null, email.id)}
            disabled={sending}
          >
            <Trash2 />
            Zamítnout
          </Button>
        </div>
      </form>
      {contract ? <ContractEditor emailId={email.id} contract={contract} /> : null}
    </div>
  );
}

function ContractEditor({ emailId, contract }: { emailId: string; contract: { id: string; body: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveDraftContract.bind(null, emailId, contract.id),
    {},
  );
  return (
    <form action={action} className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="contract-body">Smlouva (z toho se při odeslání vytvoří PDF)</Label>
        <a
          href={`/api/contracts/${contract.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="text-sm hover:underline"
        >
          Náhled PDF
        </a>
      </div>
      <Textarea
        id="contract-body"
        name="body"
        rows={12}
        defaultValue={contract.body}
        className="font-mono text-xs"
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">{state.ok}</p> : null}
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Uložit smlouvu
        </Button>
      </div>
    </form>
  );
}
