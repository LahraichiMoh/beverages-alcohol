"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentCity } from "@/app/actions/city-auth"
// import { getAvailablePrizes } from "@/app/actions/campaigns"

export async function submitParticipation(
  name: string,
  code: string,
  city: string,
  campaignId?: string,
  meta?: {
    city_id?: string
    venue_id?: string
    venue_type?: string
  },
) {
  try {
    const supabase = createServiceClient()

    // Check for authenticated city and enforce it
    const authCity = await getCurrentCity()
    const finalCity = authCity ? authCity.name : city

    // Validate inputs
    if (!name?.trim() || !code?.trim() || !finalCity?.trim()) {
      return { success: false, error: "Veuillez remplir tous les champs" }
    }

    // Check campaign availability if campaignId is present
    if (campaignId) {
      let cityId = authCity?.id
      // If no auth city, try to resolve city ID from name to check limits
      if (!cityId && finalCity) {
        const { data: cityRows } = await supabase.from("cities").select("id").ilike("name", finalCity).limit(1)
        if (cityRows && cityRows.length > 0) cityId = cityRows[0].id
      }

      // const availability = await getAvailablePrizes(campaignId, cityId, finalCity)
      
      // if (availability.success && availability.data) {
      //   const hasAvailable = availability.data.some((g: any) => g.available)
      //   if (!hasAvailable) {
      //     return { success: false, error: "La période de participation est terminée pour aujourd'hui." }
      //   }
      // }
    }

    const normalizedCode = code.trim().toUpperCase()

  // Insert new participant
    const insertData: any = {
      name: name.trim(),
      code: normalizedCode,
      city: finalCity.trim(),
      agreed_to_terms: true,
      won: false,
    }

    if (campaignId) {
      insertData.campaign_id = campaignId
    }

    const insertPayload = meta ? { ...insertData, ...meta } : insertData

    let data: any | null = null
    let insertError: any | null = null

    {
      const res = await supabase.from("participants").insert(insertPayload).select().single()
      data = res.data
      insertError = res.error
    }

    if (insertError && meta && typeof insertError.message === "string" && insertError.message.includes("does not exist")) {
      const res = await supabase.from("participants").insert(insertData).select().single()
      data = res.data
      insertError = res.error
    }

    if (insertError) {
      console.error("[v0] Insert error:", insertError)
      return { success: false, error: "Erreur lors de l'enregistrement. Veuillez réessayer." }
    }

    if (!data) {
      return { success: false, error: "Erreur lors de la création du participant" }
    }

    return { success: true, participantId: data.id }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Une erreur inattendue s'est produite"
    console.error("[v0] Server action error:", errorMessage)
    return { success: false, error: errorMessage }
  }
}
