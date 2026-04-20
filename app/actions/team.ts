"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"

export interface TeamMember {
  id: string
  campaign_id: string
  username: string
  password?: string
  permissions: {
    can_view_participants: boolean
    can_view_stats: boolean
    can_view_gifts: boolean
    can_edit_gifts: boolean
  }
  created_at: string
}

export async function getTeamMembers(campaignId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching team members:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as TeamMember[] }
}

export async function createTeamMember(member: Omit<TeamMember, "id" | "created_at">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("team_members")
    .insert([member])
    .select()
    .single()

  if (error) {
    console.error("Error creating team member:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as TeamMember }
}

export async function updateTeamMember(id: string, updates: Partial<TeamMember>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("team_members")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating team member:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as TeamMember }
}

export async function deleteTeamMember(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting team member:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

const TEAM_ACCESS_COOKIE = "spin_team_access"

export async function loginTeamAccess(username: string, password: string) {
  const supabase = createServiceClient()
  
  const { data: member, error } = await supabase
    .from("team_members")
    .select("*, campaigns(slug, name)")
    .ilike("username", username)
    .eq("password", password)
    .single()

  if (error || !member) {
    return { success: false, error: "Identifiants incorrects" }
  }

  const cookieData = {
    id: member.id,
    username: member.username,
    campaign_id: member.campaign_id,
    permissions: member.permissions,
    campaign_slug: (member as any).campaigns?.slug,
    campaign_name: (member as any).campaigns?.name
  }

  ;(await cookies()).set(
    TEAM_ACCESS_COOKIE,
    JSON.stringify(cookieData),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    }
  )

  return { success: true, data: cookieData }
}

export async function getTeamAccess() {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(TEAM_ACCESS_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie.value)
  } catch {
    return null
  }
}

export async function logoutTeamAccess() {
  ;(await cookies()).delete(TEAM_ACCESS_COOKIE)
  return { success: true }
}
