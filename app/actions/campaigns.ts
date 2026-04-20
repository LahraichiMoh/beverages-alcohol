"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getGiftGlobalTotalsFromCityLimits, getGiftGlobalTotalsFromVenueLimits } from "@/app/actions/gift-limits"

export type CampaignTheme = {
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  backgroundUrl?: string
  fontFamily?: string
  replayStartedAt?: string
}

export type Campaign = {
  id: string
  name: string
  slug: string
  description?: string
  theme: CampaignTheme
  is_active: boolean
  access_username?: string
  created_at: string
}

export interface Gift {
  id: string
  name: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
  campaign_id?: string
  created_by?: string
  available?: boolean // Computed field
  venue_total_max_winners?: number
  is_prize: boolean
  all_time_hits?: number
  all_time_winners?: number
  replay_hits?: number
  replay_winners?: number
}

function isMissingAccessColumnsError(err: unknown) {
  const msg = typeof (err as any)?.message === "string" ? ((err as any).message as string).toLowerCase() : ""
  return (
    msg.includes("does not exist") &&
    (msg.includes("access_username") || msg.includes("access_password"))
  )
}

export async function getCampaigns() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, slug, description, theme, is_active, access_username, created_at")
      .order("created_at", { ascending: false })
  
    if (error) {
      if (isMissingAccessColumnsError(error)) {
        const legacy = await supabase
          .from("campaigns")
          .select("id, name, slug, description, theme, is_active, created_at")
          .order("created_at", { ascending: false })
        if (legacy.error) {
          console.error("Error fetching campaigns:", legacy.error)
          return { success: false, error: legacy.error.message }
        }
        return { success: true, data: legacy.data as Campaign[] }
      }
      console.error("Error fetching campaigns:", error)
      return { success: false, error: error.message }
    }
  
    return { success: true, data: data as Campaign[] }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Error initializing Supabase client for getCampaigns:", message)
    return { success: false, error: message }
  }
}

export async function getCampaignBySlug(slug: string) {
  try {
    const supabase = await createClient()
  
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, slug, description, theme, is_active, access_username, created_at")
      .eq("slug", slug)
      .single()
  
    if (error) {
      if (isMissingAccessColumnsError(error)) {
        const legacy = await supabase
          .from("campaigns")
          .select("id, name, slug, description, theme, is_active, created_at")
          .eq("slug", slug)
          .single()
        if (legacy.error) {
          console.error(`Error fetching campaign with slug ${slug}:`, legacy.error)
          return { success: false, error: legacy.error.message }
        }
        return { success: true, data: legacy.data as Campaign }
      }
      console.error(`Error fetching campaign with slug ${slug}:`, error)
      return { success: false, error: error.message }
    }
  
    return { success: true, data: data as Campaign }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Error initializing Supabase client for getCampaignBySlug:", message)
    return { success: false, error: message }
  }
}

export async function getCampaignById(id: string) {
  try {
    const supabase = await createClient()
  
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, slug, description, theme, is_active, access_username, created_at")
      .eq("id", id)
      .single()
  
    if (error) {
      if (isMissingAccessColumnsError(error)) {
        const legacy = await supabase
          .from("campaigns")
          .select("id, name, slug, description, theme, is_active, created_at")
          .eq("id", id)
          .single()
        if (legacy.error) {
          console.error(`Error fetching campaign with id ${id}:`, legacy.error)
          return { success: false, error: legacy.error.message }
        }
        return { success: true, data: legacy.data as Campaign }
      }
      console.error(`Error fetching campaign with id ${id}:`, error)
      return { success: false, error: error.message }
    }
  
    return { success: true, data: data as Campaign }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Error initializing Supabase client for getCampaignById:", message)
    return { success: false, error: message }
  }
}

