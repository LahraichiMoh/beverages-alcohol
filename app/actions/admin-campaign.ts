"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { unstable_cache } from "next/cache"

type TeamAccessCookie = {
  id: string
  username: string
  campaign_id: string
  permissions: {
    can_view_participants: boolean
    can_view_stats: boolean
    can_view_gifts: boolean
    can_edit_gifts: boolean
  }
  campaign_slug: string
  campaign_name: string
}

async function hasSuperAdminAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) return false
  const { data: adminRow } = await supabase.from("admins").select("id").eq("id", data.user.id).maybeSingle()
  return !!adminRow
}

async function getTeamAccessCookie(): Promise<TeamAccessCookie | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get("spin_team_access")
  if (!cookie) return null
  try {
    return JSON.parse(cookie.value) as TeamAccessCookie
  } catch {
    return null
  }
}

async function assertCampaignAccess(campaignId: string, permission: "participants" | "stats") {
  if (await hasSuperAdminAccess()) return

  const team = await getTeamAccessCookie()
  if (!team) throw new Error("Unauthorized")
  if (team.campaign_id !== campaignId) throw new Error("Unauthorized")

  if (permission === "participants" && !team.permissions.can_view_participants) throw new Error("Unauthorized")
  if (permission === "stats" && !team.permissions.can_view_stats) throw new Error("Unauthorized")
}

export async function getCampaignParticipantFilterOptions(campaignId: string) {
  await assertCampaignAccess(campaignId, "participants")
  return await getCampaignParticipantFilterOptionsCached(campaignId)
}

type DateRange = { from?: string; to?: string }

function applyDateRange<T extends { gte: any; lte: any }>(query: any, range?: DateRange) {
  if (range?.from) query = query.gte("created_at", range.from)
  if (range?.to) query = query.lte("created_at", range.to)
  return query
}

function applyFilters(query: any, params: { campaignId: string; city?: string; animator?: string; q?: string; range?: DateRange }) {
  query = query.eq("campaign_id", params.campaignId)
  if (params.city) query = query.eq("city", params.city)
  if (params.animator) query = query.eq("name", params.animator)
  query = applyDateRange(query, params.range)
  if (params.q) {
    const normalized = params.q.replaceAll(",", " ")
    query = query.or(`name.ilike.%${normalized}%,code.ilike.%${normalized}%,city.ilike.%${normalized}%`)
  }
  return query
}

const getCampaignParticipantFilterOptionsCached = unstable_cache(
  async (campaignId: string) => {
    const service = createServiceClient()

    const [{ data: gifts }, { data: rows }] = await Promise.all([
      service.from("gifts").select("id, name, image_url").eq("campaign_id", campaignId).order("name"),
      service.from("participants").select("city, name").eq("campaign_id", campaignId),
    ])

    const cities = Array.from(new Set((rows || []).map((r: any) => r.city).filter(Boolean))) as string[]
    const animators = Array.from(new Set((rows || []).map((r: any) => r.name).filter(Boolean))) as string[]

    return {
      success: true as const,
      data: {
        gifts: (gifts || []) as Array<{ id: string; name: string; image_url?: string }>,
        cities: cities.sort(),
        animators: animators.sort(),
      },
    }
  },
  ["campaign-filter-options"],
  { revalidate: 30 }
)

export async function getCampaignParticipantsPage(params: {
  campaignId: string
  winnersOnly: boolean
  sortDesc: boolean
  pageIndex: number
  pageSize: number
  city?: string
  animator?: string
  q?: string
  range?: DateRange
}) {
  await assertCampaignAccess(params.campaignId, "participants")
  const service = createServiceClient()

  let totalQuery = service.from("participants").select("*", { count: "exact", head: true })
  totalQuery = applyFilters(totalQuery, params)
  const { count: totalCount, error: totalError } = await totalQuery
  if (totalError) return { success: false as const, error: totalError.message }

  let winnersQuery = service.from("participants").select("*", { count: "exact", head: true }).eq("won", true)
  winnersQuery = applyFilters(winnersQuery, params)
  const { count: winnersCount, error: winnersError } = await winnersQuery
  if (winnersError) return { success: false as const, error: winnersError.message }

  let pageQuery = service
    .from("participants")
    .select("*, participant_details(full_name, phone, gender, age_range, address, usual_product)", { count: "exact" })
    .order("created_at", { ascending: !params.sortDesc })

  pageQuery = applyFilters(pageQuery, params)
  if (params.winnersOnly) pageQuery = pageQuery.eq("won", true)

  const from = params.pageIndex * params.pageSize
  const to = from + params.pageSize - 1
  pageQuery = pageQuery.range(from, to)

  const { data, count, error } = await pageQuery
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    data: {
      participants: (data || []) as any[],
      totalParticipants: totalCount || 0,
      totalWinners: winnersCount || 0,
      matchingTotal: count || 0,
    },
  }
}

export async function countCampaignParticipantsForExport(params: {
  campaignId: string
  winnersOnly: boolean
  city?: string
  animator?: string
  q?: string
  range?: DateRange
}) {
  await assertCampaignAccess(params.campaignId, "participants")
  const service = createServiceClient()

  let countQuery = service.from("participants").select("*", { count: "exact", head: true })
  countQuery = applyFilters(countQuery, params)
  if (params.winnersOnly) countQuery = countQuery.eq("won", true)

  const { count, error } = await countQuery
  if (error) return { success: false as const, error: error.message }

  return { success: true as const, data: { total: count || 0 } }
}

export async function getCampaignParticipantsExportChunk(params: {
  campaignId: string
  winnersOnly: boolean
  offset: number
  limit: number
  city?: string
  animator?: string
  q?: string
  range?: DateRange
}) {
  await assertCampaignAccess(params.campaignId, "participants")
  const service = createServiceClient()

  let query = service
    .from("participants")
    .select("name, code, city, prize_id, created_at, participant_details(full_name, phone, gender, age_range, address, usual_product)")
    .order("created_at", { ascending: false })

  query = applyFilters(query, params)
  if (params.winnersOnly) query = query.eq("won", true)

  query = query.range(params.offset, params.offset + params.limit - 1)

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return { success: true as const, data: { rows: (data || []) as any[] } }
}

export async function getCampaignStatsRows(params: { campaignId: string; range?: DateRange }) {
  await assertCampaignAccess(params.campaignId, "stats")
  const from = params.range?.from || ""
  const to = params.range?.to || ""
  return await getCampaignStatsRowsCached(params.campaignId, from, to)
}

const getCampaignStatsRowsCached = unstable_cache(
  async (campaignId: string, from: string, to: string) => {
    const service = createServiceClient()
    const range: DateRange | undefined = from || to ? { from: from || undefined, to: to || undefined } : undefined

    let allRows: any[] = []
    let offset = 0
    const limit = 1000
    let hasMore = true

    while (hasMore) {
      let query = service
        .from("participants")
        .select("created_at, city, participant_details(gender, age_range)")
        .eq("campaign_id", campaignId)

      query = applyDateRange(query, range)
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query
      if (error) return { success: false as const, error: error.message }

      if (data && data.length > 0) {
        allRows = [...allRows, ...data]
        offset += limit
        if (data.length < limit) hasMore = false
      } else {
        hasMore = false
      }
    }

    return { success: true as const, data: { rows: allRows } }
  },
  ["campaign-stats-rows"],
  { revalidate: 30 }
)
