"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, Upload, Gift as GiftIcon, Edit, RefreshCw } from "lucide-react"
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
import { BrandLoader } from "@/components/brand-loader"
import { 
  getCampaignGifts, 
  createCampaignGift, 
  updateCampaignGift,
  deleteCampaignGift,
  resetGiftWinners,
  resetAllCampaignGifts,
  type Gift 
} from "@/app/actions/campaigns"
import { GiftLimitManager } from "@/components/gift-limit-manager"

interface CampaignGiftManagerProps {
  campaignId: string
  campaignName?: string
  readOnly?: boolean
  logoUrl?: string
}

export function CampaignGiftManager({ campaignId, campaignName, readOnly = false, logoUrl }: CampaignGiftManagerProps) {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)
  
  // Confirmation states
  const [deleteGiftId, setDeleteGiftId] = useState<string | null>(null)
  const [resetGiftId, setResetGiftId] = useState<string | null>(null)
  const [confirmResetAll, setConfirmResetAll] = useState(false)

  // New gift form state
  const [newName, setNewName] = useState("")
  const [newMaxWinners, setNewMaxWinners] = useState("0")
  const [newColor, setNewColor] = useState("#D4A017")
  const [newIsPrize, setNewIsPrize] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Edit gift state
  const [editingGift, setEditingGift] = useState<Gift | null>(null)
  const [editName, setEditName] = useState("")
  const [editMaxWinners, setEditMaxWinners] = useState("0")
  const [editColor, setEditColor] = useState("")
  const [editIsPrize, setEditIsPrize] = useState(true)
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadGifts()
  }, [campaignId])

  const loadGifts = async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true
    if (showLoader) setLoading(true)
    const res = await getCampaignGifts(campaignId)
    if (res.success && res.data) {
      setGifts(res.data)
    }
    if (showLoader) setLoading(false)
    return res
  }

  const handleUpload = async (file: File, isEdit = false) => {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("bucket", "prizes")
    
    try {
      const res = await fetch("/api/upload-prize", { method: "POST", body: fd })
      const json = await res.json()
      if (json.success) {
        if (isEdit) {
            setEditImageUrl(json.url)
        } else {
            setImageUrl(json.url)
        }
      } else {
        console.error("Upload failed:", json.error)
        toast.error("Erreur lors de l'upload de l'image")
      }
    } catch (e) {
      console.error("Upload error:", e)
      toast.error("Erreur lors de l'upload de l'image")
    } finally {
      setUploading(false)
    }
  }

  const handleCreateGift = async () => {
    if (!newName) return
    
    const res = await createCampaignGift(campaignId, {
      name: newName,
      max_winners: parseInt(newMaxWinners) || 0,
      color: newColor,
      is_prize: newIsPrize,
      image_url: imageUrl || undefined
    })

    if (res.success && res.data) {
      setGifts([...gifts, res.data])
      setShowAddForm(false)
      // Reset form
      setNewName("")
      setNewMaxWinners("0")
      setNewColor("#D4A017")
      setNewIsPrize(true)
      setImageUrl(null)
      toast.success("Cadeau créé avec succès")
    } else {
      toast.error("Erreur lors de la création du cadeau: " + res.error)
    }
  }

  const openEditDialog = (gift: Gift) => {
    setEditingGift(gift)
    setEditName(gift.name)
    setEditMaxWinners(gift.max_winners.toString())
    setEditColor(gift.color || "#D4A017")
    setEditIsPrize(gift.is_prize ?? true)
    setEditImageUrl(gift.image_url || null)
  }

  const handleUpdateGift = async () => {
    if (!editingGift || !editName) return

    const res = await updateCampaignGift(editingGift.id, {
        name: editName,
        max_winners: parseInt(editMaxWinners) || 0,
        color: editColor,
        is_prize: editIsPrize,
        image_url: editImageUrl || undefined
    })

    if (res.success && res.data) {
        setGifts(gifts.map(g => g.id === editingGift.id ? res.data! : g))
        setEditingGift(null)
        toast.success("Cadeau mis à jour")
    } else {
        toast.error("Erreur lors de la mise à jour: " + res.error)
    }
  }

  const handleResetGift = (giftId: string) => {
    setResetGiftId(giftId)
  }

  const confirmResetGift = async () => {
    if (!resetGiftId) return
    
    const res = await resetGiftWinners(resetGiftId)
    if (res.success) {
      const refreshed = await loadGifts({ showLoader: false })
      if (refreshed?.success && refreshed.data && editingGift?.id === resetGiftId) {
        const updated = refreshed.data.find((g) => g.id === resetGiftId) || null
        setEditingGift(updated)
      }
      toast.success("Compteur réinitialisé !")
    } else {
      toast.error("Erreur lors de la réinitialisation: " + res.error)
    }
    setResetGiftId(null)
  }

  const handleResetAllGifts = () => {
    setConfirmResetAll(true)
  }

  const performResetAllGifts = async () => {
    setResettingAll(true)
    const res = await resetAllCampaignGifts(campaignId)
    if (res.success) {
      await loadGifts({ showLoader: false })
      toast.success("Tous les compteurs ont été réinitialisés !")
    } else {
      toast.error("Erreur lors de la réinitialisation: " + res.error)
    }
    setResettingAll(false)
    setConfirmResetAll(false)
  }

  const handleDeleteGift = (id: string) => {
    setDeleteGiftId(id)
  }

  const confirmDeleteGift = async () => {
    if (!deleteGiftId) return
    
    const res = await deleteCampaignGift(deleteGiftId)
    if (res.success) {
      setGifts(gifts.filter(g => g.id !== deleteGiftId))
      toast.success("Cadeau supprimé")
    } else {
      toast.error("Erreur lors de la suppression: " + res.error)
    }
    setDeleteGiftId(null)
  }

  if (loading) return <BrandLoader logoUrl={logoUrl} title="Chargement des cadeaux..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium">Cadeaux de la campagne{campaignName ? `: ${campaignName}` : ""}</h3>
        {!readOnly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? "Annuler" : <><Plus className="mr-2 h-4 w-4" /> Ajouter un cadeau</>}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleResetAllGifts} disabled={resettingAll}>
              {resettingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Réinitialiser tous les cadeaux
            </Button>
          </div>
        )}
      </div>

      {showAddForm && (
        <Card className="bg-slate-50 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Nouveau cadeau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Casquette" />
              </div>
              <div className="space-y-2">
                <Label>Stock global (optionnel)</Label>
                <Input type="number" value={newMaxWinners} onChange={e => setNewMaxWinners(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex gap-2">
                  <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-12 p-1" />
                  <Input value={newColor} onChange={e => setNewColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="newIsPrize" 
                    checked={newIsPrize} 
                    onChange={e => setNewIsPrize(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
                  />
                  <Label htmlFor="newIsPrize" className="cursor-pointer">Cadeau réel (Gagnant)</Label>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Décochez pour les segments "Perdu" (ex: Oups, Rejouer). 
                  Le stock ne sera pas décompté.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image</Label>
                <div className="flex gap-4 items-center">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {imageUrl ? "Changer l'image" : "Uploader une image"}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} 
                  />
                  {imageUrl && <img src={imageUrl} alt="Preview" className="h-10 w-10 object-cover rounded" />}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
              <Button onClick={handleCreateGift} disabled={!newName || uploading}>Créer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Gift Dialog */}
      <Dialog open={!!editingGift} onOpenChange={(open) => !open && setEditingGift(null)}>
        <DialogContent className="max-w-xl">
          <CardHeader className="px-0">
            <CardTitle>Modifier le cadeau</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Stock global (optionnel)</Label>
                <Input 
                  type="number" 
                  value={editMaxWinners} 
                  onChange={e => setEditMaxWinners(e.target.value)}
                  min="0" 
                />
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex gap-2">
                  <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-12 p-1" />
                  <Input value={editColor} onChange={e => setEditColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="editIsPrize" 
                    checked={editIsPrize} 
                    onChange={e => setEditIsPrize(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
                  />
                  <Label htmlFor="editIsPrize" className="cursor-pointer">Cadeau réel (Gagnant)</Label>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Décochez pour les segments "Perdu" (ex: Oups, Rejouer). 
                  Le stock ne sera pas décompté.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image</Label>
                <div className="flex gap-4 items-center">
                  <Button variant="outline" onClick={() => editFileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {editImageUrl ? "Changer l'image" : "Uploader une image"}
                  </Button>
                  <input 
                    type="file" 
                    ref={editFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], true)} 
                  />
                  {editImageUrl && <img src={editImageUrl} alt="Preview" className="h-10 w-10 object-cover rounded" />}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
               <Button 
                variant="outline" 
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => editingGift && handleResetGift(editingGift.id)}
               >
                 <RefreshCw className="mr-2 h-4 w-4" />
                 Réinitialiser le compteur (0)
               </Button>

               <div className="flex gap-2">
                 <Button variant="ghost" onClick={() => setEditingGift(null)}>Annuler</Button>
                 <Button onClick={handleUpdateGift} disabled={!editName || uploading}>Enregistrer</Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gifts.map((gift) => {
          const venueTotal = Number(gift.venue_total_max_winners || 0)
          const effectiveTotal = venueTotal > 0 ? venueTotal : Number(gift.max_winners || 0)
          const totalLabel =
            venueTotal > 0 ? venueTotal : gift.max_winners === 0 ? "∞" : gift.max_winners
          const showProgress = effectiveTotal > 0
          const progressPct = showProgress
            ? Math.min(100, Math.max(0, (Number(gift.current_winners || 0) / effectiveTotal) * 100))
            : 0

          return (
          <Card key={gift.id} className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-transparent to-transparent" style={{ backgroundColor: gift.color || '#ccc' }} />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {gift.name}
                      {gift.is_prize === false && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-tighter">
                          Perdu
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Stock global:{" "}
                      {totalLabel}
                    </CardDescription>
                  </div>
                </div>
                {gift.image_url && (
                  <img src={gift.image_url} alt={gift.name} className="h-10 w-10 object-contain rounded bg-slate-100" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 flex flex-col gap-2">
              <div className="text-sm text-slate-500">
                Utilisés: {gift.current_winners} / {totalLabel}
              </div>
              {typeof gift.all_time_hits === "number" ? (
                <div className="text-xs text-slate-400">
                  {gift.is_prize === false ? "Tirages (total)" : "Gagnants (total)"}:{" "}
                  {gift.is_prize === false ? gift.all_time_hits : gift.all_time_winners ?? 0}
                </div>
              ) : null}
              {showProgress && (
                <div
                  className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={effectiveTotal}
                  aria-valuenow={Math.min(effectiveTotal, Math.max(0, Number(gift.current_winners || 0)))}
                >
                  <div
                    className="h-full transition-[width] duration-300"
                    style={{ width: `${progressPct}%`, backgroundColor: gift.color || "#94a3b8" }}
                  />
                </div>
              )}
              
              {!readOnly && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 text-xs min-w-[160px]">
                        Stock établissement
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <GiftLimitManager campaignId={campaignId} giftId={gift.id} giftName={gift.name} scope="venue" onLimitUpdated={loadGifts} />
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" size="sm" className="w-8 px-0" onClick={() => openEditDialog(gift)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteGift(gift.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          )
        })}
        
        {gifts.length === 0 && !showAddForm && (
          <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed">
            <GiftIcon className="mx-auto h-12 w-12 opacity-20 mb-2" />
            <p>Aucun cadeau pour cette campagne.</p>
            <Button variant="link" onClick={() => setShowAddForm(true)}>Ajouter le premier cadeau</Button>
          </div>
        )}
      </div>

      {/* Alert Dialogs */}
      <AlertDialog open={!!deleteGiftId} onOpenChange={(open) => !open && setDeleteGiftId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer ce cadeau ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGift} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetGiftId} onOpenChange={(open) => !open && setResetGiftId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le compteur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment remettre à zéro le nombre de gagnants pour ce cadeau ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetGift}>
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmResetAll} onOpenChange={setConfirmResetAll}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser tous les compteurs ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment remettre à zéro tous les compteurs de gagnants de cette campagne ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={performResetAllGifts}>
              Tout réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
