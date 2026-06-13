"use client";

import { signIn } from "next-auth/react";

interface FieldsProps {
  email: string;
  password: string;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  autoCompletePassword?: "current-password" | "new-password";
  minLengthPassword?: number;
}

export function EmailPasswordFields({
  email,
  password,
  onEmail,
  onPassword,
  autoCompletePassword = "current-password",
  minLengthPassword,
}: FieldsProps) {
  return (
    <>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        autoComplete={autoCompletePassword}
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        required
        {...(minLengthPassword !== undefined ? { minLength: minLengthPassword } : {})}
      />
    </>
  );
}

interface OAuthProps {
  callbackUrl: string;
}

export function OAuthButtons({ callbackUrl }: OAuthProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => void signIn("google", { callbackUrl })}
      >
        Sign in with Google
      </button>
      <button
        type="button"
        onClick={() => void signIn("github", { callbackUrl })}
      >
        Sign in with GitHub
      </button>
    </>
  );
}
