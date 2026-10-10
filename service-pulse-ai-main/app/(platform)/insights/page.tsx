import type { Metadata } from "next";
import { Assistant } from "@/components/insights/assistant";
import { PageHeader } from "@/components/shared/page-header";
import { requireBank } from "@/lib/bank-context";

export const metadata: Metadata = { title: "Ask ServicePulse" };

export default async function InsightsPage() {
  const bank = await requireBank();
  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Ask ServicePulse"
        description="A management assistant that answers from this bank's computed data only — it does not invent statistics."
      />
      <Assistant key={bank.id} />
    </>
  );
}
