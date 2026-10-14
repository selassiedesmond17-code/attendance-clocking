"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SquareLoader } from "@/components/loaders";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else {
      setStep("code");
      setMessage("We sent a code to your email.");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      setIsError(true);
      return;
    }
    setSigningIn(true);
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
    );
    router.refresh();
  }

  return (
    <main className="page flex min-h-screen max-w-md flex-col justify-center">
      {signingIn && (
        <div className="splash" role="status">
          <SquareLoader />
          <p className="muted mt-6 text-sm">Signing you in…</p>
        </div>
      )}

      <div className="neu-card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="muted mt-1 text-sm">
            We will email you a one-time code.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="neu-input"
            />
            <button disabled={busy} className="neu-btn neu-btn-primary">
              {busy ? "Sending..." : "Send me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter the code"
              aria-label="One-time code"
              className="neu-input tracking-widest"
            />
            <button disabled={busy} className="neu-btn neu-btn-primary">
              {busy ? "Checking..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="neu-link text-sm"
            >
              Use a different email
            </button>
          </form>
        )}

        {message && (
          <p className={`alert ${isError ? "alert-error" : "alert-ok"}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}