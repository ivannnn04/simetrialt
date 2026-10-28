"use client";

import { useActionState } from "react";
import { changePassword, createUser } from "@/actions/users";
import { Field, Input, Notice, PrimaryButton, Select, inputCls } from "@/components/admin/ui";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vardas">
          <Input name="name" required />
        </Field>
        <Field label="El. paštas">
          <Input name="email" type="email" required />
        </Field>
        <Field label="Slaptažodis" hint="Bent 8 simboliai">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Rolė">
          <Select name="role" defaultValue="ADMIN">
            <option value="ADMIN">Administratorius</option>
            <option value="EDITOR">Redaktorius</option>
            <option value="SHOWROOM">Salono vadybininkas</option>
          </Select>
        </Field>
      </div>
      {state?.error && <Notice tone="red">{state.error}</Notice>}
      {state?.ok && <Notice tone="green">{state.ok}</Notice>}
      <PrimaryButton type="submit" disabled={pending}>{pending ? "Kuriama…" : "Sukurti vartotoją"}</PrimaryButton>
    </form>
  );
}

export function ChangePasswordForm({ users, meId }: { users: { id: string; email: string }[]; meId: string }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Vartotojas">
          <select name="userId" defaultValue={meId} className={inputCls}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Naujas slaptažodis">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Pakartokite">
          <Input name="confirm" type="password" required minLength={8} />
        </Field>
      </div>
      {state?.error && <Notice tone="red">{state.error}</Notice>}
      {state?.ok && <Notice tone="green">{state.ok}</Notice>}
      <PrimaryButton type="submit" disabled={pending}>{pending ? "Saugoma…" : "Pakeisti slaptažodį"}</PrimaryButton>
    </form>
  );
}
