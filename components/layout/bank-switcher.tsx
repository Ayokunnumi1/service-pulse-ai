"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/client-api";

export function BankSwitcher({ banks, currentId }: { banks: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = banks.find((b) => b.id === currentId);

  function onChange(id: string) {
    startTransition(async () => {
      try {
        await apiRequest("/api/bank", { bankId: id });
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not switch bank");
      }
    });
  }

  return (
    <Select value={currentId} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="liquid-glass w-64 rounded-full font-semibold shadow-xs border border-white/30 text-sm cursor-pointer" aria-label="Financial institution">
        <Building2 className="text-primary size-4" />
        <SelectValue>{current?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {banks.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
