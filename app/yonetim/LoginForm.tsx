"use client";

import { useActionState, useId } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  const inputId = useId();
  const errorId = useId();

  return (
    <form action={action} className="mt-8 max-w-sm">
      <label htmlFor={inputId} className="block text-sm font-medium">
        Parola
      </label>
      <input
        id={inputId}
        name="parola"
        type="password"
        required
        autoComplete="current-password"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? errorId : undefined}
        className="mt-2 block min-h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-base text-fg hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 aria-invalid:border-danger"
      />
      {state.error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={pending || undefined}
        className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-accent px-7 font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong aria-disabled:opacity-55"
      >
        {pending ? "Denetleniyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
