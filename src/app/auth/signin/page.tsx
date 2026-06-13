"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";

import { EmailPasswordFields, OAuthButtons } from "@/components/auth/OAuthButtons";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={handleCredentials}>
        <EmailPasswordFields
          email={email}
          password={password}
          onEmail={setEmail}
          onPassword={setPassword}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <hr />
      <OAuthButtons callbackUrl={callbackUrl} />
      <p>
        <a href={`/auth/signin?mode=magic&callbackUrl=${encodeURIComponent(callbackUrl)}`}>
          Sign in with magic link
        </a>
      </p>
      <p>
        No account? <a href="/auth/register">Create one</a>
      </p>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
