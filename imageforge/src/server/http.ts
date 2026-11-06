import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

export const notFoundResponse = () => fail(404, "NOT_FOUND", "Not found");

/** Wraps a route handler so unexpected errors become a generic, user-safe message (never a stack trace). */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.code, e.message, e.details);
      if (e instanceof ZodError) {
        return fail(400, "INVALID_INPUT", "Some fields are invalid.", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      console.error("[api] unhandled", e);
      return fail(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be JSON.");
  }
}
