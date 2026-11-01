export function FormMessage({ state }: { state: { ok?: string; error?: string } }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}
