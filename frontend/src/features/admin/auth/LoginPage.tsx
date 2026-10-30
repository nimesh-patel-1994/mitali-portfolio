/**
 * Admin login `/admin/login` (UI-036, REQ-060..062, SEC-UI-005, SEC-UI-006).
 * Centred card with the admin wordmark and h1 "Admin login"; email (`autocomplete="username"`) and password
 * (`autocomplete="current-password"`, show/hide, paste allowed). No sign-up. After success → `next` when it is a
 * safe same-origin `/admin` path, else `/admin`. Already logged in → redirect.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { Navigate, useLocation, useSearchParams } from "react-router";
import { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { authApi } from "../api/admin-api";
import { isApiError } from "../api/errors";
import { adminKeys } from "../api/query";
import { safeNextPath } from "../session/next-path";
import { setCsrfToken } from "../session/session-store";
import { SESSION_ENDED_MESSAGE, useAdminMe, type LoginLocationState } from "../session/useSession";
import { describedBy, FieldShell, FormAlert, TextField, useFieldError, useFieldIds } from "../ui/fields";
import { adminTitle } from "../ui/states";
import kit from "../ui/Kit.module.css";
import styles from "./LoginPage.module.css";

export const LOGIN_MESSAGES = {
  invalid: "Email or password is incorrect.",
  tooMany: "Too many attempts. Try again in 15 minutes.",
  failed: "Login failed. Please try again.",
  network: "The server could not be reached. Check your connection and try again.",
} as const;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(254, "Keep the email address to 254 characters or fewer.")
    .pipe(z.email("Enter an email address like name@example.com.")),
  password: z.string().min(1, "Enter your password.").max(128, "Passwords are at most 128 characters."),
});

type LoginValues = z.input<typeof loginSchema>;

function PasswordField({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { register } = useFormContext<LoginValues>();
  const ids = useFieldIds();
  const error = useFieldError("password");
  return (
    <FieldShell ids={ids} label="Password" required error={error}>
      <div className={styles.passwordRow}>
        <input
          id={ids.id}
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          className={kit.input}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { error: !!error })}
          {...register("password")}
        />
        <button type="button" className={kit.smallButton} aria-pressed={shown} onClick={onToggle}>
          {shown ? "Hide password" : "Show password"}
        </button>
      </div>
    </FieldShell>
  );
}

export function LoginPage() {
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const sessionEnded = state?.sessionEnded === true;
  // Right after "Log out" the already-logged-in check is skipped, so a failed logout still lands here (UI-037).
  const me = useAdminMe(state?.loggedOut !== true);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [alert, setAlert] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const target = safeNextPath(params.get("next"));

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    document.title = adminTitle("Log in");
  }, []);

  if (me.isSuccess) return <Navigate to={target} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      const session = await authApi.adminLogin({ email: values.email, password: values.password });
      setCsrfToken(session.csrf_token);
      queryClient.setQueryData(adminKeys.me, session);
    } catch (error) {
      let message: string = LOGIN_MESSAGES.failed;
      if (isApiError(error)) {
        if (error.status === 401) message = LOGIN_MESSAGES.invalid;
        else if (error.status === 429) message = LOGIN_MESSAGES.tooMany;
        else if (error.isNetwork) message = LOGIN_MESSAGES.network;
      }
      setAlert(message);
      if (isApiError(error) && error.status === 401) {
        form.setValue("password", "");
        form.setFocus("password");
      }
    }
  });

  return (
    <main id="main" className={styles.page} data-surface="white">
      <div className={styles.card}>
        <Wordmark size="admin" tone="onLight" />
        <h1 className={kit.pageTitle}>Admin login</h1>
        {sessionEnded && (
          <p role="status" className={styles.notice}>
            {SESSION_ENDED_MESSAGE}
          </p>
        )}
        <FormAlert message={alert} />
        <FormProvider {...form}>
          <form className={kit.form} noValidate onSubmit={onSubmit} aria-label="Admin login">
            <TextField name="email" label="Email" type="email" required autoComplete="username" inputMode="email" />
            <PasswordField shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            <Button type="submit" loading={form.formState.isSubmitting} fullWidth>
              {form.formState.isSubmitting ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </FormProvider>
        <p className={kit.hint}>Forgot your password? Reset it with the reset-password command (see README).</p>
      </div>
    </main>
  );
}
