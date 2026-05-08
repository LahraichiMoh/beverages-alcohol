"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Button } from "@/components/ui/button"
import { finalizeSpin, getSpinData } from "@/app/actions/finalize-spin"
import { Loader2 } from "lucide-react"
import type { Campaign } from "@/app/actions/campaigns"

const CAMPAIGN_CACHE_KEY = "spin_campaign_cache_v1"

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

export default function SpinPageClient({
  participantId,
  initialParticipant,
  initialCampaign,
  initialPrizes,
  initialCityId,
}: {
  participantId: string
  initialParticipant: Participant
  initialCampaign: Campaign | null
  initialPrizes: Prize[]
  initialCityId?: string
}) {
  const router = useRouter()
  const [participant, setParticipant] = useState<Participant>(initialParticipant)
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign)
  const [prizes, setPrizes] = useState<Prize[]>(initialPrizes)
  const [loading, setLoading] = useState(false)
  const [hasSpun, setHasSpun] = useState(!!initialParticipant.won)
  const [isAdmin, setIsAdmin] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; imageUrl?: string; color?: string; is_prize?: boolean } | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | undefined>(initialCityId)
  const [creatingReplay, setCreatingReplay] = useState(false)

  const cacheCampaign = (c: Campaign | null) => {
    try {
      if (!c) return
      window.sessionStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(c))
    } catch {}
  }

  const effectiveCampaignId = participant.campaign_id || campaign?.id || null

  useEffect(() => {
    const supabase = createClient()
    const loadAdmin = async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) {
        setIsAdmin(false)
        return
      }
      const { data: adminRow } = await supabase.from("admins").select("id").eq("id", auth.user.id).maybeSingle()
      setIsAdmin(!!adminRow)
    }
    loadAdmin()
  }, [])

  useEffect(() => {
    const maybeRedirectToFreshSpin = async () => {
      const supabase = createClient()

      if (participant.won) {
        setLoading(true)
        try {
          const baseCode = String(participant.code ?? "").trim()
          const insertBase: any = {
            name: participant.name,
            code: baseCode,
            city: participant.city,
            city_id: participant.city_id ?? null,
            venue_id: participant.venue_id ?? null,
            venue_type: participant.venue_type ?? null,
            agreed_to_terms: participant.agreed_to_terms ?? true,
            won: false,
            prize_id: null,
            campaign_id: participant.campaign_id ?? campaign?.id ?? null,
          }

          const firstId = crypto.randomUUID()
          const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
          if (!first.error) {
            cacheCampaign(campaign)
            router.replace(`/spin/${firstId}`)
            return
          }

          const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
          if (!isDup) throw first.error

          const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
          const secondId = crypto.randomUUID()
          const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
          if (second.error) throw second.error

          cacheCampaign(campaign)
          router.replace(`/spin/${secondId}`)
          return
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
          setSpinError(msg)
        } finally {
          setLoading(false)
        }
      }

      const replayStartedAt = campaign?.theme?.replayStartedAt as string | undefined
      const participantCreatedAt = participant.created_at as string | undefined
      if (replayStartedAt && participantCreatedAt) {
        const participantTs = new Date(participantCreatedAt).getTime()
        const replayTs = new Date(replayStartedAt).getTime()
        if (Number.isFinite(participantTs) && Number.isFinite(replayTs) && participantTs < replayTs) {
          setLoading(true)
          try {
            const baseCode = String(participant.code ?? "").trim()
            const insertBase: any = {
              name: participant.name,
              code: baseCode,
              city: participant.city,
              city_id: participant.city_id ?? null,
              venue_id: participant.venue_id ?? null,
              venue_type: participant.venue_type ?? null,
              agreed_to_terms: participant.agreed_to_terms ?? true,
              won: false,
              prize_id: null,
              campaign_id: participant.campaign_id ?? campaign?.id ?? null,
            }

            const firstId = crypto.randomUUID()
            const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
            if (!first.error) {
              cacheCampaign(campaign)
              router.replace(`/spin/${firstId}`)
              return
            }

            const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
            if (!isDup) throw first.error

            const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
            const secondId = crypto.randomUUID()
            const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
            if (second.error) throw second.error

            cacheCampaign(campaign)
            router.replace(`/spin/${secondId}`)
            return
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
            setSpinError(msg)
          } finally {
            setLoading(false)
          }
        }
      }
    }

    maybeRedirectToFreshSpin()
  }, [campaign?.id, campaign?.theme?.replayStartedAt, participant, router])

  useEffect(() => {
    const sync = async () => {
      const spinData = await getSpinData(participantId)
      if (!spinData.success || !spinData.data) return
      setParticipant(spinData.data.participant as any)
      setCampaign(spinData.data.campaign as any)
      setPrizes((spinData.data.prizes as any) || [])
      setCityId(spinData.data.cityId)
      setHasSpun(!!(spinData.data.participant as any)?.won)
    }
    sync()
  }, [participantId])

  useEffect(() => {
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts" }, (payload) => {
        const newGift = payload.new as unknown as Prize
        if (effectiveCampaignId && newGift.campaign_id !== effectiveCampaignId) return
        if (!effectiveCampaignId && newGift.campaign_id) return

        setPrizes((prev) => {
          if (prev.find((p) => p.id === newGift.id)) return prev
          return [...prev, newGift]
        })
        scheduleRefresh()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gifts" }, (payload) => {
        const updated = payload.new as unknown as Prize
        setPrizes((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
        scheduleRefresh()
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "gifts" }, (payload) => {
        const oldId = (payload.old as { id: string }).id
        setPrizes((prev) => prev.filter((p) => p.id !== oldId))
        scheduleRefresh()
      })
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [effectiveCampaignId, participantId])

  const wheelPrizes = useMemo(
    () =>
      prizes.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url,
        color: p.color,
        available: p.available !== undefined ? p.available : p.current_winners < p.max_winners,
        is_prize: p.is_prize,
      })),
    [prizes],
  )

  const handleSpinComplete = async (selectedPrizeId: string) => {
    try {
      setSpinError(null)
      const selectedPrize = prizes.find((p) => p.id === selectedPrizeId)

      const result = await finalizeSpin(participantId, selectedPrizeId, cityId, isAdmin)
      if (!result.success) {
        if (
          result.error &&
          (result.error.includes("limit reached") ||
            result.error.includes("Stock épuisé") ||
            result.error.includes("La période de participation") ||
            result.error.includes("The guidance period"))
        ) {
          if (result.error === "La période de participation est terminée pour aujourd'hui.") {
            setSpinError("La période de participation est terminée pour aujourd'hui.")
          } else {
            setSpinError("Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer.")
          }
          return
        }
        throw new Error(result.error || "Failed to finalize spin")
      }

      if (selectedPrize) {
        setPrizes((prev) =>
          prev.map((p) =>
            p.id === selectedPrizeId ? { ...p, current_winners: Math.min(p.current_winners + 1, p.max_winners) } : p,
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
      setSpinError("Une erreur est survenue. Veuillez réessayer.")
    }
  }

  const handleReplay = async () => {
    if (creatingReplay) return
    setSpinError(null)
    setCreatingReplay(true)
    try {
      cacheCampaign(campaign)
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
        campaign_id: participant.campaign_id ?? campaign?.id ?? null,
      }

      const firstId = crypto.randomUUID()
      const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
      if (!first.error) {
        setCreatingReplay(false)
        setHasSpun(false)
        setResultPrize(null)
        cacheCampaign(campaign)
        router.replace(`/spin/${firstId}`)
        return
      }

      const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
      if (!isDup) throw first.error

      const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      const secondId = crypto.randomUUID()
      const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
      if (second.error) throw second.error

      setCreatingReplay(false)
      setHasSpun(false)
      setResultPrize(null)
      cacheCampaign(campaign)
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
      </main>
    )
  }

  const bgUrl = campaign?.theme?.backgroundUrl || "/flag-back.jpg"

  return (
    <main
      className="min-h-screen relative overflow-hidden bg-black"
      style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {}}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/5 pointer-events-none" />
      <div className="relative z-10 min-h-screen flex flex-col justify-center">
        <section className="w-full flex flex-col items-center justify-center px-6 md:px-12">
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            <SpinnerWheel
              participantName={participant.name}
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
        </section>
      </div>
    </main>
  )
}
