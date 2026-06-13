"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { EmailPasswordFields } from "@/components/auth/OAuthButtons";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { message?: string };
      setError(data.message ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
      redirect: false,
    });

    setLoading(false);
    if (result?.url) {
      window.location.href = result.url;
    } else {
      setError("Registration succeeded but sign-in failed. Please sign in.");
    }
  }

  return (
    <main>
      <h1>Create account</h1>
      <form onSubmit={handleSubmit}>
        <EmailPasswordFields
          email={email}
          password={password}
          onEmail={setEmail}
          onPassword={setPassword}
          autoCompletePassword="new-password"
          minLengthPassword={12}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p>
        Already have an account? <a href="/auth/signin">Sign in</a>
      </p>
    </main>
  );
}
