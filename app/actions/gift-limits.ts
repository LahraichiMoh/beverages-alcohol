"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface GiftCityLimit {
  id: string
  gift_id: string
  city_id: string
  max_winners: number
}

export interface VenueForLimit {
  id: string
  name: string
  type?: string | null
  city_name?: string | null
}

export interface GiftVenueLimit {
  id: string
  gift_id: string
  venue_id: string
  max_winners: number
}

export async function getGiftGlobalTotalFromVenueLimits(giftId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("gift_venue_limits")
    .select("max_winners")
    .eq("gift_id", giftId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  const total = (data || []).reduce((acc, r: any) => acc + (Number(r.max_winners) || 0), 0)
  return { success: true as const, data: total }
}

export async function getGiftGlobalTotalsFromVenueLimits(giftIds: string[]) {
  const supabase = createServiceClient()
  if (giftIds.length === 0) return { success: true as const, data: new Map<string, number>() }

  const { data, error } = await supabase
    .from("gift_venue_limits")
    .select("gift_id, max_winners")
    .in("gift_id", giftIds)

  if (error) {
    return { success: false as const, error: error.message }
  }

  const totals = new Map<string, number>()
  ;(data || []).forEach((row: any) => {
    const giftId = String(row.gift_id)
    const prev = totals.get(giftId) || 0
    totals.set(giftId, prev + (Number(row.max_winners) || 0))
  })
  return { success: true as const, data: totals }
}

export async function getGiftGlobalTotalsFromCityLimits(giftIds: string[]) {
  const supabase = createServiceClient()
  if (giftIds.length === 0) return { success: true as const, data: new Map<string, number>() }

  const { data, error } = await supabase
    .from("gift_city_limits")
    .select("gift_id, max_winners")
    .in("gift_id", giftIds)

  if (error) {
    return { success: false as const, error: error.message }
  }

  const totals = new Map<string, number>()
  ;(data || []).forEach((row: any) => {
    const giftId = String(row.gift_id)
    const prev = totals.get(giftId) || 0
    totals.set(giftId, prev + (Number(row.max_winners) || 0))
  })
  return { success: true as const, data: totals }
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false as const, error: "Unauthorized" }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (adminError || !adminRow) return { success: false as const, error: "Unauthorized" }

  return { success: true as const }
}

export async function getGiftCityLimits(giftId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("gift_city_limits")
    .select("*")
    .eq("gift_id", giftId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data as GiftCityLimit[] }
}

export async function upsertGiftCityLimit(giftId: string, cityId: string, maxWinners: number) {
  const auth = await requireAdmin()
  if (!auth.success) return auth

  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from("gift_city_limits")
    .upsert({ gift_id: giftId, city_id: cityId, max_winners: maxWinners }, { onConflict: "gift_id, city_id" })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}

export async function getVenuesForLimits(campaignId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, type, city:cities ( name )")
    .eq("campaign_id", campaignId)
    .order("name")

  if (error) {
    return { success: false as const, error: error.message }
  }

  const rows = (data || []) as any[]
  const venues: VenueForLimit[] = rows.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type ?? null,
    city_name: v.city?.name ?? null,
  }))

  return { success: true as const, data: venues }
}

export async function getGiftVenueLimits(giftId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("gift_venue_limits")
    .select("*")
    .eq("gift_id", giftId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  return { success: true as const, data: data as GiftVenueLimit[] }
}

export async function upsertGiftVenueLimit(giftId: string, venueId: string, maxWinners: number) {
  const auth = await requireAdmin()
  if (!auth.success) return auth

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("gift_venue_limits")
    .upsert({ gift_id: giftId, venue_id: venueId, max_winners: maxWinners }, { onConflict: "gift_id, venue_id" })
    .select()
    .single()

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true as const, data }
}
