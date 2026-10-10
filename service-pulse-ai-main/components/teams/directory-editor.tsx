"use client";

import { Building2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/client-api";
import type { DirectoryDepartment, DirectoryTeam } from "@/types";

function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function TeamCard({ team, products }: { team: DirectoryTeam; products: { code: string; name: string }[] }) {
  const { busy, run } = useMutation();
  const [value, setValue] = useState("");
  const [editingProducts, setEditingProducts] = useState(false);
  const owned = new Set(team.products.map((p) => p.code));
  const [selected, setSelected] = useState<Set<string>>(owned);

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{team.name}</div>
          {team.description && <div className="text-muted-foreground text-xs">{team.description}</div>}
        </div>
      </div>

      <div className="text-muted-foreground mt-3 text-xs font-semibold tracking-wide uppercase">Responsibilities</div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {team.responsibilities.map((r) => (
          <li key={r.id} className="group bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs">
            {r.responsibility}
            <button
              aria-label={`Remove ${r.responsibility}`}
              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100"
              disabled={busy}
              onClick={() =>
                run(
                  () => apiRequest(`/api/directory/teams/${team.id}/responsibilities/${r.id}`, undefined, "DELETE"),
                  "Responsibility removed",
                )
              }
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
        {team.responsibilities.length === 0 && <li className="text-muted-foreground text-xs">None defined</li>}
      </ul>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () => apiRequest(`/api/directory/teams/${team.id}/responsibilities`, { responsibility: value }),
              "Responsibility added",
            )
          )
            setValue("");
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add responsibility…"
          className="h-7 text-xs"
          maxLength={200}
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || value.trim().length < 2}>
          <Plus />
        </Button>
      </form>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Products owned</div>
        <button
          className="text-primary text-xs hover:underline"
          onClick={() => {
            setSelected(owned);
            setEditingProducts((v) => !v);
          }}
        >
          {editingProducts ? "Cancel" : "Edit"}
        </button>
      </div>
      {editingProducts ? (
        <div className="mt-1.5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {products.map((p) => {
              const on = selected.has(p.code);
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    if (on) next.delete(p.code);
                    else next.add(p.code);
                    setSelected(next);
                  }}
                  className={`rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${on ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border"}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (
                await run(
                  () => apiRequest(`/api/directory/teams/${team.id}/products`, { productCodes: [...selected] }, "PUT"),
                  "Product ownership updated",
                )
              )
                setEditingProducts(false);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Save products
          </Button>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {team.products.length ? (
            team.products.map((p) => (
              <Badge key={p.code} variant="outline">
                {p.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">None</span>
          )}
        </div>
      )}

      {team.systems.length > 0 && (
        <>
          <div className="text-muted-foreground mt-3 text-xs font-semibold tracking-wide uppercase">Systems owned</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {team.systems.map((s) => (
              <Badge key={s.name} variant="secondary" title={s.description ?? undefined}>
                {s.name}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddDepartmentDialog() {
  const { busy, run } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Department
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add department</DialogTitle>
          <DialogDescription>Departments group teams in the responsibility directory.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dept-name">Name</Label>
          <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              if (await run(() => apiRequest("/api/directory/departments", { name }), "Department added")) {
                setName("");
                setOpen(false);
              }
            }}
          >
            Add department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTeamDialog({ departments }: { departments: DirectoryDepartment[] }) {
  const { busy, run } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team</DialogTitle>
          <DialogDescription>
            Add responsibilities after creating the team so ServicePulse can route issues to it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Description</Label>
            <Input
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !departmentId || name.trim().length < 2}
            onClick={async () => {
              const ok = await run(
                () => apiRequest("/api/directory/teams", { departmentId, name, description: description || undefined }),
                "Team added",
              );
              if (ok) {
                setName("");
                setDescription("");
                setOpen(false);
              }
            }}
          >
            Add team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DirectoryEditor({
  departments,
  products,
}: {
  departments: DirectoryDepartment[];
  products: { code: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisational responsibility directory</CardTitle>
        <CardDescription>
          Department → team → responsibilities → products/systems owned. ServicePulse recommends owners only from this
          directory.
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 flex gap-2 self-start justify-self-end">
          <AddDepartmentDialog />
          <AddTeamDialog departments={departments} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {departments.map((d) => (
          <section key={d.id}>
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="text-muted-foreground size-4" />
              <h3 className="font-semibold">{d.name}</h3>
              <span className="text-muted-foreground text-xs">
                {d.teams.length} team{d.teams.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {d.teams.map((t) => (
                <TeamCard key={t.id} team={t} products={products} />
              ))}
              {d.teams.length === 0 && <p className="text-muted-foreground text-sm">No teams yet.</p>}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
