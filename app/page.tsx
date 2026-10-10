import { Database, ShieldCheck } from "lucide-react";
import { BankPicker } from "@/components/layout/bank-picker";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { listBankSummaries } from "@/lib/db/banks";

export const dynamic = "force-dynamic";

export default async function BankSelectionPage() {
  let banks: Awaited<ReturnType<typeof listBankSummaries>> = [];
  let dbError = false;
  try {
    banks = await listBankSummaries();
  } catch {
    dbError = true;
  }

  return (
    <main className="relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-xs">
            <span className="size-1.5 rounded-full bg-primary" />
            Institutional Dispute Resolution Engine
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Select a financial institution</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
            ServicePulse distills fragmented customer interactions (USSD drops, POS debit without dispense, NIP transfer failures) into structured SLA Intelligence — surfacing exactly what went wrong, the hypothesized root cause, and the specific banking operations team responsible for resolution. Each institution&apos;s data is fully isolated.
          </p>
        </div>

        <div className="mt-10">
          {dbError ? (
            <div className="border border-destructive/30 bg-destructive/10 flex gap-3 rounded-xl p-6">
              <Database className="text-destructive mt-0.5 size-5" />
              <div className="text-sm">
                <div className="font-medium text-destructive">Database not reachable</div>
                <p className="text-muted-foreground mt-1">
                  Check <code>DATABASE_URL</code>, then run <code>npm run db:migrate</code> and{" "}
                  <code>npm run db:seed</code>.
                </p>
              </div>
            </div>
          ) : banks.length === 0 ? (
            <div className="bg-card rounded-xl p-6 text-sm border border-border">
              No banks found. Run <code>npm run db:seed</code> to load the fictional demo institutions.
            </div>
          ) : (
            <BankPicker banks={banks} />
          )}
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> 
          <span>Demo environment — all institutions, staff structures and customer data are synthetic.</span>
        </div>
      </div>
    </main>
  );
}
