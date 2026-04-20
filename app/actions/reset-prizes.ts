"use server"

import { createServiceClient } from "@/lib/supabase/service"

export async function resetPrizes(campaignId?: string) {
  try {
    const supabase = createServiceClient()
    let query = supabase
      .from("gifts")
      .update({ current_winners: 0 })
      .not("id", "is", null)

    if (campaignId) {
      query = query.eq("campaign_id", campaignId)
    }

    const { error } = await query
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: msg }
  }
}
