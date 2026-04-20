"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  getCities,
  createCity,
  updateCity,
  deleteCity,
  type City,
} from "@/app/actions/manage-cities"
import { Pencil, Trash2, Plus, X, Save } from "lucide-react"
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

export function CityManager() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCities()
  }, [])

  const loadCities = async () => {
    const res = await getCities()
    if (res.success && res.data) {
      setCities(res.data)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setFormData({ name: "", username: "", password: "" })
    setError(null)
    setIsAdding(false)
    setEditingId(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!formData.name || !formData.username || !formData.password) {
      setError("Tous les champs sont requis")
      return
    }

    const res = await createCity(formData.name, formData.username, formData.password)
    
    if (res.success && res.data) {
      setCities([...cities, res.data])
      resetForm()
      toast.success("Ville ajoutée avec succès")
    } else {
      setError(res.error || "Une erreur est survenue")
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setError(null)

    const updates: { name?: string; username?: string; password?: string } = {}
    if (formData.name) updates.name = formData.name
    if (formData.username) updates.username = formData.username
    if (formData.password) updates.password = formData.password

    const res = await updateCity(editingId, updates)

    if (res.success && res.data) {
      setCities(cities.map(c => c.id === editingId ? res.data! : c))
      resetForm()
      toast.success("Ville modifiée avec succès")
    } else {
      setError(res.error || "Une erreur est survenue")
    }
  }

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return

    const res = await deleteCity(deleteId)
    if (res.success) {
      setCities(cities.filter(c => c.id !== deleteId))
      toast.success("Ville supprimée")
    } else {
      toast.error(res.error || "Erreur lors de la suppression")
    }
    setDeleteId(null)
  }

  const startEdit = (city: City) => {
    setEditingId(city.id)
    setFormData({
      name: city.name,
      username: city.username,
      password: "", // Password isn't fetched for security, user enters new one if they want to change it
    })
    setIsAdding(false)
  }

  if (loading) return <div>Chargement des villes...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Liste des villes</h2>
        {!isAdding && !editingId && (
          <Button 
            onClick={() => setIsAdding(true)} 
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" /> Ajouter une ville
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle>{isAdding ? "Ajouter une nouvelle ville" : "Modifier la ville"}</CardTitle>
            <CardDescription>
              {isAdding 
                ? "Créez un compte pour une nouvelle ville." 
                : "Modifiez les informations de la ville. Laissez le mot de passe vide pour le conserver."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isAdding ? handleCreate : handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la ville</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex. Casablanca"
                    required={isAdding}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Nom d&apos;utilisateur</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="ex. orange_admin"
                    required={isAdding}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password">
                    {isAdding ? "Mot de passe" : "Nouveau mot de passe (optionnel)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isAdding ? "••••••••" : "Laisser vide pour ne pas changer"}
                    required={isAdding}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  {isAdding ? "Créer" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cities.map((city) => (
          <Card key={city.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{city.name}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(city)}
                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(city.id)}
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="font-mono text-xs bg-gray-100 py-1 px-2 rounded w-fit">
                {city.username}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">
                Ajouté le {new Date(city.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {cities.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-xl">
          Aucune ville configurée pour le moment.
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette ville ? Cette action est irréversible.
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
