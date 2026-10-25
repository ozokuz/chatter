import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";
import type { ChatMessage } from "../../../packages/shared/chat";

export const authClient = createAuthClient({ plugins: [usernameClient()] });

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Unable to connect. Please try again.", response.status);
  }
  return response.json();
}

export function mergeMessages(...groups: ChatMessage[][]) {
  return [...new Map(groups.flat().map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
