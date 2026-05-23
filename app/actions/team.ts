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

export type TeamAccessMembership = {
  id: string
  campaign_id: string
  campaign_slug?: string
  campaign_name?: string
  permissions: TeamMember["permissions"]
}

export type TeamAccessCookie =
  | {
      username: string
      memberships: TeamAccessMembership[]
    }
  | {
      id: string
      username: string
      campaign_id: string
      permissions: TeamMember["permissions"]
      campaign_slug?: string
      campaign_name?: string
    }

async function assertIsAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) throw new Error("Unauthorized")
  const { data: adminRow } = await supabase.from("admins").select("id").eq("id", data.user.id).maybeSingle()
  if (!adminRow) throw new Error("Unauthorized")
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

export async function createTeamMemberAllCampaigns(params: {
  username: string
  password: string
  permissions: TeamMember["permissions"]
}) {
  try {
    await assertIsAdmin()

    const service = createServiceClient()
    const { data: campaigns, error: campaignsError } = await service.from("campaigns").select("id")
    if (campaignsError) return { success: false as const, error: campaignsError.message }

    const ids = (campaigns || []).map((c: any) => c.id as string).filter(Boolean)
    if (ids.length === 0) return { success: false as const, error: "Aucune campagne trouvée" }

    const supabase = await createClient()
    const rows = ids.map((campaignId) => ({
      campaign_id: campaignId,
      username: params.username,
      password: params.password,
      permissions: params.permissions,
    }))

    const { data, error } = await supabase.from("team_members").upsert(rows, { onConflict: "campaign_id,username" }).select()
    if (error) return { success: false as const, error: error.message }

    return { success: true as const, data: data as TeamMember[] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return { success: false as const, error: msg }
  }
}

export async function createTeamMembersForCampaigns(params: {
  campaignIds: string[]
  username: string
  password: string
  permissions: TeamMember["permissions"]
}) {
  try {
    await assertIsAdmin()
    const ids = Array.from(new Set(params.campaignIds)).filter(Boolean)
    if (ids.length === 0) return { success: false as const, error: "Sélectionnez au moins une campagne" }

    const supabase = await createClient()
    const { data: existing, error: existingError } = await supabase
      .from("team_members")
      .select("campaign_id")
      .eq("username", params.username)

    if (existingError) return { success: false as const, error: existingError.message }

    const existingIds = (existing || []).map((r: any) => r.campaign_id as string).filter(Boolean)
    const toRevoke = existingIds.filter((campaignId) => !ids.includes(campaignId))
    if (toRevoke.length > 0) {
      const { error: revokeError } = await supabase
        .from("team_members")
        .delete()
        .eq("username", params.username)
        .in("campaign_id", toRevoke)

      if (revokeError) return { success: false as const, error: revokeError.message }
    }

    const rows = ids.map((campaignId) => ({
      campaign_id: campaignId,
      username: params.username,
      password: params.password,
      permissions: params.permissions,
    }))

    const { data, error } = await supabase.from("team_members").upsert(rows, { onConflict: "campaign_id,username" }).select()
    if (error) return { success: false as const, error: error.message }

    return { success: true as const, data: data as TeamMember[] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return { success: false as const, error: msg }
  }
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
  
  const { data: members, error } = await supabase
    .from("team_members")
    .select("*, campaigns(slug, name)")
    .ilike("username", username)
    .eq("password", password)
    .order("created_at", { ascending: false })

  if (error || !members || members.length === 0) {
    return { success: false, error: "Identifiants incorrects" }
  }

  const memberships: TeamAccessMembership[] = members.map((m: any) => ({
    id: m.id as string,
    campaign_id: m.campaign_id as string,
    campaign_slug: m.campaigns?.slug as string | undefined,
    campaign_name: m.campaigns?.name as string | undefined,
    permissions: m.permissions,
  }))
  const cookieData: TeamAccessCookie = { username, memberships }

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
    return JSON.parse(cookie.value) as TeamAccessCookie
  } catch {
    return null
  }
}

export async function refreshTeamAccess() {
  const existing = await getTeamAccess()
  if (!existing) return { success: false as const, error: "No session" }

  const username = existing.username
  const supabase = createServiceClient()

  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, campaign_id, permissions, campaigns(slug, name)")
    .ilike("username", username)
    .order("created_at", { ascending: false })

  if (error) return { success: false as const, error: error.message }
  if (!members || members.length === 0) {
    ;(await cookies()).delete(TEAM_ACCESS_COOKIE)
    return { success: true as const, revokedAll: true as const }
  }

  const memberships: TeamAccessMembership[] = members.map((m: any) => ({
    id: m.id as string,
    campaign_id: m.campaign_id as string,
    campaign_slug: m.campaigns?.slug as string | undefined,
    campaign_name: m.campaigns?.name as string | undefined,
    permissions: m.permissions,
  }))

  const cookieData: TeamAccessCookie = { username, memberships }
  ;(await cookies()).set(TEAM_ACCESS_COOKIE, JSON.stringify(cookieData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  })

  return { success: true as const, data: cookieData }
}

export async function logoutTeamAccess() {
  ;(await cookies()).delete(TEAM_ACCESS_COOKIE)
  return { success: true }
}
