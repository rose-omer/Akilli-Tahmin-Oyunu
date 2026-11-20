"use server";

import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { getGameService } from "@/lib/game/runtime";
import { clientIpFrom } from "@/lib/rateLimit";
import type { ActionResult, NextStepResult } from "@/lib/types";

// Server Action'lar da herkese açık POST uç noktasıdır: girdi doğrulaması ve hız sınırı
// servis katmanında her çağrıda uygulanır.

async function clientIp(): Promise<string> {
  const env = getEnv();
  return clientIpFrom(await headers(), {
    onVercel: env.VERCEL === "1",
    trustedHops: env.TRUSTED_PROXY_HOPS,
  });
}

export async function nextStep(input: unknown): Promise<ActionResult<NextStepResult>> {
  const service = await getGameService();
  return service.nextStep(input, await clientIp());
}

export async function submitFeedback(input: unknown): Promise<ActionResult<{ gameId: string }>> {
  const service = await getGameService();
  return service.submitFeedback(input, await clientIp());
}

export async function submitAnswer(input: unknown): Promise<ActionResult<{ learned: true }>> {
  const service = await getGameService();
  return service.submitAnswer(input, await clientIp());
}
