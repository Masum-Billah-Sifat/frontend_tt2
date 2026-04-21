"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
declare global {
  interface Window {
    google?: any;
  }
}
export default function HomePage() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && user)
      router.replace(
        !user.roles.length || !user.activeRole
          ? "/onboarding"
          : user.activeRole === "guardian"
            ? "/guardian"
            : "/tutor",
      );
  }, [loading, user, router]);
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !ref.current) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            await loginWithGoogle(response.credential);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            router.push("/auth/error");
          }
        },
      });
      ref.current.innerHTML = "";
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [loginWithGoogle, router]);
  return (
    <main className="container">
      <div
        className="card"
        style={{ maxWidth: 720, margin: "80px auto", textAlign: "center" }}
      >
        <h1>Tutor Mart Phase 1</h1>
        <p>
          Google auth, roles, protected dashboards, realtime 1-to-1 chat,
          presence, and audio/text messages.
        </p>
        <div ref={ref} />
        {error ? <p className="small">{error}</p> : null}
      </div>
    </main>
  );
}
