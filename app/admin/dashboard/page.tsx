import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboard } from "@/components/admin-dashboard"
import { getTeamAccess } from "@/app/actions/team"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  let supabase;
  try {
    supabase = await createClient()
  } catch (error) {
    console.error("Supabase initialization failed:", error)
    redirect("/admin/login")
  }

  // 1. Check for Team Member Access
  const teamAccess = await getTeamAccess()
  if (teamAccess) {
    return <AdminDashboard userId={teamAccess.id} teamAccess={teamAccess} />
  }

  // 2. Check for Super Admin
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/admin/team-login")
  }

  const { data: adminData, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", data.user.id)
    .single()

  if (adminError || !adminData) {
    redirect("/admin/team-login")
  }

  return <AdminDashboard userId={data.user.id} />
}