export async function createCampaign(data: {
  name: string
  slug: string
  description?: string
  theme?: CampaignTheme
  is_active?: boolean
  access_username?: string
  access_password?: string
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: "Unauthorized" }
  }

  const insertPayload: any = {
    name: data.name,
    slug: data.slug,
    description: data.description,
    theme: data.theme || {},
    created_by: user.id,
  }
  if (data.is_active === false) insertPayload.is_active = false
  if (data.access_username) insertPayload.access_username = data.access_username
  if (data.access_password) insertPayload.access_password = data.access_password

  let campaign: any | null = null
  let error: any | null = null
  {
    const res = await supabase
      .from("campaigns")
      .insert(insertPayload)
      .select("id, name, slug, description, theme, is_active, access_username, created_at")
      .single()
    campaign = res.data
    error = res.error
  }
  if (error && isMissingAccessColumnsError(error)) {
    delete insertPayload.access_username
    delete insertPayload.access_password
    const res = await supabase
      .from("campaigns")
      .insert(insertPayload)
      .select("id, name, slug, description, theme, is_active, created_at")
      .single()
    campaign = res.data
    error = res.error
  }

  if (error) {
    console.error("Error creating campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: campaign as Campaign }
}

export async function updateCampaign(id: string, data: Partial<{
  name: string
  slug: string
  description: string
  theme: CampaignTheme
  is_active: boolean
  access_username: string
  access_password: string
}>) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  let updated: any | null = null
  let error: any | null = null
  {
    const res = await supabase
      .from("campaigns")
      .update(data)
      .eq("id", id)
      .select("id, name, slug, description, theme, is_active, access_username, created_at")
      .single()
    updated = res.data
    error = res.error
  }
  if (error && isMissingAccessColumnsError(error)) {
    const legacyData: any = { ...data }
    delete legacyData.access_username
    delete legacyData.access_password

    const res = await supabase
      .from("campaigns")
      .update(legacyData)
      .eq("id", id)
      .select("id, name, slug, description, theme, is_active, created_at")
      .single()
    updated = res.data
    error = res.error
  }

  if (error) {
    console.error("Error updating campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: updated as Campaign }
}

const CAMPAIGN_ACCESS_COOKIE = "spin_campaign_access"

export async function loginCampaignAccess(slug: string, username: string, password: string) {
  try {
    const supabase = createServiceClient()

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, name, slug, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .ilike("access_username", username)
      .eq("access_password", password)
      .single()

    if (error) {
      if (isMissingAccessColumnsError(error)) {
        return { success: false as const, error: "Accès campagne non configuré" }
      }
      return { success: false as const, error: "Identifiants incorrects" }
    }
    if (!campaign) {
      return { success: false as const, error: "Identifiants incorrects" }
    }

    ;(await cookies()).set(
      CAMPAIGN_ACCESS_COOKIE,
      JSON.stringify({ id: campaign.id, slug: campaign.slug, name: campaign.name }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
      },
    )

    return { success: true as const, campaign: { id: campaign.id, slug: campaign.slug, name: campaign.name } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { success: false as const, error: msg }
  }
}

export async function getCurrentCampaignAccess() {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CAMPAIGN_ACCESS_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie.value) as { id: string; slug: string; name: string }
  } catch {
    return null
  }
}

export async function logoutCampaignAccess() {
  ;(await cookies()).delete(CAMPAIGN_ACCESS_COOKIE)
  return { success: true as const }
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting campaign:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

// --- Gift Management ---

export async function getCampaignGifts(campaignId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("gifts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name")

  if (error) {
    console.error("Error fetching campaign gifts:", error)
    return { success: false, error: error.message }
  }

  const gifts = (data || []) as Gift[]
  const giftIds = gifts.map((g) => g.id)
  const [venueTotalsRes, cityTotalsRes] = await Promise.all([
    getGiftGlobalTotalsFromVenueLimits(giftIds),
    getGiftGlobalTotalsFromCityLimits(giftIds),
  ])
  const venueTotals = venueTotalsRes.success ? venueTotalsRes.data : new Map<string, number>()
  const cityTotals = cityTotalsRes.success ? cityTotalsRes.data : new Map<string, number>()

  const { data: auth } = await supabase.auth.getUser()
  const hasAuthUser = !!auth?.user
  const teamCookie = (await cookies()).get("spin_team_access")
  let hasTeamAccessForCampaign = false
  if (teamCookie) {
    try {
      const parsed = JSON.parse(teamCookie.value) as { campaign_id?: string }
      hasTeamAccessForCampaign = parsed?.campaign_id === campaignId
    } catch {
      hasTeamAccessForCampaign = false
    }
  }

  const canReadHistory = hasAuthUser || hasTeamAccessForCampaign
  const allTimeHits = new Map<string, number>()
  const allTimeWinners = new Map<string, number>()
  const replayHits = new Map<string, number>()
  const replayWinners = new Map<string, number>()

  if (canReadHistory && giftIds.length > 0) {
    const service = createServiceClient()
    const { data: campaignRow } = await service
      .from("campaigns")
      .select("theme")
      .eq("id", campaignId)
      .maybeSingle()

    const replayStartedAtRaw = (campaignRow as any)?.theme?.replayStartedAt as string | undefined
    const replayStartedAt =
      replayStartedAtRaw && Number.isFinite(Date.parse(replayStartedAtRaw)) ? replayStartedAtRaw : undefined
    const replayMs = replayStartedAt ? Date.parse(replayStartedAt) : undefined

    const { data: spins } = await service
      .from("participants")
      .select("prize_id, won, created_at")
      .eq("campaign_id", campaignId)
      .in("prize_id", giftIds)
      .not("prize_id", "is", null)

    ;(spins || []).forEach((row: any) => {
      const prizeId = row.prize_id as string | null
      if (!prizeId) return
      allTimeHits.set(prizeId, (allTimeHits.get(prizeId) || 0) + 1)
      if (row.won === true) {
        allTimeWinners.set(prizeId, (allTimeWinners.get(prizeId) || 0) + 1)
      }

      if (replayMs !== undefined) {
        const createdMs = Date.parse(row.created_at as string)
        if (Number.isFinite(createdMs) && createdMs >= replayMs) {
          replayHits.set(prizeId, (replayHits.get(prizeId) || 0) + 1)
          if (row.won === true) {
            replayWinners.set(prizeId, (replayWinners.get(prizeId) || 0) + 1)
          }
        }
      }
    })
  }

  return {
    success: true,
    data: gifts.map((g) => ({
      ...g,
      venue_total_max_winners: (cityTotals.get(g.id) || 0) > 0 ? cityTotals.get(g.id) || 0 : venueTotals.get(g.id) || 0,
      all_time_hits: canReadHistory ? allTimeHits.get(g.id) || 0 : undefined,
      all_time_winners: canReadHistory ? allTimeWinners.get(g.id) || 0 : undefined,
      replay_hits: canReadHistory ? replayHits.get(g.id) || 0 : undefined,
      replay_winners: canReadHistory ? replayWinners.get(g.id) || 0 : undefined,
    })) as Gift[],
  }
}

export async function createCampaignGift(campaignId: string, gift: {
  name: string
  image_url?: string
  max_winners: number
  color?: string
  is_prize?: boolean
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const payload = {
    ...gift,
    campaign_id: campaignId,
    created_by: user.id,
    current_winners: 0,
    is_prize: gift.is_prize ?? true
  }

  const { data, error } = await supabase
    .from("gifts")
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error("Error creating gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function updateCampaignGift(giftId: string, updates: {
  name?: string
  image_url?: string
  max_winners?: number
  color?: string
  is_prize?: boolean
}) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data, error } = await supabase
    .from("gifts")
    .update(updates)
    .eq("id", giftId)
    .select()
    .single()

  if (error) {
    console.error("Error updating gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function resetGiftWinners(giftId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (adminError || !adminRow) return { success: false, error: "Unauthorized" }

  const service = createServiceClient()

  const { error: resetParticipantsError } = await service
    .from("participants")
    .update({ won: false, prize_id: null })
    .eq("prize_id", giftId)
    .eq("won", true)

  if (resetParticipantsError) {
    console.error("Error resetting participants for gift:", resetParticipantsError)
    return { success: false, error: resetParticipantsError.message }
  }

  const { data, error } = await service
    .from("gifts")
    .update({ current_winners: 0 })
    .eq("id", giftId)
    .select()
    .single()

  if (error) {
    console.error("Error resetting gift winners:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data: data as Gift }
}

export async function resetAllCampaignGifts(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (adminError || !adminRow) return { success: false, error: "Unauthorized" }

  const service = createServiceClient()

  const { data: campaignRow, error: campaignError } = await service
    .from("campaigns")
    .select("theme")
    .eq("id", campaignId)
    .single()

  if (campaignError) {
    console.error("Error loading campaign theme:", campaignError)
    return { success: false, error: campaignError.message }
  }

  const nowIso = new Date().toISOString()
  const nextTheme = {
    ...(((campaignRow as any)?.theme as Record<string, unknown>) || {}),
    replayStartedAt: nowIso,
  }

  const { error: updateCampaignError } = await service
    .from("campaigns")
    .update({ theme: nextTheme })
    .eq("id", campaignId)

  if (updateCampaignError) {
    console.error("Error updating campaign replay start:", updateCampaignError)
    return { success: false, error: updateCampaignError.message }
  }
  
  const { data, error } = await service
    .from("gifts")
    .update({ current_winners: 0 })
    .eq("campaign_id", campaignId)
    .select()
  
  if (error) {
    console.error("Error resetting all campaign gifts:", error)
    return { success: false, error: error.message }
  }
  
  revalidatePath("/admin/dashboard")
  return { success: true, data: (data || []) as Gift[] }
}

export async function deleteCampaignGift(giftId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "Unauthorized" }

  const { error } = await supabase
    .from("gifts")
    .delete()
    .eq("id", giftId)

  if (error) {
    console.error("Error deleting gift:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

// --- Public / Spin Logic ---

export async function getAvailablePrizes(campaignId: string, cityId?: string, cityName?: string, venueId?: string) {
  const supabase = createServiceClient() // Use service client to ensure we can read all limits/participants for counting

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("theme")
    .eq("id", campaignId)
    .maybeSingle()

  const replayStartedAtRaw = (campaignRow as any)?.theme?.replayStartedAt as string | undefined
  const replayStartedAt =
    replayStartedAtRaw && Number.isFinite(Date.parse(replayStartedAtRaw)) ? replayStartedAtRaw : undefined

  // 1. Get all gifts for campaign
  const { data: gifts, error: giftsError } = await supabase
    .from("gifts")
    .select("id, name, image_url, max_winners, current_winners, color, campaign_id, created_by, is_prize")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })

  if (giftsError || !gifts) {
    return { success: false, error: "No gifts found" }
  }

  const totalsRes = await getGiftGlobalTotalsFromVenueLimits((gifts as any[]).map((g) => g.id))
  const venueTotals = totalsRes.success ? totalsRes.data : new Map<string, number>()

  // Venue limits (stock per restau/bar)
  const venueLimitsMap = new Map<string, number>()
  const venueWinnerCounts = new Map<string, number>()
  if (venueId) {
    const { data: venueLimits } = await supabase
      .from("gift_venue_limits")
      .select("gift_id, max_winners")
      .eq("venue_id", venueId)
      .in(
        "gift_id",
        (gifts as any[]).map((g) => g.id),
      )

    let venueWinnersQuery = supabase
      .from("participants")
      .select("prize_id")
      .eq("campaign_id", campaignId)
      .eq("venue_id", venueId)
      .eq("won", true)
      .not("prize_id", "is", null)

    if (replayStartedAt) {
      venueWinnersQuery = venueWinnersQuery.gte("created_at", replayStartedAt)
    }

    const { data: venueWinners } = await venueWinnersQuery

    venueLimits?.forEach((l) => venueLimitsMap.set(l.gift_id, l.max_winners))
    venueWinners?.forEach((w) => {
      if (w.prize_id) {
        venueWinnerCounts.set(w.prize_id, (venueWinnerCounts.get(w.prize_id) || 0) + 1)
      }
    })
  }

  // 4. Determine availability
  const availableGifts = gifts.map(gift => {
    const venueTotal = venueTotals.get(gift.id) || 0
    const effectiveGlobalTotal = venueTotal > 0 ? venueTotal : gift.max_winners
    const globalAvailable = effectiveGlobalTotal === 0 || gift.current_winners < effectiveGlobalTotal
    
    // Venue Limit Check
    let venueAvailable = true
    if (venueId) {
      const venueLimit = venueLimitsMap.get(gift.id)
      if (venueLimit === undefined) {
        venueAvailable = false
      } else {
        const venueCount = venueWinnerCounts.get(gift.id) || 0
        if (venueCount >= venueLimit) {
          venueAvailable = false
        } else {
          venueAvailable = true
        }
      }
    }

    return {
      ...gift,
      venue_total_max_winners: venueTotal,
      available: globalAvailable && venueAvailable
    }
  })

  return { success: true, data: availableGifts }
}
