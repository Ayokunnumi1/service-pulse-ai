import { Cpu, Activity } from "lucide-react";
import { BankSwitcher } from "@/components/layout/bank-switcher";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireBank } from "@/lib/bank-context";
import { sql } from "@/lib/db/client";
import { listBanks } from "@/lib/db/banks";
import { aiConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const bank = await requireBank();
  const [banks, [alerts]] = await Promise.all([
    listBanks(),
    sql<{ n: number }[]>`
      select count(*)::int as n from issues
      where bank_id = ${bank.id} and status <> 'RESOLVED' and risk_level = 'CRITICAL'`,
  ]);
  const ai = aiConfigured();

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background">
      <Sidebar alertCount={alerts?.n ?? 0} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
          <BankSwitcher banks={banks.map((b) => ({ id: b.id, name: b.name }))} currentId={bank.id} />
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-secondary border border-border"
              title={
                ai ? "OpenAI structured outputs enabled" : "OPENAI_API_KEY not set — deterministic rules fallback in use"
              }
            >
              {ai ? (
                <Activity className="size-3.5 text-primary animate-pulse" />
              ) : (
                <Cpu className="text-muted-foreground size-3.5" />
              )}
              <span className="text-muted-foreground hidden sm:inline">AI engine:</span>
              <span className="font-medium">{ai ? "OpenAI connected" : "Rules fallback"}</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <MobileNav />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
