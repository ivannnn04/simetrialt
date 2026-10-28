import { db } from "@/lib/db";
import { requireAdmin, ROLE_LABELS, type Role } from "@/lib/auth";
import { changeRole, deleteUser } from "@/actions/users";
import { Badge, Card, PageTitle } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ChangePasswordForm, CreateUserForm } from "@/components/admin/UserForms";

export default async function UsersAdmin() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageTitle>Vartotojai ir slaptažodžiai</PageTitle>
      <p className="text-sm text-zinc-600">
        Administratorius valdo visą sistemą ir vartotojus. Redaktorius tvarko svetainės turinį ir katalogą. Salono vadybininkas mato tik
        pasiūlymus: naršo katalogą svetainėje ir rengia komercinius pasiūlymus su nuolaidomis.
      </p>
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
                <td className="p-4">
                  {u.id === me.id ? (
                    <Badge>{ROLE_LABELS[u.role as Role] ?? u.role}</Badge>
                  ) : (
                    <form action={changeRole.bind(null, u.id)}>
                      <select name="role" defaultValue={u.role} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs">
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button type="submit" className="ml-2 text-xs underline">Keisti</button>
                    </form>
                  )}
                </td>
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
