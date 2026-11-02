"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";
import { GripVertical, Loader2, Palette, Plus, Save, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILDER_EXTRAS,
  BUILDER_FONTS,
  BUILDER_MOODS,
  BUILDER_PAGES,
  BUILDER_SECTIONS,
  BUILDER_TEMPLATES,
} from "@/config/builder";
import type {
  BuilderClientInfo,
  BuilderStructure,
  BuilderStyle,
  ServiceItem,
  Weekday,
} from "@/db/schema/types";
import { dayToText, textsToOpeningHours, WEEKDAYS } from "@/lib/opening-hours";
import { dominantColors } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { addUploadedAsset, deleteUploadedAsset, saveAndGeneratePrompt, saveProject } from "../actions";

export type EditorAsset = {
  id: string;
  kind: "photo" | "logo" | "review" | "document";
  source: "scraped" | "upload";
  url: string | null;
  filename: string | null;
  contentType: string | null;
  sortOrder: number;
  isHero: boolean;
  isSelected: boolean;
  attribution: string | null;
  review: { author: string; rating: number; text: string } | null;
};

export type EditorProject = {
  id: string;
  name: string;
  clientInfo: BuilderClientInfo;
  structure: BuilderStructure;
  style: BuilderStyle;
  customInstructions: string | null;
  assets: EditorAsset[];
  promptVersions: { id: string; version: number; content: string; createdAt: string }[];
};

type ServiceRow = { name: string; price: string; description?: string; category?: string };

function serviceToRow(s: ServiceItem): ServiceRow {
  const price =
    s.priceHalere !== undefined ? `${(s.priceHalere / 100).toLocaleString("cs-CZ")} Kč` : (s.priceText ?? "");
  return { name: s.name, price, description: s.description, category: s.category };
}

function rowToService(r: ServiceRow): ServiceItem | null {
  const name = r.name.trim();
  if (!name) return null;
  const price = r.price.trim();
  const plain = price.match(/^(\d[\d\s ]*)(?:,(\d{1,2}))?\s*(?:Kč|,-)?$/i);
  const base: ServiceItem = {
    name,
    ...(r.description ? { description: r.description } : {}),
    ...(r.category ? { category: r.category } : {}),
  };
  if (!price) return base;
  if (plain)
    return {
      ...base,
      priceHalere: Number(plain[1].replace(/\s/g, "")) * 100 + Number((plain[2] ?? "0").padEnd(2, "0")),
    };
  return { ...base, priceText: price };
}

const toggle = (list: string[], key: string) =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

