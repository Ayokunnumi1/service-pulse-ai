"use client";

import { FileUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/client-api";

interface ImportResult {
  imported: number;
  rejected: number;
  totalRows: number;
  errors: { row: number; message: string }[];
}

const MAX_BYTES = 4_000_000;

export function ImportDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit() {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 4 MB — split it into smaller files.");
      return;
    }
    const format = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
    setBusy(true);
    try {
      const content = await file.text();
      const r = await apiRequest<ImportResult>("/api/interactions/import", { format, content });
      setResult(r);
      toast.success(`Imported ${r.imported} interactions`, {
        description: r.rejected
          ? `${r.rejected} row(s) rejected by validation.`
          : "Run classification to analyse them.",
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setFile(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Import CSV / JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import customer interactions</DialogTitle>
          <DialogDescription>
            Upload a CSV with a header row, or a JSON array. Required: <code>channel</code>, <code>message</code>.
            Optional: <code>customer_reference</code>, <code>branch</code>, <code>location</code>, <code>product</code>,{" "}
            <code>amount</code>, <code>timestamp</code> (ISO 8601). Channels: BRANCH, CONTACT_CENTER, EMAIL, MOBILE_APP,
            USSD, WHATSAPP, SOCIAL_MEDIA, WEB. A sample file is in <code>data/seed/sample-import.csv</code>.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-muted-foreground hover:bg-muted/50 flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm"
        >
          <FileUp className="size-6" />
          {file ? <span className="text-foreground font-medium">{file.name}</span> : "Choose a .csv or .json file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
        />

        {result && (
          <div className="bg-muted/60 rounded-lg p-3 text-sm">
            <div>
              <span className="font-medium">{result.imported}</span> of {result.totalRows} rows imported
              {result.rejected > 0 && <>, {result.rejected} rejected</>}.
            </div>
            {result.errors.length > 0 && (
              <ul className="text-muted-foreground mt-2 max-h-32 space-y-1 overflow-auto text-xs">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
