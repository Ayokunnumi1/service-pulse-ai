import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getActiveBank } from "@/lib/bank-context";
import { zodMessage } from "@/lib/validation/api";
import type { Bank } from "@/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Rejects cross-site mutation requests (the bank selection lives in a cookie). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "Cross-origin request rejected");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(403, "Invalid origin");
  }
}

export async function parseBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  return parsed.data;
}

/**
 * Wraps a route handler: resolves the active bank (tenant) from the
 * selection cookie, enforces same-origin for mutations and converts errors
 * to safe JSON responses (internal details are never returned or logged
 * with customer content).
 */
export function withBank<Ctx>(
  handler: (req: NextRequest, bank: Bank, ctx: Ctx) => Promise<Response>,
): (req: NextRequest, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      const bank = await getActiveBank();
      if (!bank) return jsonError(400, "No bank selected");
      return await handler(req, bank, ctx);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.status, err.message);
  const code = (err as { code?: string })?.code;
  if (code === "23505") return jsonError(409, "A record with that name already exists");
  if (code === "23503") return jsonError(400, "Referenced record does not exist for this bank");
  console.error("[api] unhandled error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  return jsonError(500, "Something went wrong. Please try again.");
}
