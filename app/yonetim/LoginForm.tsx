"use client";

import { useActionState, useId } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  const inputId = useId();
  const errorId = useId();

  return (
    <form action={action} className="max-w-sm">
      <label htmlFor={inputId} className="block text-sm font-bold">
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
        className="field mt-2"
      />
      {state.error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={pending || undefined}
        className="stamp stamp-solid stamp-lg mt-7 [--tilt:-1deg]"
      >
        {pending ? "Denetleniyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
