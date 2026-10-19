import { dbStatus } from "@/lib/db";
import { LoginForm } from "@/components/admin/LoginForm";
import { SetupNotice } from "@/components/admin/SetupNotice";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const status = await dbStatus();
  const ready = status.ok && Boolean(process.env.SESSION_SECRET);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-100 px-4 py-10">
      {ready ? <LoginForm /> : <SetupNotice status={status} />}
    </main>
  );
}
