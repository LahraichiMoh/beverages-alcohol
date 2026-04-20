"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, Globe, Settings, Gift as GiftIcon, BarChart3, Palette, Save, Upload, ExternalLink, Users, Trophy, Shield } from "lucide-react"
import { toast } from "sonner"
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
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, resetAllCampaignGifts, type Campaign, type CampaignTheme } from "@/app/actions/campaigns"
import { CampaignGiftManager } from "@/components/campaign-gift-manager"
import { ParticipantList } from "@/components/participant-list"
import { CampaignStats } from "@/components/campaign-stats"
import { CampaignTeamManager } from "@/components/campaign-team-manager"
import { BrandLoader } from "@/components/brand-loader"
import { createClient } from "@/lib/supabase/client"

interface CampaignManagerProps {
  teamAccess?: {
    id: string
    username: string
    campaign_id: string
    permissions: {
      can_view_participants: boolean
      can_view_stats: boolean
      can_view_gifts: boolean
      can_edit_gifts: boolean
    }
    campaign_slug: string
    campaign_name: string
  }
}

export function CampaignManager({ teamAccess }: CampaignManagerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  
  // Auto-select campaign if team access is provided
  useEffect(() => {
    if (teamAccess && campaigns.length > 0) {
      const campaign = campaigns.find(c => c.id === teamAccess.campaign_id)
      if (campaign) {
        setEditingCampaign(campaign)
      }
    }
  }, [teamAccess, campaigns])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [locationCities, setLocationCities] = useState<Array<{ id: string; name: string }>>([])
  const [locationVenues, setLocationVenues] = useState<
    Array<{
      id: string
      name: string
      type?: string | null
      stock: number
      city_id: string
      city?: { id: string; name: string } | null
    }>
  >([])
  const [locationCityId, setLocationCityId] = useState("")
  const [newVenueName, setNewVenueName] = useState("")
  const [newVenueType, setNewVenueType] = useState<"restau" | "bar" | "point de vente">("bar")
  const [newVenueStock, setNewVenueStock] = useState("0")
  const [savingVenue, setSavingVenue] = useState(false)
  const [deleteVenueId, setDeleteVenueId] = useState<string | null>(null)
  
  // Create/Edit form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    accessUsername: "",
    accessPassword: "",
    isActive: true,
    primaryColor: "#7f1d1d",
    secondaryColor: "#facc15",
    logoUrl: "",
    backgroundUrl: "",
  })
  
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmResetAll, setConfirmResetAll] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCampaigns()
  }, [])

  useEffect(() => {
    if (!editingCampaign) return
    const supabase = createClient()
    const load = async () => {
      const { data: citiesData } = await supabase.from("cities").select("id, name").order("name")
      setLocationCities((citiesData || []) as any)

      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name, type, stock, city_id, campaign_id, city:cities ( id, name )")
        .eq("campaign_id", editingCampaign.id)
        .order("name")
      setLocationVenues((venuesData || []) as any)
    }
    load()
  }, [editingCampaign])

  const loadCampaigns = async () => {
    setLoading(true)
    const res = await getCampaigns()
    if (res.success && res.data) {
      setCampaigns(res.data)
    }
    setLoading(false)
  }

  const handleUpload = async (file: File, type: 'logo' | 'bg') => {
    const isLogo = type === 'logo'
    
    if (isLogo) setUploadingLogo(true)
    else setUploadingBg(true)

    const fd = new FormData()
    fd.append("file", file)
    fd.append("bucket", "campaign-assets")
    
    try {
      const res = await fetch("/api/upload-prize", { method: "POST", body: fd })
      const json = await res.json()
      if (json.success) {
        setFormData(prev => ({
          ...prev,
          [isLogo ? 'logoUrl' : 'backgroundUrl']: json.url
        }))
        toast.success("Image téléchargée avec succès")
      } else {
        toast.error("Erreur lors de l'upload: " + json.error)
      }
    } catch (e) {
      toast.error("Erreur lors de l'upload")
    } finally {
      if (isLogo) setUploadingLogo(false)
      else setUploadingBg(false)
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setFormData({
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description || "",
      accessUsername: campaign.access_username || "",
      accessPassword: "",
      isActive: campaign.is_active !== false,
      primaryColor: campaign.theme.primaryColor || "#7f1d1d",
      secondaryColor: campaign.theme.secondaryColor || "#facc15",
      logoUrl: campaign.theme.logoUrl || "",
      backgroundUrl: campaign.theme.backgroundUrl || "",
    })
  }

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const res = await deleteCampaign(deleteId)
    if (res.success) {
      setCampaigns(campaigns.filter(c => c.id !== deleteId))
      if (editingCampaign?.id === deleteId) setEditingCampaign(null)
      toast.success("Campagne supprimée")
    } else {
      toast.error("Erreur: " + res.error)
    }
    setDeleteId(null)
  }

  const handleResetAll = () => {
    setConfirmResetAll(true)
  }

  const performResetAll = async () => {
    if (!editingCampaign || resettingAll) return
    setResettingAll(true)
    const res = await resetAllCampaignGifts(editingCampaign.id)
    if (res.success) {
      toast.success("Nouvelle session démarrée. Vous pouvez rejouer avec le même stock.")
    } else {
      toast.error("Erreur: " + (res.error || "Impossible de réinitialiser"))
    }
    setResettingAll(false)
    setConfirmResetAll(false)
  }

  const handleSave = async () => {
    const theme: CampaignTheme = {
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      logoUrl: formData.logoUrl,
      backgroundUrl: formData.backgroundUrl,
    }

    if (editingCampaign) {
      const updatePayload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme,
        is_active: formData.isActive,
        access_username: formData.accessUsername,
      }
      if (formData.accessPassword.trim()) {
        updatePayload.access_password = formData.accessPassword
      }
      const res = await updateCampaign(editingCampaign.id, updatePayload)
      if (res.success && res.data) {
        setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? res.data! : c))
        setEditingCampaign(res.data) // Update current editing
        setFormData((prev) => ({ ...prev, accessPassword: "" }))
        toast.success("Campagne mise à jour")
      } else {
        toast.error("Erreur: " + (res.error || "Impossible de mettre à jour la campagne"))
      }
    } else {
      const res = await createCampaign({
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme,
        is_active: formData.isActive,
        access_username: formData.accessUsername,
        access_password: formData.accessPassword,
      })
      if (res.success && res.data) {
        setCampaigns([res.data, ...campaigns])
        setShowCreateForm(false)
        setFormData({
            name: "",
            slug: "",
            description: "",
            accessUsername: "",
            accessPassword: "",
            isActive: true,
            primaryColor: "#7f1d1d",
            secondaryColor: "#facc15",
            logoUrl: "",
            backgroundUrl: "",
        })
        toast.success("Campagne créée")
      } else {
        toast.error("Erreur: " + (res.error || "Impossible de créer la campagne"))
      }
    }
  }

  if (loading) return <div>Chargement...</div>

  if (editingCampaign) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {!teamAccess && <Button variant="outline" onClick={() => setEditingCampaign(null)} className="w-full sm:w-auto">← Retour</Button>}
            <h2 className="text-2xl font-bold leading-tight">{editingCampaign.name}</h2>
          </div>
          {!teamAccess && (
            <Button
              variant="outline"
              onClick={handleResetAll}
              disabled={resettingAll}
              className="border-amber-200 text-amber-800 hover:bg-amber-50 w-full sm:w-auto"
            >
              {resettingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Réinitialiser pour rejouer
            </Button>
          )}
        </div>

        <Tabs
          defaultValue={
            teamAccess
              ? teamAccess.permissions.can_view_participants
                ? "participants"
                : teamAccess.permissions.can_view_stats
                  ? "stats"
                  : teamAccess.permissions.can_view_gifts
                    ? "gifts"
                    : "participants"
              : "settings"
          }
        >
          <TabsList className="h-12 w-full overflow-x-auto items-center gap-1 rounded-xl bg-slate-100 p-1 shadow-sm ring-1 ring-slate-200 justify-start">
            {!teamAccess && (
              <TabsTrigger
                value="settings"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <Settings className="mr-2 h-4 w-4" /> Paramètres
              </TabsTrigger>
            )}
            {( !teamAccess || teamAccess.permissions.can_view_gifts ) && (
              <TabsTrigger
                value="gifts"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <GiftIcon className="mr-2 h-4 w-4" /> Cadeaux
              </TabsTrigger>
            )}
            {!teamAccess && (
              <TabsTrigger
                value="venues"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <Globe className="mr-2 h-4 w-4" /> Établissements
              </TabsTrigger>
            )}
            {( !teamAccess || teamAccess.permissions.can_view_participants ) && (
              <TabsTrigger
                value="participants"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <Users className="mr-2 h-4 w-4" /> Participants
              </TabsTrigger>
            )}
            {( !teamAccess || teamAccess.permissions.can_view_stats ) && (
              <TabsTrigger
                value="stats"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Statistiques
              </TabsTrigger>
            )}
            {!teamAccess && (
              <TabsTrigger
                value="team"
                className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900"
              >
                <Shield className="mr-2 h-4 w-4" /> Équipe
              </TabsTrigger>
            )}
          </TabsList>
          
          {!teamAccess && (
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres de la campagne</CardTitle>
                  <CardDescription>Modifiez les informations de base et l&apos;apparence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Été 2024" />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="ete-2024" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Description</Label>
                      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Description de la campagne" />
                    </div>
                    <div className="space-y-2">
                      <Label>Utilisateur (Campagne)</Label>
                      <Input value={formData.accessUsername} onChange={e => setFormData({...formData, accessUsername: e.target.value})} placeholder="ex: campagne1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Mot de passe (Campagne)</Label>
                      <Input type="password" value={formData.accessPassword} onChange={e => setFormData({...formData, accessPassword: e.target.value})} placeholder="Laisser vide pour ne pas changer" />
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pt-2">
                      <Checkbox
                        id="campaign-active"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                      />
                      <Label htmlFor="campaign-active">Campagne active (visible sur la page d&apos;accueil)</Label>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium flex items-center"><Palette className="mr-2 h-4 w-4" /> Apparence</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Couleur principale</Label>
                        <div className="flex gap-2">
                          <Input type="color" className="w-12 p-1" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                          <Input value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Couleur secondaire</Label>
                        <div className="flex gap-2">
                          <Input type="color" className="w-12 p-1" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                          <Input value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>URL du Logo</Label>
                        <div className="flex gap-2">
                          <Input value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} placeholder="/logo.png" />
                          <input
                            type="file"
                            ref={logoInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleUpload(e.target.files[0], 'logo')
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>URL de l&apos;arrière-plan</Label>
                        <div className="flex gap-2">
                          <Input value={formData.backgroundUrl} onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} placeholder="/bg.jpg" />
                          <input
                            type="file"
                            ref={bgInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleUpload(e.target.files[0], 'bg')
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => bgInputRef.current?.click()}
                            disabled={uploadingBg}
                          >
                            {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave}>Enregistrer les modifications</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {( !teamAccess || teamAccess.permissions.can_view_gifts ) && (
            <TabsContent value="gifts">
              <CampaignGiftManager 
                campaignId={editingCampaign.id} 
                campaignName={editingCampaign.name}
                readOnly={teamAccess && !teamAccess.permissions.can_edit_gifts} 
                logoUrl={editingCampaign.theme?.logoUrl}
              />
            </TabsContent>
          )}

          {!teamAccess && (
            <TabsContent value="venues">
              <CampaignVenueManager campaignId={editingCampaign.id} logoUrl={editingCampaign.theme?.logoUrl} />
            </TabsContent>
          )}

          {( !teamAccess || teamAccess.permissions.can_view_participants ) && (
            <TabsContent value="participants">
              <ParticipantList
                campaignId={editingCampaign.id}
                isTeamAccess={!!teamAccess}
                logoUrl={editingCampaign.theme?.logoUrl}
              />
            </TabsContent>
          )}

          {( !teamAccess || teamAccess.permissions.can_view_stats ) && (
            <TabsContent value="stats">
              <CampaignStats campaignId={editingCampaign.id} logoUrl={editingCampaign.theme?.logoUrl} />
            </TabsContent>
          )}

          {!teamAccess && (
            <TabsContent value="team">
              <CampaignTeamManager campaignId={editingCampaign.id} campaignName={editingCampaign.name} />
            </TabsContent>
          )}
        </Tabs>

        <AlertDialog open={confirmResetAll} onOpenChange={setConfirmResetAll}>
          <AlertDialogContent className="bg-white dark:bg-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser pour rejouer ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cela démarre une nouvelle session (nouveaux compteurs), sans modifier le stock configuré, et en conservant l’historique des gagnants.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resettingAll}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={performResetAll} disabled={resettingAll}>
                {resettingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Réinitialiser
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mes Campagnes</h2>
        <Button onClick={() => setShowCreateForm(true)}><Plus className="mr-2 h-4 w-4" /> Nouvelle Campagne</Button>
      </div>

      {showCreateForm && (
        <Card
          className="mb-6 border-dashed overflow-hidden relative"
          style={{
            backgroundImage: formData.backgroundUrl ? `url(${formData.backgroundUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: formData.primaryColor,
          }}
        >
          <div className="absolute inset-0 bg-white/85" />
          <CardHeader className="relative">
            <CardTitle>Créer une nouvelle campagne</CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Été 2024" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="ete-2024" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Description de la campagne" />
              </div>
              <div className="space-y-2">
                <Label>Utilisateur (Campagne)</Label>
                <Input value={formData.accessUsername} onChange={e => setFormData({...formData, accessUsername: e.target.value})} placeholder="ex: campagne1" />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe (Campagne)</Label>
                <Input type="password" value={formData.accessPassword} onChange={e => setFormData({...formData, accessPassword: e.target.value})} placeholder="••••••••" />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-2">
                <Checkbox
                  id="campaign-active-create"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                />
                <Label htmlFor="campaign-active-create">Campagne active (visible sur la page d&apos;accueil)</Label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium flex items-center"><Palette className="mr-2 h-4 w-4" /> Apparence</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Couleur principale</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-12 p-1" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                    <Input value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Couleur secondaire</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-12 p-1" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                    <Input value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL du Logo</Label>
                  <div className="flex gap-2">
                    <Input value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} placeholder="/logo.png" />
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(e.target.files[0], 'logo')
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.logoUrl && (
                    <img src={formData.logoUrl} alt="Logo preview" className="h-16 object-contain border rounded bg-gray-50 mt-2" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>URL de l&apos;arrière-plan</Label>
                  <div className="flex gap-2">
                    <Input value={formData.backgroundUrl} onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} placeholder="/bg.jpg" />
                    <input
                      type="file"
                      ref={bgInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(e.target.files[0], 'bg')
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => bgInputRef.current?.click()}
                      disabled={uploadingBg}
                    >
                      {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.backgroundUrl && (
                    <img src={formData.backgroundUrl} alt="BG preview" className="h-16 w-full object-cover border rounded mt-2" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Annuler</Button>
              <Button onClick={handleSave} style={{ backgroundColor: formData.primaryColor, color: "white" }}>Créer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map(campaign => (
          <Card key={campaign.id} className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => handleEdit(campaign)}>
            <div className="h-32 bg-cover bg-center relative" style={{ backgroundImage: `url(${campaign.theme.backgroundUrl || '/placeholder-bg.jpg'})`, backgroundColor: campaign.theme.primaryColor }}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                {campaign.theme.logoUrl && (
                    <img src={campaign.theme.logoUrl} alt="" className="absolute bottom-[-20px] left-4 w-16 h-16 rounded-full border-4 border-white object-contain bg-white" />
                )}
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="flex justify-between items-start">
                <span>{campaign.name}</span>
                <div className="flex gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            window.open(`/c/${campaign.slug}`, '_blank');
                        }} 
                        title="Voir la campagne"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id) }} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                <span>/{campaign.slug}</span>
                {campaign.is_active === false ? (
                  <span className="ml-auto rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Inactive
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-gray-500 line-clamp-2">{campaign.description || "Aucune description"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Cela supprimera définitivement cette campagne et toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CampaignVenueManager({ campaignId, logoUrl }: { campaignId: string; logoUrl?: string }) {
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([])
  const [venues, setVenues] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [cityId, setCityId] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<"restau" | "bar" | "point de vente">("bar")
  const [stock, setStock] = useState("0")

  useEffect(() => {
    loadData()
  }, [campaignId])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: citiesData } = await supabase.from("cities").select("id, name").order("name")
    setCities(citiesData || [])

    const { data: venuesData } = await supabase
      .from("venues")
      .select("*, city:cities ( id, name )")
      .eq("campaign_id", campaignId)
      .order("name")
    setVenues(venuesData || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityId || !name) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("venues")
      .insert([{
        name,
        type,
        stock: parseInt(stock) || 0,
        city_id: cityId,
        campaign_id: campaignId
      }])
      .select("*, city:cities ( id, name )")
      .single()

    if (error) {
      toast.error("Erreur: " + error.message)
    } else {
      setVenues([...venues, data])
      setName("")
      setStock("0")
      toast.success("Établissement ajouté")
    }
    setSaving(true)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("venues").delete().eq("id", id)
    if (error) {
      toast.error("Erreur: " + error.message)
    } else {
      setVenues(venues.filter(v => v.id !== id))
      toast.success("Établissement supprimé")
    }
  }

  if (loading) return <BrandLoader logoUrl={logoUrl} title="Chargement des établissements..." />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter un établissement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Ville</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={cityId}
                onChange={e => setCityId(e.target.value)}
                required
              >
                <option value="">Sélectionner une ville</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nom de l'établissement" required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={type}
                onChange={e => setType(e.target.value as any)}
              >
                <option value="bar">Bar</option>
                <option value="restau">Restau</option>
                <option value="point de vente">Point de vente</option>
              </select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {venues.map(venue => (
          <Card key={venue.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{venue.name}</CardTitle>
                  <CardDescription>{venue.city?.name} • {venue.type}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(venue.id)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
