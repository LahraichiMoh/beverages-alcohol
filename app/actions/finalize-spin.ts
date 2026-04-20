"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { getAvailablePrizes, type Campaign, type Gift } from "@/app/actions/campaigns"
import { getGiftGlobalTotalFromVenueLimits } from "@/app/actions/gift-limits"

export async function finalizeSpin(participantId: string, selectedPrizeId: string, cityId?: string, _allowRespin?: boolean) {
  try {
    const supabase = createServiceClient()

    const { data: participantRow, error: participantFetchError } = await supabase
      .from("participants")
      .select("name, code, city, city_id, venue_id, campaign_id, won, prize_id")
      .eq("id", participantId)
      .single()

    if (participantFetchError) {
      throw participantFetchError
    }

    // Resolve effective city id once for availability checks
    let effectiveCityId: string | undefined = participantRow.city_id || cityId
    let effectiveCityName: string | undefined = participantRow.city
    const effectiveVenueId: string | undefined = participantRow.venue_id || undefined

    if (!effectiveCityId && participantRow.city) {
      const { data: cityRows } = await supabase
        .from("cities")
        .select("id, name")
        .ilike("name", participantRow.city)
        .limit(1)
      
      if (cityRows && cityRows.length > 0) {
        effectiveCityId = cityRows[0].id
        effectiveCityName = cityRows[0].name
      }
    }
    if (effectiveCityId && !effectiveCityName) {
      const { data: cityRows } = await supabase.from("cities").select("name").eq("id", effectiveCityId).limit(1)
      if (cityRows && cityRows.length > 0) effectiveCityName = cityRows[0].name
    }

    if (participantRow.won === true) {
      return { success: false, error: "Already spun" }
    }

    let replayStartedAt: string | undefined = undefined
    if (participantRow.campaign_id) {
      const { data: campaignRow } = await supabase
        .from("campaigns")
        .select("theme")
        .eq("id", participantRow.campaign_id)
        .maybeSingle()
      const raw = (campaignRow as any)?.theme?.replayStartedAt as string | undefined
      replayStartedAt = raw && Number.isFinite(Date.parse(raw)) ? raw : undefined
    }

    // Strong guard: verify the selected prize is currently available for this campaign/city
    if (participantRow.campaign_id) {
      const availability = await getAvailablePrizes(participantRow.campaign_id, effectiveCityId, effectiveCityName, effectiveVenueId)
      if (availability.success && availability.data) {
        const selected = availability.data.find((g: any) => g.id === selectedPrizeId)
        if (!selected || selected.available === false) {
          return { success: false, error: "La période de participation est terminée pour aujourd'hui." }
        }
      }
    }

    // --- CHECK LIMITS BEFORE AWARDING PRIZE ---
    const { data: prizeData, error: prizeFetchError } = await supabase
      .from("gifts")
      .select("current_winners, max_winners, is_prize")
      .eq("id", selectedPrizeId)
      .single()

    if (prizeFetchError) {
      throw prizeFetchError
    }

    // If it's NOT a prize (e.g. "Oops"), we don't check limits or increment winners
    if (prizeData.is_prize === false) {
      const { error: updateParticipantError } = await supabase
        .from("participants")
        .update({ won: false, prize_id: selectedPrizeId })
        .eq("id", participantId)
        .eq("won", false)

      if (updateParticipantError) throw updateParticipantError
      return { success: true }
    }

    const venueTotalRes = await getGiftGlobalTotalFromVenueLimits(selectedPrizeId)
    const venueTotal = venueTotalRes.success ? venueTotalRes.data : 0
    const effectiveGlobalTotal = venueTotal > 0 ? venueTotal : prizeData.max_winners

    let isEligible = true
    let limitError = ""

    // 1. Check / Reserve Global Limit
    let reservedGlobal = false
    if (effectiveGlobalTotal !== 0) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: freshGift, error: freshError } = await supabase
          .from("gifts")
          .select("current_winners")
          .eq("id", selectedPrizeId)
          .single()
        if (freshError) throw freshError

        const current = Number((freshGift as any)?.current_winners) || 0
        if (current >= effectiveGlobalTotal) {
          isEligible = false
          limitError = "Global limit reached"
          break
        }

        const { data: updatedRow, error: reserveError } = await supabase
          .from("gifts")
          .update({ current_winners: current + 1 })
          .eq("id", selectedPrizeId)
          .eq("current_winners", current)
          .lt("current_winners", effectiveGlobalTotal)
          .select("id")
          .maybeSingle()

        if (reserveError) throw reserveError
        if (updatedRow) {
          reservedGlobal = true
          break
        }
      }

      if (!reservedGlobal && isEligible) {
        isEligible = false
        limitError = "Global limit reached"
      }
    }

    // 2. Check Venue stock (if still eligible)
    if (isEligible && effectiveVenueId) {
      const { data: venueLimitRow } = await supabase
        .from("gift_venue_limits")
        .select("max_winners")
        .eq("gift_id", selectedPrizeId)
        .eq("venue_id", effectiveVenueId)
        .single()

      if (!venueLimitRow) {
        isEligible = false
        limitError = "Stock non configuré pour cet établissement."
      } else {
        let countQuery = supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", participantRow.campaign_id)
          .eq("venue_id", effectiveVenueId)
          .eq("prize_id", selectedPrizeId)
          .eq("won", true)

        if (replayStartedAt) {
          countQuery = countQuery.gte("created_at", replayStartedAt)
        }

        const { count, error: countError } = await countQuery

        if (!countError && count !== null && count >= venueLimitRow.max_winners) {
          isEligible = false
          limitError = "Stock épuisé pour cet établissement."
        }
      }
    }

    if (!isEligible) {
      if (reservedGlobal) {
        const { data: freshGift } = await supabase
          .from("gifts")
          .select("current_winners")
          .eq("id", selectedPrizeId)
          .single()
        const current = Number((freshGift as any)?.current_winners) || 0
        await supabase
          .from("gifts")
          .update({ current_winners: Math.max(0, current - 1) })
          .eq("id", selectedPrizeId)
          .eq("current_winners", current)
      }
      // If not eligible, we don't mark as won. We might want to return an error or pick a fallback.
      // But since the wheel already spun, this is a race condition or configuration issue.
      // Ideally, the spin API should return the prize.
      // Here, we just fail the update to avoid over-awarding.
      return { success: false, error: limitError || "La période de participation est terminée pour aujourd'hui." }
    }
    // ------------------------------------------

    const { error: updateParticipantError } = await supabase
      .from("participants")
      .update({ won: true, prize_id: selectedPrizeId })
      .eq("id", participantId)
      .eq("won", false)

    if (updateParticipantError) {
      if (reservedGlobal) {
        const { data: freshGift } = await supabase
          .from("gifts")
          .select("current_winners")
          .eq("id", selectedPrizeId)
          .single()
        const current = Number((freshGift as any)?.current_winners) || 0
        await supabase
          .from("gifts")
          .update({ current_winners: Math.max(0, current - 1) })
          .eq("id", selectedPrizeId)
          .eq("current_winners", current)
      }
      throw updateParticipantError
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

export async function getSpinData(participantId: string) {
  try {
    const supabase = createServiceClient()

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, name, code, city, city_id, venue_id, venue_type, won, prize_id, campaign_id, agreed_to_terms, created_at")
      .eq("id", participantId)
      .single()

    if (participantError || !participant) {
      return { success: false as const, error: participantError?.message || "Participant introuvable" }
    }

    let campaign: Campaign | null = null
    if (participant.campaign_id) {
      const { data: campaignRow, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", participant.campaign_id)
        .single()
      if (!campaignError && campaignRow) {
        campaign = campaignRow as Campaign
      }
    }

    let cityId: string | undefined = participant.city_id || undefined
    if (!cityId && participant.city) {
      const { data: cityRows } = await supabase.from("cities").select("id").ilike("name", participant.city).limit(1)
      if (cityRows && cityRows.length > 0) cityId = cityRows[0].id
    }

    let prizes: Gift[] = []
    if (participant.campaign_id) {
      const res = await getAvailablePrizes(participant.campaign_id, cityId, participant.city, participant.venue_id || undefined)
      prizes = res.success && res.data ? (res.data as Gift[]) : []
    } else {
      let query = supabase.from("gifts").select("*")
      const ownerId = process.env.NEXT_PUBLIC_GIFTS_OWNER_ID || ""
      if (ownerId) query = query.eq("created_by", ownerId)
      const { data: giftsData } = await query.order("created_at", { ascending: true })
      prizes = (giftsData || []) as Gift[]
    }

    return { success: true as const, data: { participant, campaign, prizes, cityId } }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false as const, error: message }
  }
}
