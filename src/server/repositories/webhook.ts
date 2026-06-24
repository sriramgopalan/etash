import { randomBytes } from "crypto";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";
import type { WebhookCreated, WebhookEndpoint, WebhookEvent, WebhookListItem } from "@/types/webhook";
import { WEBHOOK_EVENTS } from "@/types/webhook";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toListItem(row: {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
}): WebhookListItem {
  return {
    id: row.id,
    url: row.url,
    secretPreview: row.secret.slice(-4),
    events: row.events.filter((e): e is WebhookEvent => (WEBHOOK_EVENTS as string[]).includes(e)),
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function listWebhooks(): Promise<WebhookListItem[]> {
  const rows = await prisma.webhook.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toListItem);
}

export async function getActiveWebhooksForEvent(event: WebhookEvent): Promise<WebhookEndpoint[]> {
  const rows = await prisma.webhook.findMany({
    where: { isActive: true, events: { has: event } },
    select: { id: true, url: true, secret: true },
  });
  return rows;
}

export async function getWebhookForDelivery(id: string): Promise<WebhookEndpoint | null> {
  return prisma.webhook.findUnique({
    where: { id },
    select: { id: true, url: true, secret: true },
  });
}

export async function createWebhook(input: {
  url: string;
  events: WebhookEvent[];
}): Promise<WebhookCreated> {
  const secret = randomBytes(32).toString("hex");

  return prisma.$transaction(async (tx) => {
    const count = await tx.webhook.count();
    if (count >= env.WEBHOOK_MAX) {
      throw new AppError("CONFLICT", `Maximum of ${env.WEBHOOK_MAX} webhooks allowed.`);
    }
    const row = await tx.webhook.create({
      data: {
        url: input.url,
        secret,
        events: input.events,
      },
    });
    return {
      ...toListItem(row),
      secret,
    };
  });
}

export async function deleteWebhook(id: string): Promise<{ id: string }> {
  const existing = await prisma.webhook.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("NOT_FOUND", "Webhook not found.");
  await prisma.webhook.delete({ where: { id } });
  return { id };
}
