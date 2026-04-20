"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Button } from "@/components/ui/button"
import { finalizeSpin, getSpinData } from "@/app/actions/finalize-spin"
import { Loader2 } from "lucide-react"
import { type Campaign } from "@/app/actions/campaigns"
import { ParticipantForm, type ParticipantDetails } from "@/components/participant-form"
import { toast } from "sonner"

interface Participant {
  id: string
  name: string
  code: string
  city: string
  city_id?: string | null
  venue_id?: string | null
  venue_type?: string | null
  won: boolean
  prize_id: string | null
  campaign_id?: string
  created_at?: string
  agreed_to_terms?: boolean
}

interface Prize {
  id: string
  name: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
  campaign_id?: string
  available?: boolean
  is_prize: boolean
}

export default function SpinPage() {
  const params = useParams()
  const router = useRouter()
  const participantId = params.id as string
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSpun, setHasSpun] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; imageUrl?: string; color?: string; is_prize?: boolean } | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | undefined>(undefined)
  const [creatingReplay, setCreatingReplay] = useState(false)
  const [showParticipantForm, setShowParticipantForm] = useState(true)
  const [participantDetails, setParticipantDetails] = useState<ParticipantDetails | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()

        let admin = false
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (!authError && auth.user) {
          const { data: adminRow } = await supabase
            .from("admins")
            .select("id")
            .eq("id", auth.user.id)
            .maybeSingle()
          admin = !!adminRow
        }
        setIsAdmin(admin)

        const spinData = await getSpinData(participantId)
        if (!spinData.success || !spinData.data) throw new Error(spinData.error || "Failed to load spin data")
        const participantData = spinData.data.participant as any
        const campaignData = spinData.data.campaign as any
        
        // Set campaign early so the loading screen can display the logo and background
        setCampaign(campaignData)
        
        if (participantData.won) {
          try {
            const baseCode = String(participantData.code ?? "").trim()
            const insertBase: any = {
              name: participantData.name,
              code: baseCode,
              city: participantData.city,
              city_id: participantData.city_id ?? null,
              venue_id: participantData.venue_id ?? null,
              venue_type: participantData.venue_type ?? null,
              agreed_to_terms: participantData.agreed_to_terms ?? true,
              won: false,
              prize_id: null,
              campaign_id: participantData.campaign_id ?? null,
            }

            const firstId = crypto.randomUUID()
            const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
            if (!first.error) {
              router.replace(`/spin/${firstId}`)
              return
            }

            const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
            if (!isDup) throw first.error

            const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
            const secondId = crypto.randomUUID()
            const second = await supabase
              .from("participants")
              .insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
            if (second.error) throw second.error
            router.replace(`/spin/${secondId}`)
            return
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
            setSpinError(msg)
          }
        }

        const replayStartedAt = campaignData?.theme?.replayStartedAt as string | undefined
        const participantCreatedAt = participantData.created_at as string | undefined
        if (replayStartedAt && participantCreatedAt) {
          const participantTs = new Date(participantCreatedAt).getTime()
          const replayTs = new Date(replayStartedAt).getTime()
          if (Number.isFinite(participantTs) && Number.isFinite(replayTs) && participantTs < replayTs) {
            try {
              const supabase = createClient()
              const baseCode = String(participantData.code ?? "").trim()
              const insertBase: any = {
                name: participantData.name,
                code: baseCode,
                city: participantData.city,
                city_id: participantData.city_id ?? null,
                venue_id: participantData.venue_id ?? null,
                venue_type: participantData.venue_type ?? null,
                agreed_to_terms: participantData.agreed_to_terms ?? true,
                won: false,
                prize_id: null,
                campaign_id: participantData.campaign_id ?? null,
              }

              const firstId = crypto.randomUUID()
              const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
              if (!first.error) {
                router.replace(`/spin/${firstId}`)
                return
              }

              const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
              if (!isDup) throw first.error

              const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
              const secondId = crypto.randomUUID()
              const second = await supabase
                .from("participants")
                .insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
              if (second.error) throw second.error

              router.replace(`/spin/${secondId}`)
              return
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
              setSpinError(msg)
            }
          }
        }

        setParticipant(participantData)
        setHasSpun(!!participantData.won)

        setCampaign(campaignData)
        setPrizes((spinData.data.prizes as any) || [])
        setCityId(spinData.data.cityId)

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()
  }, [participantId, router])

  useEffect(() => {
    if (!participant) return

    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let refreshInFlight = false

    const refreshPrizesFromServer = async () => {
      if (refreshInFlight) return
      refreshInFlight = true
      try {
        const spinData = await getSpinData(participantId)
        if (spinData.success && spinData.data) {
          setPrizes((spinData.data.prizes as any) || [])
          setCampaign(spinData.data.campaign as any)
          setCityId(spinData.data.cityId)
        }
      } finally {
        refreshInFlight = false
      }
    }

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshPrizesFromServer()
      }, 250)
    }

    const channel = supabase
      .channel("gifts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gifts" },
        (payload) => {
          const newGift = payload.new as unknown as Prize
          // Filter by campaign
          if (participant.campaign_id && newGift.campaign_id !== participant.campaign_id) return
          if (!participant.campaign_id && newGift.campaign_id) return // Don't show campaign gifts to legacy participants?
          
          setPrizes((prev) => {
            if (prev.find((p) => p.id === newGift.id)) return prev
            return [...prev, newGift]
          })
          scheduleRefresh()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gifts" },
        (payload) => {
          const updated = payload.new as unknown as Prize
          setPrizes((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
          scheduleRefresh()
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "gifts" },
        (payload) => {
          const oldId = (payload.old as { id: string }).id
          setPrizes((prev) => prev.filter((p) => p.id !== oldId))
          scheduleRefresh()
        }
      )
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [participant, participantId])

  const handleSpinComplete = async (selectedPrizeId: string) => {
    try {
      setSpinError(null)
      const selectedPrize = prizes.find((p) => p.id === selectedPrizeId)

      // Save participant details to public.participant_details
      if (participantDetails) {
        const supabase = createClient()
        const { error: detailError } = await supabase.from("participant_details").insert({
          participant_id: participantId,
          full_name: participantDetails.fullName,
          phone: participantDetails.phone,
          gender: participantDetails.gender,
          age_range: participantDetails.ageRange,
          address: participantDetails.address,
          usual_product: participantDetails.usualProduct,
          campaign_id: participant?.campaign_id,
        })
        if (detailError) {
          console.error("Error saving participant details:", detailError)
          // We continue even if detail saving fails, but log it
        }
      }

      const result = await finalizeSpin(participantId, selectedPrizeId, cityId, isAdmin)
      if (!result.success) {
        // If limit reached, show friendly message
        if (result.error && (result.error.includes("limit reached") || result.error.includes("Stock épuisé") || result.error.includes("La période de participation") || result.error.includes("The guidance period"))) {
             if (result.error === "La période de participation est terminée pour aujourd'hui." || result.error === "La période de participation est terminée pour aujourd'hui.") {
                 setSpinError("La période de participation est terminée pour aujourd'hui.")
             } else {
                 setSpinError("Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer.")
             }
             return
        }
        throw new Error(result.error || "Failed to finalize spin")
      }

      // Increment winner count for the prize
      if (selectedPrize) {
        setPrizes((prev) =>
          prev.map((p) =>
            p.id === selectedPrizeId
              ? { ...p, current_winners: Math.min(p.current_winners + 1, p.max_winners) }
              : p,
          ),
        )
      }

      const mapped = selectedPrize
        ? {
            id: selectedPrize.id,
            name: selectedPrize.name,
            imageUrl: selectedPrize.image_url,
            color: selectedPrize.color,
            is_prize: selectedPrize.is_prize,
          }
        : null
      setResultPrize(mapped)
      setHasSpun(true)
    } catch (error) {
      console.error("Error updating result:", error)
      setSpinError("Une erreur est survenue. Veuillez réessayer.")
    }
  }

  const handleReplay = async () => {
    if (!participant || creatingReplay) return
    setSpinError(null)
    setCreatingReplay(true)
    try {
      const supabase = createClient()
      const baseCode = String(participant.code ?? "").trim()
      const insertBase: any = {
        name: participant.name,
        code: baseCode,
        city: participant.city,
        city_id: participant.city_id ?? null,
        venue_id: participant.venue_id ?? null,
        venue_type: participant.venue_type ?? null,
        agreed_to_terms: true,
        won: false,
        prize_id: null,
        campaign_id: participant.campaign_id ?? null,
      }

      const firstId = crypto.randomUUID()
      const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
      if (!first.error) {
        setCreatingReplay(false)
        setShowParticipantForm(true)
        setParticipantDetails(null)
        setHasSpun(false)
        setResultPrize(null)
        router.replace(`/spin/${firstId}`)
        return
      }

      const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
      if (!isDup) throw first.error

      const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      const secondId = crypto.randomUUID()
      const second = await supabase
        .from("participants")
        .insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
      if (second.error) throw second.error

      setCreatingReplay(false)
      setShowParticipantForm(true)
      setParticipantDetails(null)
      setHasSpun(false)
      setResultPrize(null)
      router.replace(`/spin/${secondId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
      setSpinError(msg)
      setCreatingReplay(false)
    }
  }

  if (loading) {
    const bgUrl = campaign?.theme?.backgroundUrl || "/flag-back.jpg"
    return (
      <main 
        className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black"
        style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col items-center gap-10">
          <div className="relative">
            <div className="w-36 h-36 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-700">
               {/* Animated Logo Placeholder */}
               <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center shadow-xl relative overflow-hidden group">
                  {campaign?.theme?.logoUrl ? (
                    <img src={campaign.theme.logoUrl} alt="Logo" className="w-full h-full object-contain p-2 relative z-10" />
                  ) : (
                    <img src="/orange.jpg" alt="Logo" className="w-full h-full object-contain p-2 relative z-10" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine pointer-events-none" />
               </div>
            </div>
            {/* Decorative spinning elements */}
            <div className="absolute inset-[-15px] border border-orange-500/30 rounded-full animate-[spin_15s_linear_infinite]" />
            <div className="absolute inset-[-25px] border border-white/10 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-white font-black tracking-[0.4em] uppercase text-xs opacity-50">Préparez-vous</p>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
                <p className="text-white font-black tracking-[0.2em] uppercase text-lg">Chargement</p>
              </div>
            </div>
            <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <div className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 w-full animate-[loading_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </main>
    )
  }

  if (!participant) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6">
        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 shadow-xl bg-white p-8 text-center">
            <p className="text-2xl md:text-3xl font-extrabold text-slate-900">Une erreur s’est produite</p>
            <p className="text-md md:text-lg font-medium text-slate-600 mt-2">Impossible de charger les données du tirage.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg px-5 py-3"
            >
              Réessayer
            </button>
          </div>
        </section>
      </main>
    )
  }

  const bgUrl = campaign?.theme?.backgroundUrl || process.env.NEXT_PUBLIC_SPIN_BACKGROUND_URL || "/flag-back.jpg"
  
  const wheelPrizes = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.image_url,
    color: p.color,
    available: p.available !== undefined ? p.available : p.current_winners < p.max_winners,
    is_prize: p.is_prize,
  }))

  const handleParticipantSubmit = (details: ParticipantDetails) => {
    setParticipantDetails(details)
    setShowParticipantForm(false)
  }

  return (
      <main
        className="min-h-screen relative overflow-hidden bg-black"
        style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {}}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/5 pointer-events-none" />
        <div className="relative z-10 min-h-screen flex flex-col justify-center">
          <section className="w-full flex flex-col items-center justify-center px-6 md:px-12">
            {showParticipantForm ? (
              <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
                <ParticipantForm 
                  campaignName={campaign?.name || "Orange Money"} 
                  primaryColor={campaign?.theme?.primaryColor}
                  logoUrl={campaign?.theme?.logoUrl}
                  onSubmit={handleParticipantSubmit}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                <SpinnerWheel
                  participantName={participantDetails?.fullName || participant.name}
                  prizes={wheelPrizes}
                  onSpinComplete={handleSpinComplete}
                  hasSpun={hasSpun}
                  resultPrize={resultPrize}
                  spinError={spinError}
                  pointerSide="top"
                  spinLabel="Tournez pour la Gloire!"
                  theme="default"
                  customColors={{
                    primary: campaign?.theme?.primaryColor,
                    secondary: campaign?.theme?.secondaryColor,
                  }}
                  campaignTheme={{
                    backgroundUrl: campaign?.theme?.backgroundUrl,
                  }}
                />

                {hasSpun && (
                  <Button
                    className="mt-12 w-full max-w-xs shadow-xl border-2 border-white/30 text-lg font-bold py-8 transition-all hover:scale-105 active:scale-95"
                    style={campaign?.theme?.primaryColor ? { backgroundColor: campaign.theme.primaryColor, color: "white" } : { background: "linear-gradient(to right, #f97316, #ed8936)" }}
                    onClick={handleReplay}
                    disabled={creatingReplay}
                  >
                    {creatingReplay ? <Loader2 className="h-5 w-5 animate-spin" /> : "Nouveau tour"}
                  </Button>
                )}
              </div>
            )}
        </section>
      </div>
    </main>
  )
}
