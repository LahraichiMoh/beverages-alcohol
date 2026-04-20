"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getCities, type City } from "@/app/actions/manage-cities"
import {
  getGiftCityLimits,
  getGiftVenueLimits,
  getVenuesForLimits,
  upsertGiftCityLimit,
  upsertGiftVenueLimit,
  type VenueForLimit,
} from "@/app/actions/gift-limits"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

interface GiftLimitManagerProps {
  giftId: string
  giftName: string
  campaignId?: string
  scope?: "city" | "venue"
  onClose?: () => void
  onLimitUpdated?: () => void
}

export function GiftLimitManager({ giftId, giftName, campaignId, scope = "city", onClose, onLimitUpdated }: GiftLimitManagerProps) {
  const [cities, setCities] = useState<City[]>([])
  const [venues, setVenues] = useState<VenueForLimit[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [giftId, scope, campaignId])

  const loadData = async () => {
    setLoading(true)
    if (scope === "venue") {
      if (!campaignId) {
        setVenues([])
        setLimits({})
        setLoading(false)
        return
      }

      const [venuesRes, limitsRes] = await Promise.all([getVenuesForLimits(campaignId), getGiftVenueLimits(giftId)])

      const venueRows = venuesRes.success && venuesRes.data ? venuesRes.data : []
      setVenues(venueRows)

      const newLimits: Record<string, number> = {}
      venueRows.forEach((v) => {
        newLimits[v.id] = 0
      })
      if (limitsRes.success && limitsRes.data) {
        limitsRes.data.forEach((l) => {
          newLimits[l.venue_id] = l.max_winners
        })
      }
      setLimits(newLimits)
    } else {
      const [citiesRes, limitsRes] = await Promise.all([getCities(), getGiftCityLimits(giftId)])

      const cityRows = citiesRes.success && citiesRes.data ? citiesRes.data : []
      setCities(cityRows)

      const newLimits: Record<string, number> = {}
      cityRows.forEach((c) => {
        newLimits[c.id] = 0
      })
      if (limitsRes.success && limitsRes.data) {
        limitsRes.data.forEach((l) => {
          newLimits[l.city_id] = l.max_winners
        })
      }
      setLimits(newLimits)
    }
    setLoading(false)
  }

  const handleSave = async (itemId: string, limit: number) => {
    setSaving(itemId)
    const res =
      scope === "venue"
        ? await upsertGiftVenueLimit(giftId, itemId, limit)
        : await upsertGiftCityLimit(giftId, itemId, limit)
    setSaving(null)

    if (!res.success) {
      toast.error("Erreur lors de l'enregistrement")
      return
    }

    setLimits((prev) => ({ ...prev, [itemId]: limit }))
    if (onLimitUpdated) onLimitUpdated()
    toast.success("Limite enregistrée")
  }
  
  const handleSaveAll = async () => {
    setBulkSaving(true)
    let hasError = false
    
    if (scope === "venue") {
      for (const venue of venues) {
        const val = limits[venue.id] ?? 0
        const res = await upsertGiftVenueLimit(giftId, venue.id, val)
        if (!res.success) {
          hasError = true
          toast.error(`Erreur pour ${venue.name}`)
        }
      }
    } else {
      for (const city of cities) {
        const val = limits[city.id] ?? 0
        const res = await upsertGiftCityLimit(giftId, city.id, val)
        if (!res.success) {
          hasError = true
          toast.error(`Erreur pour ${city.name}`)
        }
      }
    }
    setBulkSaving(false)
    if (onLimitUpdated) onLimitUpdated()
    
    if (!hasError) {
      toast.success("Toutes les limites ont été enregistrées")
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-amber-600" /></div>
  }

  return (
    <Card className="border-amber-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">
          {scope === "venue" ? "Stock par établissement" : "Limites par ville"} : {giftName}
        </CardTitle>
        <CardDescription>
          {scope === "venue"
            ? "Définissez le stock maximum de ce cadeau pour chaque restau / bar. Si vide, le cadeau n'est pas disponible pour cet établissement."
            : "Définissez le nombre maximum de gagnants pour ce cadeau dans chaque ville."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={handleSaveAll}
            disabled={bulkSaving}
          >
            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enregistrer toutes les limites
          </Button>
        </div>
        {scope === "venue"
          ? venues.map((venue) => (
              <div key={venue.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-700">
                    {venue.name}{venue.type ? ` (${venue.type})` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {venue.city_name || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-slate-500 uppercase">Max</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 text-right"
                    value={limits[venue.id] ?? 0}
                    onChange={(e) => {
                      const raw = e.target.value
                      const next = raw === "" ? 0 : Math.max(0, Number(raw) || 0)
                      setLimits((prev) => ({ ...prev, [venue.id]: next }))
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving === venue.id}
                    onClick={() => {
                      const val = limits[venue.id] ?? 0
                      handleSave(venue.id, val)
                    }}
                  >
                    {saving === venue.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))
          : cities.map((city) => (
              <div key={city.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <span className="font-medium text-slate-700">{city.name}</span>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-slate-500 uppercase">Max</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 text-right"
                    value={limits[city.id] ?? 0}
                    onChange={(e) => {
                      const raw = e.target.value
                      const next = raw === "" ? 0 : Math.max(0, Number(raw) || 0)
                      setLimits((prev) => ({ ...prev, [city.id]: next }))
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving === city.id}
                    onClick={() => {
                      const val = limits[city.id] ?? 0
                      handleSave(city.id, val)
                    }}
                  >
                    {saving === city.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
        {scope === "venue" ? (
          venues.length === 0 ? <p className="text-center text-slate-500 italic">Aucun établissement trouvé.</p> : null
        ) : cities.length === 0 ? (
          <p className="text-center text-slate-500 italic">Aucune ville trouvée.</p>
        ) : null}
        {onClose && (
            <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={onClose}>Fermer</Button>
            </div>
        )}
      </CardContent>
    </Card>
  )
}
