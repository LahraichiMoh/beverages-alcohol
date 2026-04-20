"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCities, type City } from "@/app/actions/manage-cities"
import { getCampaignCityLimits, upsertCampaignCityLimit, type CampaignCityLimit } from "@/app/actions/campaign-limits"
import { Loader2, Save } from "lucide-react"

interface Campaign {
  id: string
  name: string
}

interface CampaignLimitsEditorProps {
  preselectedCampaignId?: string
}

export function CampaignLimitsEditor({ preselectedCampaignId }: CampaignLimitsEditorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(preselectedCampaignId || "")
  const [cities, setCities] = useState<City[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // cityId being saved

  // Load campaigns and cities
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      
      if (!preselectedCampaignId) {
        const { data: campaignsData } = await supabase.from("campaigns").select("id, name").order("name")
        if (campaignsData) setCampaigns(campaignsData)
      }

      const citiesRes = await getCities()
      if (citiesRes.success && citiesRes.data) {
        setCities(citiesRes.data)
      }
      setLoading(false)
    }
    loadData()
  }, [preselectedCampaignId])

  useEffect(() => {
    if (preselectedCampaignId) {
        setSelectedCampaignId(preselectedCampaignId)
    }
  }, [preselectedCampaignId])

  // Load limits when campaign changes
  useEffect(() => {
    if (!selectedCampaignId) {
        setLimits({})
        return
    }
    const loadLimits = async () => {
      const res = await getCampaignCityLimits(selectedCampaignId)
      if (res.success && res.data) {
        const newLimits: Record<string, number> = {}
        res.data.forEach((l: CampaignCityLimit) => {
          newLimits[l.city_id] = l.max_winners
        })
        setLimits(newLimits)
      }
    }
    loadLimits()
  }, [selectedCampaignId])

  const handleSave = async (cityId: string, limit: number) => {
    if (!selectedCampaignId) return
    setSaving(cityId)
    await upsertCampaignCityLimit(selectedCampaignId, cityId, limit)
    // Update local state to ensure it reflects saved value
    setLimits(prev => ({ ...prev, [cityId]: limit }))
    setSaving(null)
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-amber-600" /></div>

  return (
    <div className="space-y-6">
      <Card className="border-2 border-amber-200/60 shadow-md rounded-2xl bg-gradient-to-b from-white to-amber-50/40">
        <CardHeader>
          <CardTitle className="text-xl text-amber-800">
             {preselectedCampaignId ? "Limites par ville" : "Limites par campagne et par ville"}
          </CardTitle>
        </CardHeader>
        <CardContent>
            {!preselectedCampaignId && (
                <div className="mb-6 space-y-2">
                    <Label htmlFor="campaign-select">Sélectionner une campagne</Label>
                    <select
                        id="campaign-select"
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                    >
                        <option value="">-- Choisir une campagne --</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {selectedCampaignId ? (
                <div className="space-y-4">
                    {cities.map(city => (
                        <div key={city.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-white/80 shadow-sm gap-4">
                            <span className="font-semibold text-lg text-gray-800">{city.name}</span>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <Label className="whitespace-nowrap text-gray-600">Max gagnants :</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    className="w-24 h-10 text-lg"
                                    value={limits[city.id] ?? 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value)
                                        setLimits(prev => ({ ...prev, [city.id]: isNaN(val) ? 0 : val }))
                                    }}
                                />
                                <Button 
                                    size="sm" 
                                    className="h-10 w-10 p-0"
                                    variant={saving === city.id ? "ghost" : "default"}
                                    onClick={() => handleSave(city.id, limits[city.id] ?? 0)}
                                    disabled={saving === city.id}
                                >
                                    {saving === city.id ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    ))}
                    {cities.length === 0 && <p className="text-center text-gray-500 py-4">Aucune ville configurée.</p>}
                </div>
            ) : (
                <p className="text-center text-gray-500 py-8">Veuillez sélectionner une campagne pour configurer les limites.</p>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
