import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readGoogleSession, safeReturnPath } from "@/app/google-session";

// Backwards-compatible internal function names: authentication is now Google-based.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const user = await readGoogleSession(requestHeaders.get("cookie"));
  if (!user) return null;
  return {
    userId: "google:" + user.sub,
    displayName: user.name || user.email,
    email: user.email,
    fullName: user.name,
  };
}
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string): string {
  return "/login?return_to=" + encodeURIComponent(safeReturnPath(returnTo));
}
export function chatGPTSignOutPath(returnTo = "/"): string {
  return "/api/auth/google?mode=logout&return_to=" + encodeURIComponent(safeReturnPath(returnTo));
}
