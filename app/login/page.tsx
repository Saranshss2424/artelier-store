"use client";

import { useEffect, useRef, useState } from "react";

type GoogleAuth = { id: { initialize: (args: Record<string, unknown>) => void; renderButton: (element: HTMLElement, args: Record<string, unknown>) => void } };
declare global { interface Window { google?: { accounts?: GoogleAuth } } }

function safeDestination(): string {
  const value = new URLSearchParams(window.location.search).get("return_to") || "/";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.startsWith("/login") ? value : "/";
}

export default function LoginPage() {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(true);

  useEffect(() => {
    let active = true;
    let script: HTMLScriptElement | undefined;
    async function start() {
      try {
        const configResponse = await fetch("/api/auth/google?mode=config", { cache: "no-store" });
        const cfg = await configResponse.json() as { clientId?: string; configured?: boolean };
        if (!cfg.configured || !cfg.clientId) throw new Error("Google login is not configured for this store yet.");
        const nonceResponse = await fetch("/api/auth/google?mode=nonce", { credentials: "same-origin", cache: "no-store" });
        if (!nonceResponse.ok) throw new Error("Could not start a secure sign-in session.");
        const { nonce } = await nonceResponse.json() as { nonce: string };
        await new Promise<void>((resolve, reject) => {
          if (window.google?.accounts) return resolve();
          script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Google's sign-in service could not be loaded."));
          document.head.appendChild(script);
        });
        if (!active || !container.current || !window.google?.accounts) return;
        window.google.accounts.id.initialize({
          client_id: cfg.clientId,
          nonce,
          auto_select: false,
          ux_mode: "popup",
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return setError("Google did not return a credential.");
            setError("");
            setWorking(true);
            try {
              const result = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ credential: response.credential })
              });
              if (!result.ok) {
                const data = await result.json() as { error?: string };
                throw new Error(data.error || "Google sign-in failed.");
              }
              window.location.assign(safeDestination());
            } catch (err) {
              setError(err instanceof Error ? err.message : "Google sign-in failed.");
              setWorking(false);
            }
          }
        });
        window.google.accounts.id.renderButton(container.current, {
          type: "standard", shape: "pill", size: "large", theme: "outline", text: "continue_with", width: 290
        });
        setWorking(false);
      } catch (err) {
        if (active) { setWorking(false); setError(err instanceof Error ? err.message : "Google sign-in could not start."); }
      }
    }
    start();
    return () => { active = false; if (script?.parentNode) script.parentNode.removeChild(script); };
  }, []);

  return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 28 }}>
    <section style={{ background: "#faf8f4", padding: "38px 30px", width: "100%", maxWidth: 455, border: "1px solid #e2ded5", borderRadius: 16 }}>
      <a href="/" style={{ fontSize: 13, letterSpacing: 3, textDecoration: "none" }}>ARTELIER ✳</a>
      <h1 style={{ fontSize: "clamp(27px, 5vw, 39px)", margin: "30px 0 10px" }}>Welcome to Artelier.</h1>
      <p style={{ lineHeight: 1.65, margin: "0 0 28px" }}>Continue with your Google account to save favourites, apply to sell or access your account.</p>
      {working && <p aria-live="polite">Preparing secure Google sign-in…</p>}
      <div ref={container} aria-label="Continue with Google" />
      {error && <p role="alert" style={{ color: "#ad332b", marginTop: 18 }}>{error}</p>}
      {error && <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 10 }}>Try again</button>}
      <p style={{ fontSize: 12, color: "#776e66", marginTop: 26 }}>Your Google password is never shared with Artelier.</p>
    </section>
  </main>;
}
