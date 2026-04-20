"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { submitParticipation } from "@/app/actions/submit-participation"
import { createClient } from "@/lib/supabase/client"
import { logoutCampaignAccess } from "@/app/actions/campaigns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CampaignParticipationFormProps {
  campaignId: string
  campaignName: string
  theme: {
    primaryColor?: string
    secondaryColor?: string
    logoUrl?: string
    backgroundUrl?: string
  }
}

type CityRow = { id: string; name: string }
type VenueRow = { id: string; name: string; type?: string }

export function CampaignParticipationForm({ campaignId, campaignName, theme }: CampaignParticipationFormProps) {
  const [cities, setCities] = useState<CityRow[]>([])
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [cityId, setCityId] = useState("")
  const [venueId, setVenueId] = useState("")
  const [animatorName, setAnimatorName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadCities = async () => {
      setLoadingCities(true)
      setError("")
      try {
        const supabase = createClient()
        const { data, error: citiesError } = await supabase
          .from("cities")
          .select("id, name")
          .order("name")

        if (citiesError) throw citiesError
        setCities((data || []) as CityRow[])
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur lors du chargement des villes"
        setError(msg)
      } finally {
        setLoadingCities(false)
      }
    }

    loadCities()
  }, [])

  useEffect(() => {
    const loadVenues = async () => {
      setVenues([])
      setVenueId("")
      if (!cityId) return
      setLoadingVenues(true)
      setError("")
      try {
        const supabase = createClient()
        const { data, error: venuesError } = await supabase
          .from("venues")
          .select("id, name, type")
          .eq("city_id", cityId)
          .eq("campaign_id", campaignId)
          .order("name")

        if (venuesError) throw venuesError
        setVenues((data || []) as VenueRow[])
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur lors du chargement des établissements"
        setError(msg)
      } finally {
        setLoadingVenues(false)
      }
    }

    loadVenues()
  }, [cityId])

  const selectedCity = cities.find((c) => c.id === cityId) || null
  const selectedVenue = venues.find((v) => v.id === venueId) || null
  const canConfirm = !!(selectedCity && selectedVenue && animatorName.trim())

  const handleRequestConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!canConfirm) {
      setError("Veuillez remplir tous les champs.")
      return
    }
    setConfirmOpen(true)
  }

  const handleLogout = async () => {
    await logoutCampaignAccess()
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm shadow-xl">
      <CardHeader className="text-center">
        {theme.logoUrl && (
            <div className="flex justify-center mb-4">
                <img src={theme.logoUrl} alt="Logo" className="h-20 object-contain" />
            </div>
        )}
        <CardTitle className="text-2xl" style={{ color: theme.primaryColor }}>{campaignName}</CardTitle>
        {/* <CardDescription className="flex flex-col items-center gap-2">
          <Button 
            variant="link" 
            size="sm" 
            className="text-xs text-muted-foreground h-auto p-0 hover:text-red-600"
            onClick={handleLogout}
          >
            (Changer de campagne)
          </Button>
        </CardDescription> */}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRequestConfirm} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <select
              id="city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              disabled={loadingCities}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">{loadingCities ? "Chargement..." : "Choisir une ville"}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue">Poste / Point de vente</Label>
            <select
              id="venue"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              disabled={!cityId || loadingVenues}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">
                {!cityId
                  ? "Choisir d'abord une ville"
                  : loadingVenues
                    ? "Chargement..."
                    : "Choisir un point de vente"}
              </option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="animator">Nom d&apos;animateur</Label>
            <Input 
              id="animator" 
              value={animatorName} 
              onChange={(e) => setAnimatorName(e.target.value)} 
              placeholder="Nom complet"
              required 
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button 
            type="submit" 
            className="w-full text-lg font-bold py-6"
            style={{ backgroundColor: theme.primaryColor || 'black', color: 'white' }}
            disabled={loading || !canConfirm}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Valider"}
          </Button>
        </form>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="bg-white dark:bg-slate-900 sm:max-w-xl rounded-2xl p-8 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                Vérification
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Vérifiez les informations avant de continuer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Ville</span>
                <span className="font-semibold text-right">{selectedCity?.name || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Point de vente</span>
                <span className="font-semibold text-right">
                  {selectedVenue ? selectedVenue.name : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Animateur</span>
                <span className="font-semibold text-right">{animatorName || "-"}</span>
              </div>
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-3">
              <AlertDialogCancel
                disabled={loading}
                className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                Modifier
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={loading || !canConfirm}
                className="bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/20 dark:focus-visible:ring-emerald-500/30"
                onClick={async (e) => {
                  e.preventDefault()
                  if (!selectedCity || !selectedVenue) return
                  setLoading(true)
                  setError("")
                  try {
                    const res = await submitParticipation(
                      animatorName,
                      selectedVenue.name,
                      selectedCity.name,
                      campaignId,
                      {
                        city_id: selectedCity.id,
                        venue_id: selectedVenue.id,
                        venue_type: selectedVenue.type,
                      },
                    )
                    if (res.success && res.participantId) {
                      setConfirmOpen(false)
                      router.push(`/spin/${res.participantId}`)
                      return
                    }
                    setError(res.error || "Erreur lors de l'inscription")
                    setConfirmOpen(false)
                  } catch (err) {
                    setError("Une erreur s'est produite")
                    setConfirmOpen(false)
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                {loading ? "..." : "Confirmer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

export default CampaignParticipationForm