export function BuilderEditor({
  project,
  blobMode,
}: {
  project: EditorProject;
  blobMode: "token" | "store" | "off";
}) {
  const blobEnabled = blobMode !== "off";
  const [name, setName] = useState(project.name);
  const [info, setInfo] = useState<BuilderClientInfo>(project.clientInfo);
  const [hours, setHours] = useState<Record<Weekday, string>>(
    () =>
      Object.fromEntries(
        WEEKDAYS.map(({ key }) => [key, dayToText(project.clientInfo.openingHours?.[key])]),
      ) as Record<Weekday, string>,
  );
  const [services, setServices] = useState<ServiceRow[]>(() =>
    (project.clientInfo.services ?? []).map(serviceToRow),
  );
  const [assets, setAssets] = useState<EditorAsset[]>(project.assets);
  const [structure, setStructure] = useState<BuilderStructure>(project.structure);
  const [style, setStyle] = useState<BuilderStyle>(project.style);
  const [referenceText, setReferenceText] = useState((project.style.referenceUrls ?? []).join("\n"));
  const [instructions, setInstructions] = useState(project.customInstructions ?? "");
  const [versions, setVersions] = useState(project.promptVersions);
  const [shownVersion, setShownVersion] = useState(project.promptVersions[0]?.version ?? null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const photos = useMemo(
    () => assets.filter((a) => a.kind === "photo").sort((a, b) => a.sortOrder - b.sortOrder),
    [assets],
  );
  const logos = assets.filter((a) => a.kind === "logo");
  const reviews = assets.filter((a) => a.kind === "review");
  const documents = assets.filter((a) => a.kind === "document");
  const shown = versions.find((v) => v.version === shownVersion) ?? versions[0];

  const setField = (key: keyof BuilderClientInfo, value: string) =>
    setInfo((cur) => ({ ...cur, [key]: value || undefined }));
  const patchAsset = (id: string, patch: Partial<EditorAsset>) =>
    setAssets((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function buildPayload() {
    const { hours: openingHours, invalid } = textsToOpeningHours(hours);
    if (invalid.length) {
      const labels = WEEKDAYS.filter((d) => invalid.includes(d.key)).map((d) => d.label);
      return { error: `Neplatná otevírací doba: ${labels.join(", ")} (formát 09:00–18:00, nebo „zavřeno“).` };
    }
    const referenceUrls = referenceText
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const badUrl = referenceUrls.find((u) => !/^https?:\/\/\S+\.\S+/.test(u));
    if (badUrl) return { error: `Neplatná referenční URL: ${badUrl}` };
    return {
      payload: {
        name: name.trim() || "Projekt",
        clientInfo: {
          ...info,
          openingHours: Object.keys(openingHours).length ? openingHours : undefined,
          services: services.map(rowToService).filter((s): s is ServiceItem => s !== null),
        },
        structure,
        style: { ...style, referenceUrls },
        customInstructions: instructions.trim() || null,
        assets: assets.map((a) => ({
          id: a.id,
          sortOrder: a.sortOrder,
          isHero: a.isHero,
          isSelected: a.isSelected,
        })),
      },
    };
  }

  function run(kind: "save" | "generate") {
    const built = buildPayload();
    if ("error" in built) return setMessage({ tone: "error", text: built.error! });
    start(async () => {
      const res =
        kind === "save"
          ? await saveProject(project.id, built.payload)
          : await saveAndGeneratePrompt(project.id, built.payload);
      if (!res.ok) return setMessage({ tone: "error", text: res.error ?? "Uložení selhalo" });
      if (res.prompt) {
        const v = {
          id: crypto.randomUUID(),
          version: res.prompt.version,
          content: res.prompt.content,
          createdAt: new Date().toISOString(),
        };
        setVersions((cur) => [v, ...cur]);
        setShownVersion(v.version);
        setMessage({ tone: "ok", text: `Prompt v${v.version} vygenerován a uložen.` });
      } else setMessage({ tone: "ok", text: "Uloženo." });
    });
  }

  function movePhoto(fromId: string, toId: string) {
    if (fromId === toId) return;
    const order = photos.map((p) => p.id);
    const from = order.indexOf(fromId);
    const to = order.indexOf(toId);
    order.splice(to, 0, ...order.splice(from, 1));
    setAssets((cur) => cur.map((a) => (a.kind === "photo" ? { ...a, sortOrder: order.indexOf(a.id) } : a)));
  }

  async function handleUpload(files: FileList | null, kind: "photo" | "logo" | "document") {
    if (!files?.length) return;
    setUploading(kind);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        const send = blobMode === "store" ? uploadPresigned : upload;
        const blob = await send(`builder/${project.id}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/builder/upload",
        });
        const row = await addUploadedAsset(project.id, {
          url: blob.url,
          pathname: blob.pathname,
          filename: file.name,
          contentType: file.type || blob.contentType,
          kind,
        });
        setAssets((cur) => [
          ...cur.map((a) => (kind === "logo" && a.kind === "logo" ? { ...a, isSelected: false } : a)),
          {
            id: row.id,
            kind,
            source: "upload",
            url: row.url,
            filename: row.filename,
            contentType: row.contentType,
            sortOrder: kind === "photo" ? photos.length + 1 : 0,
            isHero: false,
            isSelected: true,
            attribution: null,
            review: null,
          },
        ]);
      }
      setMessage({ tone: "ok", text: "Soubory nahrány. Nezapomeňte projekt uložit." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Nahrání selhalo" });
    } finally {
      setUploading(null);
    }
  }

  async function removeUpload(id: string) {
    await deleteUploadedAsset(project.id, id);
    setAssets((cur) => cur.filter((a) => a.id !== id));
  }

  async function extractPalette() {
    const logo = logos.find((l) => l.isSelected && l.url) ?? logos.find((l) => l.url);
    if (!logo?.url) return setMessage({ tone: "error", text: "Nejdřív vyberte nebo nahrajte logo." });
    try {
      const img = new Image();
      img.src = `/api/image-proxy?url=${encodeURIComponent(logo.url)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 64, 64);
      const colors = dominantColors(ctx.getImageData(0, 0, 64, 64).data);
      if (!colors.length) return setMessage({ tone: "error", text: "V logu nebyly nalezeny výrazné barvy." });
      setStyle((s) => ({ ...s, palette: colors, paletteSource: "logo" }));
      setMessage({ tone: "ok", text: "Paleta načtena z loga." });
    } catch {
      setMessage({ tone: "error", text: "Logo se nepodařilo načíst pro extrakci barev." });
    }
  }

  const field = (key: keyof BuilderClientInfo, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ci-${key}`}>{label}</Label>
      <Input
        id={`ci-${key}`}
        type={type}
        value={(info[key] as string | undefined) ?? ""}
        onChange={(e) => setField(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informace o klientovi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Název projektu</Label>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("businessName", "Název firmy")}
              {field("category", "Obor")}
              {field("contactPerson", "Kontaktní osoba")}
              {field("email", "E-mail", "email")}
              {field("phone", "Telefon")}
              {field("address", "Adresa")}
              {field("city", "Město")}
              {field("domain", "Doména nového webu")}
              {field("currentWebsite", "Současný web")}
            </div>
            <div className="grid gap-2">
              <Label>Otevírací doba</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEEKDAYS.map((d) => (
                  <div key={d.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                    <span className="text-sm text-muted-foreground">{d.label}</span>
                    <Input
                      value={hours[d.key]}
                      placeholder="09:00–18:00 / zavřeno"
                      onChange={(e) => setHours((h) => ({ ...h, [d.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Služby / menu / ceník</Label>
              {services.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_9rem_auto] gap-2">
                  <Input
                    value={s.name}
                    placeholder="Položka"
                    onChange={(e) =>
                      setServices((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    value={s.price}
                    placeholder="199 Kč / od 350 Kč"
                    onChange={(e) =>
                      setServices((cur) => cur.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Odebrat"
                    onClick={() => setServices((cur) => cur.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setServices((cur) => [...cur, { name: "", price: "" }])}
                >
                  <Plus />
                  Přidat položku
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Podklady</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            {!blobEnabled ? (
              <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                Nahrávání souborů vyžaduje připojené úložiště Vercel Blob. Stažené fotky a recenze fungují i
                bez něj.
              </p>
            ) : null}

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  Fotky ({photos.filter((p) => p.isSelected).length}/{photos.length} vybráno) – přetažením
                  změníte pořadí
                </h3>
                <UploadButton
                  label="Nahrát fotky"
                  accept="image/*"
                  multiple
                  disabled={!blobEnabled || uploading !== null}
                  busy={uploading === "photo"}
                  onFiles={(f) => handleUpload(f, "photo")}
                />
              </div>
              {photos.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => (dragId.current = p.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dragId.current && movePhoto(dragId.current, p.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-md border",
                        !p.isSelected && "opacity-50",
                        p.isHero && "ring-2 ring-amber-500",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url ?? ""}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-1.5 text-white">
                        <GripVertical className="size-4 cursor-grab" />
                        <Checkbox
                          checked={p.isSelected}
                          onCheckedChange={(v) => patchAsset(p.id, { isSelected: v === true })}
                          className="border-white bg-white/20"
                          aria-label="Použít fotku"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 p-1.5">
                        <Button
                          type="button"
                          size="xs"
                          variant={p.isHero ? "default" : "outline"}
                          onClick={() =>
                            setAssets((cur) =>
                              cur.map((a) =>
                                a.kind === "photo" ? { ...a, isHero: a.id === p.id ? !p.isHero : false } : a,
                              ),
                            )
                          }
                        >
                          <Star />
                          Hero
                        </Button>
                        {p.source === "upload" ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Smazat"
                            onClick={() => removeUpload(p.id)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Žádné fotky.</p>
              )}
            </section>

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Logo</h3>
                <UploadButton
                  label="Nahrát logo"
                  accept="image/*"
                  disabled={!blobEnabled || uploading !== null}
                  busy={uploading === "logo"}
                  onFiles={(f) => handleUpload(f, "logo")}
                />
              </div>
              {logos.length ? (
                <div className="flex flex-wrap gap-3">
                  {logos.map((l) => (
                    <label
                      key={l.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border p-2",
                        l.isSelected && "ring-2 ring-primary",
                      )}
                    >
                      <input
                        type="radio"
                        name="logo"
                        checked={l.isSelected}
                        onChange={() =>
                          setAssets((cur) =>
                            cur.map((a) => (a.kind === "logo" ? { ...a, isSelected: a.id === l.id } : a)),
                          )
                        }
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.url ?? ""} alt="Logo" className="size-14 object-contain" />
                      <span className="text-xs text-muted-foreground">
                        {l.source === "upload" ? "nahrané" : "z webu"}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Logo nenalezeno – nahrajte ho.</p>
              )}
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-medium">Recenze (zaškrtnuté se použijí jako reference)</h3>
              {reviews.length ? (
                reviews.map((r) => (
                  <label key={r.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={r.isSelected}
                      onCheckedChange={(v) => patchAsset(r.id, { isSelected: v === true })}
                      className="mt-0.5"
                    />
                    <span>
                      „{r.review?.text}“{" "}
                      <span className="text-muted-foreground">
                        — {r.review?.author}, {"★".repeat(r.review?.rating ?? 0)}
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Žádné recenze.</p>
              )}
            </section>

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Vlastní podklady (menu, ceníky, PDF)</h3>
                <UploadButton
                  label="Nahrát soubory"
                  accept="application/pdf,image/*"
                  multiple
                  disabled={!blobEnabled || uploading !== null}
                  busy={uploading === "document"}
                  onFiles={(f) => handleUpload(f, "document")}
                />
              </div>
              {documents.length ? (
                <ul className="grid gap-1 text-sm">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={d.isSelected}
                          onCheckedChange={(v) => patchAsset(d.id, { isSelected: v === true })}
                        />
                        <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="hover:underline">
                          {d.filename ?? d.url}
                        </a>
                      </label>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Smazat"
                        onClick={() => removeUpload(d.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Žádné soubory.</p>
              )}
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Struktura webu</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex gap-4 text-sm">
              {(["one-page", "multi-page"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={structure.mode === m}
                    onChange={() => setStructure((s) => ({ ...s, mode: m }))}
                  />
                  {m === "one-page" ? "Jednostránkový" : "Vícestránkový"}
                </label>
              ))}
            </div>
            <CheckGroup
              title="Stránky"
              disabled={structure.mode === "one-page"}
              options={BUILDER_PAGES}
              value={structure.pages}
              onToggle={(k) => setStructure((s) => ({ ...s, pages: toggle(s.pages, k) }))}
            />
            <CheckGroup
              title="Sekce"
              options={BUILDER_SECTIONS}
              value={structure.sections}
              onToggle={(k) => setStructure((s) => ({ ...s, sections: toggle(s.sections, k) }))}
            />
            <CheckGroup
              title="Rozšíření"
              options={BUILDER_EXTRAS}
              value={structure.extras}
              onToggle={(k) => setStructure((s) => ({ ...s, extras: toggle(s.extras, k) }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Styl</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Šablona</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {BUILDER_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setStyle((s) => ({ ...s, template: t.key }))}
                    className={cn(
                      "rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent",
                      style.template === t.key && "border-primary ring-2 ring-primary",
                    )}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Barevná paleta {style.paletteSource === "logo" ? "(z loga)" : ""}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {(style.palette ?? []).map((c, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md border p-1">
                    <input
                      type="color"
                      value={c}
                      aria-label={`Barva ${i + 1}`}
                      onChange={(e) =>
                        setStyle((s) => ({
                          ...s,
                          paletteSource: "manual",
                          palette: (s.palette ?? []).map((x, j) =>
                            j === i ? e.target.value.toUpperCase() : x,
                          ),
                        }))
                      }
                      className="size-8 cursor-pointer rounded"
                    />
                    <span className="font-mono text-xs">{c}</span>
                    <button
                      type="button"
                      aria-label="Odebrat barvu"
                      onClick={() =>
                        setStyle((s) => ({
                          ...s,
                          paletteSource: "manual",
                          palette: (s.palette ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={(style.palette?.length ?? 0) >= 8}
                  onClick={() =>
                    setStyle((s) => ({
                      ...s,
                      paletteSource: "manual",
                      palette: [...(s.palette ?? []), "#1D4ED8"],
                    }))
                  }
                >
                  <Plus />
                  Barva
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={extractPalette}>
                  <Palette />
                  Načíst z loga
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="font-heading">Písmo nadpisů</Label>
                <NativeSelect
                  id="font-heading"
                  value={style.fonts?.heading ?? ""}
                  onChange={(e) =>
                    setStyle((s) => ({ ...s, fonts: { ...s.fonts, heading: e.target.value || undefined } }))
                  }
                >
                  <option value="">Nechat na Claude</option>
                  {BUILDER_FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="font-body">Písmo textu</Label>
                <NativeSelect
                  id="font-body"
                  value={style.fonts?.body ?? ""}
                  onChange={(e) =>
                    setStyle((s) => ({ ...s, fonts: { ...s.fonts, body: e.target.value || undefined } }))
                  }
                >
                  <option value="">Nechat na Claude</option>
                  {BUILDER_FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <CheckGroup
              title="Nálada"
              options={BUILDER_MOODS}
              value={style.mood ?? []}
              onToggle={(k) => setStyle((s) => ({ ...s, mood: toggle(s.mood ?? [], k) }))}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="refs">Referenční weby (jedna URL na řádek)</Label>
              <Textarea
                id="refs"
                rows={3}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vlastní instrukce</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Cokoli dalšího, co má Claude Code vědět…"
            />
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0">
        <div className="grid gap-4 xl:sticky xl:top-4">
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => run("generate")} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Vygenerovat prompt
                </Button>
                <Button type="button" variant="outline" onClick={() => run("save")} disabled={pending}>
                  <Save />
                  Uložit
                </Button>
              </div>
              {message ? (
                <p
                  className={cn(
                    "text-sm",
                    message.tone === "error" ? "text-destructive" : "text-emerald-700",
                  )}
                >
                  {message.text}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Prompt pro Claude Code</CardTitle>
              {shown ? <CopyButton text={shown.content} /> : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              {shown ? (
                <>
                  <NativeSelect
                    value={String(shown.version)}
                    onChange={(e) => setShownVersion(Number(e.target.value))}
                    aria-label="Verze promptu"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.version}>
                        Verze {v.version} ·{" "}
                        {new Date(v.createdAt).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}
                      </option>
                    ))}
                  </NativeSelect>
                  <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                    {shown.content}
                  </pre>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Zatím žádný prompt. Vyplňte údaje a klikněte na „Vygenerovat prompt“.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckGroup({
  title,
  options,
  value,
  onToggle,
  disabled,
}: {
  title: string;
  options: readonly { key: string; label: string }[];
  value: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className={cn("mb-2 text-sm font-medium", disabled && "text-muted-foreground")}>
        {title}
        {disabled ? " (jen u vícestránkového webu)" : ""}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((o) => (
          <label key={o.key} className={cn("flex items-center gap-2 text-sm", disabled && "opacity-50")}>
            <Checkbox
              checked={value.includes(o.key)}
              onCheckedChange={() => onToggle(o.key)}
              disabled={disabled}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function UploadButton({
  label,
  accept,
  multiple,
  disabled,
  busy,
  onFiles,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {label}
      </Button>
    </>
  );
}
