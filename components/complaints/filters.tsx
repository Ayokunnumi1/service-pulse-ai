"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all";

export interface FilterOption {
  value: string;
  label: string;
}

export function InteractionFilters({
  channels,
  issueGroups,
  severities,
  statuses,
  intents,
}: {
  channels: FilterOption[];
  issueGroups: FilterOption[];
  severities: FilterOption[];
  statuses: FilterOption[];
  intents: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const select = (key: string, placeholder: string, options: FilterOption[], width = "w-44") => (
    <Select value={params.get(key) ?? ALL} onValueChange={(v) => update(key, v)}>
      <SelectTrigger className={`${width} bg-card`} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const hasFilters = [...params.keys()].some((k) => k !== "page");

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`}>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", q.trim() || null);
        }}
      >
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search messages…"
          className="bg-card w-64 pl-8"
          maxLength={100}
        />
      </form>
      {select("channel", "All channels", channels)}
      {select("issue", "All issue groups", issueGroups, "w-60")}
      {select("intent", "All intents", intents, "w-36")}
      {select("severity", "All severities", severities, "w-36")}
      {select("status", "All statuses", statuses, "w-40")}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.push(pathname));
          }}
        >
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
