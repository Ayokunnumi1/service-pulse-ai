import { Cpu, Sparkles } from "lucide-react";
import { BankSwitcher } from "@/components/layout/bank-switcher";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { requireBank } from "@/lib/bank-context";
import { sql } from "@/lib/db/client";
import { listBanks } from "@/lib/db/banks";
import { aiConfigured, aiProviderName } from "@/lib/env";

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
  const aiName = aiProviderName();

  return (
    <div className="flex min-h-screen">
      <Sidebar alertCount={alerts?.n ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:px-8">
          <BankSwitcher banks={banks.map((b) => ({ id: b.id, name: b.name }))} currentId={bank.id} />
          <div
            className="bg-card ring-foreground/10 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1"
            title={ai ? `${aiName} structured outputs enabled` : "No AI key set — deterministic rules fallback in use"}
          >
            {ai ? (
              <Sparkles className="size-3.5 text-[var(--series-1)]" />
            ) : (
              <Cpu className="text-muted-foreground size-3.5" />
            )}
            <span className="text-muted-foreground">AI engine:</span>
            <span className="font-medium">{ai ? `${aiName} connected` : "Rules fallback"}</span>
          </div>
        </header>
        <MobileNav />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
