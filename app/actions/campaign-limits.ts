"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export interface CampaignCityLimit {
  id: string
  campaign_id: string
  city_id: string
  max_winners: number
}

export async function getCampaignCityLimits(campaignId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("campaign_city_limits")
    .select("*")
    .eq("campaign_id", campaignId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data as CampaignCityLimit[] }
}

export async function upsertCampaignCityLimit(campaignId: string, cityId: string, maxWinners: number) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from("campaign_city_limits")
    .upsert({ campaign_id: campaignId, city_id: cityId, max_winners: maxWinners }, { onConflict: "campaign_id, city_id" })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }
  
  revalidatePath("/admin/dashboard")
  return { success: true, data }
}
