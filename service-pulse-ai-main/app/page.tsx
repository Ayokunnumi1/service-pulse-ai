import { Database, ShieldCheck } from "lucide-react";
import { BankPicker } from "@/components/layout/bank-picker";
import { Logo } from "@/components/layout/logo";
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,oklch(0.93_0.03_258),transparent_60%)]">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <Logo />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">Select a financial institution</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          ServicePulse turns fragmented customer interactions into early warnings — what is going wrong, why it is
          likely happening, and which team should fix it. Each institution&apos;s data is fully isolated.
        </p>

        <div className="mt-8">
          {dbError ? (
            <div className="bg-card ring-destructive/30 flex gap-3 rounded-xl p-5 ring-1">
              <Database className="text-destructive mt-0.5 size-5" />
              <div className="text-sm">
                <div className="font-medium">Database not reachable</div>
                <p className="text-muted-foreground mt-1">
                  Check <code>DATABASE_URL</code>, then run <code>npm run db:migrate</code> and{" "}
                  <code>npm run db:seed</code>.
                </p>
              </div>
            </div>
          ) : banks.length === 0 ? (
            <div className="bg-card ring-foreground/10 rounded-xl p-5 text-sm ring-1">
              No banks found. Run <code>npm run db:seed</code> to load the fictional demo institutions.
            </div>
          ) : (
            <BankPicker banks={banks} />
          )}
        </div>

        <p className="text-muted-foreground mt-10 flex items-center gap-2 text-xs">
          <ShieldCheck className="size-4" /> Demo environment — all institutions, staff structures and customer data are
          synthetic.
        </p>
      </div>
    </main>
  );
}
