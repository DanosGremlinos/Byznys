import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function UserMenu() {
  const session = await auth();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={session?.user?.email ?? undefined}>
        {session?.user?.name && session.user.name !== "Admin" ? session.user.name : session?.user?.email}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="ghost" size="sm">
          <LogOut />
          Odhlásit
        </Button>
      </form>
    </div>
  );
}
