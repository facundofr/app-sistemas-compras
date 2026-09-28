"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="next" value={next} />
      <FieldGroup className="gap-5">
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            defaultValue={state.email}
            placeholder="nombre@grupocober.com"
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-10"
          />
        </Field>
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Ingresar
        </Button>
      </FieldGroup>
    </form>
  );
}
