import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteUser } from "@/actions/users";
import { Badge, Card, PageTitle } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ChangePasswordForm, CreateUserForm } from "@/components/admin/UserForms";

export default async function UsersAdmin() {
  const me = await requireUser();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageTitle>Vartotojai ir slaptažodžiai</PageTitle>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="p-4 font-medium">Vardas</th>
              <th className="p-4 font-medium">El. paštas</th>
              <th className="p-4 font-medium">Rolė</th>
              <th className="p-4 font-medium">Sukurtas</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-100">
                <td className="p-4 font-medium">
                  {u.name} {u.id === me.id && <Badge tone="green">jūs</Badge>}
                </td>
                <td className="p-4 text-zinc-500">{u.email}</td>
                <td className="p-4"><Badge>{u.role === "EDITOR" ? "Redaktorius" : "Administratorius"}</Badge></td>
                <td className="p-4 text-zinc-500">{u.createdAt.toLocaleDateString("lt-LT")}</td>
                <td className="p-4 text-right">
                  {u.id !== me.id && users.length > 1 && (
                    <form action={deleteUser.bind(null, u.id)}>
                      <ConfirmButton type="submit" message={`Pašalinti vartotoją ${u.email}?`} className="px-3 py-1 text-xs">
                        Pašalinti
                      </ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pakeisti slaptažodį">
          <ChangePasswordForm users={users.map((u) => ({ id: u.id, email: u.email }))} meId={me.id} />
        </Card>
        <Card title="Naujas vartotojas">
          <CreateUserForm />
        </Card>
      </div>
    </div>
  );
}
