"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminSessionValue,
  checkAdminPassword,
  isAdminSession,
} from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { getStore } from "@/lib/game/runtime";
import { allowRequest, clientIpFrom } from "@/lib/rateLimit";
import { QuestionIdSchema } from "@/lib/schemas";

// Server Action'lar herkese açık POST uç noktasıdır: her çağrı oturumu yeniden denetler.

const LOGIN_LIMIT_PER_MINUTE = 10;

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const env = getEnv();
  if (!env.ADMIN_TOKEN) return { error: "Yönetim kapalı." };

  const ip = clientIpFrom(await headers(), {
    onVercel: env.VERCEL === "1",
    trustedHops: env.TRUSTED_PROXY_HOPS,
  });
  const allowed = await allowRequest({
    store: getStore(),
    ip: `yonetim:${ip}`,
    salt: env.IP_HASH_SALT,
    limit: LOGIN_LIMIT_PER_MINUTE,
    now: new Date(),
  });
  if (!allowed) return { error: "Çok fazla deneme. Bir dakika bekle." };

  const password = form.get("parola");
  if (typeof password !== "string" || !checkAdminPassword(password, env.ADMIN_TOKEN)) {
    return { error: "Parola yanlış." };
  }
  (await cookies()).set(ADMIN_COOKIE, adminSessionValue(env.ADMIN_TOKEN), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/yonetim",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/yonetim");
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/yonetim" });
  redirect("/");
}

const ReviewSchema = z.object({ id: QuestionIdSchema, karar: z.enum(["onay", "ret"]) });

export async function review(form: FormData): Promise<void> {
  const env = getEnv();
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!env.ADMIN_TOKEN || !isAdminSession(session, env.ADMIN_TOKEN)) redirect("/yonetim");

  const parsed = ReviewSchema.safeParse({ id: form.get("id"), karar: form.get("karar") });
  if (!parsed.success) return;
  await getStore().reviewQuestion(parsed.data.id, parsed.data.karar === "onay");
  revalidatePath("/yonetim");
}
