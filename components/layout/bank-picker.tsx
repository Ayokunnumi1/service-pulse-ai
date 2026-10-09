"use client";

import { ArrowRight, Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/client-api";
import { formatNumber } from "@/lib/utils/format";

interface BankCard {
  id: string;
  name: string;
  description: string | null;
  interactions: number;
  pending: number;
  open_issues: number;
  teams: number;
}

export function BankPicker({ banks }: { banks: BankCard[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function select(id: string) {
    setLoading(id);
    try {
      await apiRequest("/api/bank", { bankId: id });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not select bank");
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {banks.map((bank) => (
        <button
          key={bank.id}
          onClick={() => select(bank.id)}
          disabled={loading !== null}
          className="group bg-card ring-foreground/10 flex flex-col rounded-xl p-5 text-left ring-1 transition hover:shadow-lg hover:ring-[var(--series-1)] disabled:opacity-60"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Building2 className="size-5" />
            </div>
            {loading === bank.id ? (
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            ) : (
              <ArrowRight className="text-muted-foreground group-hover:text-foreground size-5 transition group-hover:translate-x-0.5" />
            )}
          </div>
          <div className="mt-4 text-lg font-semibold">{bank.name}</div>
          <p className="text-muted-foreground mt-1 text-sm">{bank.description}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Interactions</dt>
              <dd className="tabular font-semibold">{formatNumber(bank.interactions)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Emerging issues</dt>
              <dd className="tabular font-semibold">{formatNumber(bank.open_issues)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Teams</dt>
              <dd className="tabular font-semibold">{formatNumber(bank.teams)}</dd>
            </div>
          </dl>
          {bank.pending > 0 && (
            <div className="text-muted-foreground mt-3 text-xs">
              {formatNumber(bank.pending)} interactions awaiting AI classification
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
