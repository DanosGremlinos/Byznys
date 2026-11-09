"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export type LoginState = { error?: string; email?: string };

const INVALID = "Nesprávný e-mail nebo heslo.";

/** Reads ?callbackUrl= from the login page URL (Referer) and allows only same-origin paths. */
async function callbackUrlFromReferer(): Promise<string> {
  const referer = (await headers()).get("referer");
  if (!referer) return "/";
  let url: string | null = null;
  try {
    url = new URL(referer).searchParams.get("callbackUrl");
  } catch {
    return "/";
  }
  return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") ? url : "/";
}

const slowDown = () => new Promise((r) => setTimeout(r, 600));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const redirectTo = await callbackUrlFromReferer();
  const email = String(formData.get("email") ?? "");
  let resultUrl: string;
  try {
    resultUrl = await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await slowDown();
      return { error: INVALID, email };
    }
    throw error;
  }
  // On failure Auth.js returns its error page URL (…?error=CredentialsSignin) instead of throwing.
  if (new URL(resultUrl, "http://localhost").searchParams.has("error")) {
    await slowDown();
    return { error: INVALID, email };
  }
  redirect(redirectTo);
}
