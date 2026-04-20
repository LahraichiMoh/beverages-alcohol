"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface ParticipantFormProps {
  campaignName: string
  primaryColor?: string
  logoUrl?: string
  onSubmit: (data: ParticipantDetails) => void
}

export interface ParticipantDetails {
  fullName: string
  phone: string
  gender: string
  ageRange: string
  address: string
  usualProduct: string
}

export function ParticipantForm({ campaignName, primaryColor, logoUrl, onSubmit }: ParticipantFormProps) {
  const [formData, setFormData] = useState<ParticipantDetails>({
    fullName: "",
    phone: "",
    gender: "",
    ageRange: "",
    address: "",
    usualProduct: "",
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onSubmit(formData)
  }

  const handleChange = (field: keyof ParticipantDetails, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-md shadow-2xl border-0">
      <CardHeader className="text-center pb-2">
        {logoUrl && (
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
          </div>
        )}
        <CardTitle className="text-2xl font-bold" style={{ color: primaryColor }}>
          {campaignName}
        </CardTitle>
        <CardDescription className="text-slate-600 font-medium mt-1">
          Informations du participant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-slate-700 font-semibold">Nom & Prénom</Label>
            <Input
              id="fullName"
              placeholder="Ex: Ahmed Alaoui"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-slate-700 font-semibold">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0* ** ** ** **"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-slate-700 font-semibold">Sexe</Label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Choisir</option>
              <option value="Masculin">Masculin</option>
              <option value="Féminin">Féminin</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ageRange" className="text-slate-700 font-semibold">Tranche d&apos;âge</Label>
            <select
              id="ageRange"
              value={formData.ageRange}
              onChange={(e) => handleChange("ageRange", e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Choisir</option>
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-55">46-55</option>
              <option value="55+">55+</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-slate-700 font-semibold">Adresse</Label>
            <Input
              id="address"
              placeholder="Quartier, Ville..."
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="border-slate-200 focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usualProduct" className="text-slate-700 font-semibold">Produit habituel</Label>
            <select
              id="usualProduct"
              value={formData.usualProduct}
              onChange={(e) => handleChange("usualProduct", e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Choisir</option>

              <optgroup label="Services">
                <option value="Alimenter mon solde">Alimenter mon solde</option>
                <option value="Envoyé de l'argent vers un mobile">Envoyé de l'argent vers un mobile</option>
                <option value="Acheter une recharge téléphonique">Acheter une recharge téléphonique</option>
                <option value="Payer une facture Orange">Payer une facture Orange</option>
                <option value="Payer un commerçant">Payer un commerçant</option>
                <option value="Retraits d'argent">Retraits d'argent</option>
                <option value="Virements">Virements</option>
                <option value="Fatourati">Fatourati</option>
              </optgroup>

              <optgroup label="Autoroute / Factures">
                <option value="Autoroute du Maroc">Autoroute du Maroc</option>
                <option value="IAM FACTURES">IAM FACTURES</option>
                <option value="INWI FACTURES">INWI FACTURES</option>
              </optgroup>

              <optgroup label="EAU ET ÉLECTRICITÉ">
                <option value="AMENDIS TANGER">AMENDIS TANGER</option>
                <option value="AMENDIS TETOUAN">AMENDIS TETOUAN</option>
                <option value="ONEE-BE">ONEE-BE</option>
                <option value="REDAL">REDAL</option>
                <option value="SRM BENI MELLAL KHENIFRA">SRM BENI MELLAL KHENIFRA</option>
                <option value="SRM CASABLANCA SETTAT">SRM CASABLANCA SETTAT</option>
                <option value="SRM DAKHLA OUED EDFAHAB">SRM DAKHLA OUED EDFAHAB</option>
                <option value="SRM FES MEKNES">SRM FES MEKNES</option>
                <option value="SRM GUELMIM OUED NOUN">SRM GUELMIM OUED NOUN</option>
                <option value="SRM L'ORIENTAL">SRM L'ORIENTAL</option>
                <option value="SRM LAAYOUNE SAKIA EL HAMRA">SRM LAAYOUNE SAKIA EL HAMRA</option>
                <option value="SRM MARRAKECH SAFI">SRM MARRAKECH SAFI</option>
                <option value="SRM RABAT SALE KENITRA">SRM RABAT SALE KENITRA</option>
                <option value="SRM SOUS MASSA">SRM SOUS MASSA</option>
                <option value="SRM TANGER TETOUAN ALHOICEIMA">SRM TANGER TETOUAN ALHOICEIMA</option>
              </optgroup>

              <optgroup label="ASSOCIATION">
                <option value="AFRIQUIA">AFRIQUIA</option>
                <option value="AVITO">AVITO</option>
                <option value="BEIN">BEIN</option>
                <option value="MARKOUB">MARKOUB</option>
                <option value="VIVO ENERGY">VIVO ENERGY</option>
                <option value="WINXO">WINXO</option>
              </optgroup>

              <optgroup label="ACHAT INTERNET">
                <option value="AMH-AMICALE MAROCAINE DES HANDICAPÉS">AMH-AMICALE MAROCAINE DES HANDICAPÉS</option>
                <option value="BAYT MAL AL SODS">BAYT MAL AL SODS</option>
                <option value="COLLECTE DONS SEISME MAROC 2023">COLLECTE DONS SEISME MAROC 2023</option>
                <option value="FONDATION HASSAN2">FONDATION HASSAN2</option>
              </optgroup>

              <optgroup label="IMPOTS">
                <option value="ANCFCC- CONSULTATION ET COMMANDES">ANCFCC- CONSULTATION ET COMMANDES</option>
                <option value="ANCFCC - DROIT ET CONSERVATION">ANCFCC - DROIT ET CONSERVATION</option>
                <option value="ANCFCC- PAIEMENT PUBLIC">ANCFCC- PAIEMENT PUBLIC</option>
                <option value="CNSS">CNSS</option>
                <option value="DGI IR IS TVA DE ET FI">DGI IR IS TVA DE ET FI</option>
                <option value="E-TIMBRE">E-TIMBRE</option>
                <option value="MINISTÈRE DE LA JUSTICE">MINISTÈRE DE LA JUSTICE</option>
                <option value="TGR-TAXES DOUANE AMENDES">TGR-TAXES DOUANE AMENDES</option>
              </optgroup>

              <optgroup label="ADMINISTRATIONS">
                <option value="ALAKHAWAYN UNIVERSITY">ALAKHAWAYN UNIVERSITY</option>
                <option value="LYAUTEY">LYAUTEY</option>
                <option value="LYCEE DESCARTES">LYCEE DESCARTES</option>
                <option value="LYCEE PAUL VALERY">LYCEE PAUL VALERY</option>
                <option value="OFPPT">OFPPT</option>
                <option value="VICTOR HUGO">VICTOR HUGO</option>
              </optgroup>

              <option value="Autre">Autre</option>
            </select>
          </div>

          <Button
            type="submit"
            className="w-full text-lg font-bold py-6 mt-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: primaryColor || "#f97316", color: "white" }}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Suivant"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
