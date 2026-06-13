"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function MagicLinkContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const callbackUrl = `/api/auth/callback/email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  return (
    <main>
      <h1>Sign in with magic link</h1>
      <p>
        Click the button below to sign in. This link will open in the browser
        where you click it.
      </p>
      {email && (
        <p>
          Signing in as <strong>{email}</strong>
        </p>
      )}
      <a href={callbackUrl}>
        <button type="button">Sign in</button>
      </a>
      <p>
        <a href="/auth/signin">Back to sign in</a>
      </p>
    </main>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkContent />
    </Suspense>
  );
}
