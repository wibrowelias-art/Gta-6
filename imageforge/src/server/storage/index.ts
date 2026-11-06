import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env } from "@/server/env";

export interface StorageDriver {
  name: "vercel-blob" | "local";
  put(key: string, data: Buffer, mime: string): Promise<string>; // returns storage key/url to persist
  get(stored: string): Promise<{ body: ReadableStream | Buffer; mime?: string } | null>;
  delete(stored: string): Promise<void>;
}

function blobAccess(): "private" | "public" {
  return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

const vercelBlob: StorageDriver = {
  name: "vercel-blob",
  async put(key, data, mime) {
    const res = await put(key, data, { access: blobAccess(), contentType: mime, addRandomSuffix: true, token: env.BLOB_READ_WRITE_TOKEN });
    return res.url;
  },
  async get(stored) {
    const res = await get(stored, { access: blobAccess(), token: env.BLOB_READ_WRITE_TOKEN });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { body: res.stream, mime: res.blob.contentType ?? undefined };
  },
  async delete(stored) {
    await del(stored, { token: env.BLOB_READ_WRITE_TOKEN });
  },
};

function localRoot() {
  return path.resolve(process.env.IMAGEFORGE_STORAGE_DIR || ".data/blobs");
}
function safeLocalPath(key: string) {
  const root = localRoot();
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error("invalid storage key");
  return p;
}

const local: StorageDriver = {
  name: "local",
  async put(key, data) {
    const p = safeLocalPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    return `local:${key}`;
  },
  async get(stored) {
    if (!stored.startsWith("local:")) return null;
    try {
      return { body: await readFile(safeLocalPath(stored.slice(6))) };
    } catch {
      return null;
    }
  },
  async delete(stored) {
    if (!stored.startsWith("local:")) return;
    await rm(safeLocalPath(stored.slice(6)), { force: true });
  },
};

/** Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise the local ./.data/blobs folder. */
export function getStorage(): StorageDriver {
  return env.BLOB_READ_WRITE_TOKEN ? vercelBlob : local;
}

/** Pick the driver that owns an already-stored key (handles switching drivers). */
export function storageFor(stored: string): StorageDriver {
  return stored.startsWith("local:") ? local : vercelBlob;
}
