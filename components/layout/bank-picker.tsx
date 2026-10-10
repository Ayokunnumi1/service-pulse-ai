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

const BANK_TAGS: Record<string, string[]> = {
  "zenith-bank": ["*966# USSD", "Z-Mobile", "Phoenix Core", "CBN SLA 24h"],
  gtbank: ["*737# USSD", "GTWorld", "Basis Core", "Instant NIP"],
  "access-bank": ["*901# USSD", "AccessMore", "Flexcube", "Closa Network"],
};

const BANK_ACCENTS: Record<string, { iconBg: string; iconColor: string; borderHover: string }> = {
  "zenith-bank": {
    iconBg: "bg-red-500/15 ring-red-500/25",
    iconColor: "text-red-500",
    borderHover: "hover:border-red-500/50 hover:shadow-red-500/10",
  },
  gtbank: {
    iconBg: "bg-amber-500/15 ring-amber-500/25",
    iconColor: "text-amber-500",
    borderHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
  },
  "access-bank": {
    iconBg: "bg-sky-500/15 ring-sky-500/25",
    iconColor: "text-sky-500",
    borderHover: "hover:border-sky-500/50 hover:shadow-sky-500/10",
  },
};

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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {banks.map((bank) => {
        const slug = bank.name.toLowerCase().includes("zenith")
          ? "zenith-bank"
          : bank.name.toLowerCase().includes("guaranty") || bank.name.toLowerCase().includes("gt")
          ? "gtbank"
          : "access-bank";
        const tags = BANK_TAGS[slug] ?? ["Retail Banking", "Core Switch", "USSD Gateway", "SLA 24h"];

        return (
          <button
            key={bank.id}
            onClick={() => select(bank.id)}
            disabled={loading !== null}
            className="minimal-card group flex flex-col items-center justify-center p-8 text-center disabled:opacity-60 cursor-pointer h-[320px]"
          >
            {loading === bank.id ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="text-primary size-8 animate-spin" />
                <span className="text-muted-foreground text-sm font-medium">Entering...</span>
              </div>
            ) : (
              <>
                <div className="glass-icon-container size-24 mb-6">
                  <Building2 className="size-10 text-[rgba(255,255,255,0.9)] dark:text-[rgba(255,255,255,0.7)] group-hover:text-primary transition-colors" />
                </div>
                
                <div className="text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors mb-2">
                  {bank.name}
                </div>
                
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[200px] mx-auto line-clamp-2">
                  {bank.description}
                </p>

                <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                   {bank.pending > 0 ? (
                     <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-primary bg-primary/10 rounded-full py-1.5 px-3 mx-auto w-max border border-primary/20">
                       <span className="size-2 rounded-full bg-primary animate-pulse" />
                       <span>{formatNumber(bank.pending)} Awaiting Classification</span>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-muted-foreground bg-secondary/50 rounded-full py-1.5 px-3 mx-auto w-max border border-border">
                       <span>View Operations</span>
                       <ArrowRight className="size-3" />
                     </div>
                   )}
                </div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
