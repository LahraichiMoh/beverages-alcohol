import { notFound } from "next/navigation"
import { getCampaignBySlug, getCurrentCampaignAccess } from "@/app/actions/campaigns"
import { CampaignLoginForm } from "@/components/city-login-form"
import { CampaignParticipationForm } from "@/components/campaign-participation-form"

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  const { slug } = await params
  const res = await getCampaignBySlug(slug)

  if (!res.success || !res.data) {
    notFound()
  }

  const campaign = res.data
  const access = await getCurrentCampaignAccess()
  const isAuthed = access?.id === campaign.id

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: `url(${campaign.theme.backgroundUrl || '/placeholder-bg.jpg'})`,
        backgroundColor: campaign.theme.primaryColor || '#f3f4f6'
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md">
        {isAuthed ? (
          <CampaignParticipationForm 
            campaignId={campaign.id}
            campaignName={campaign.name}
            theme={campaign.theme}
          />
        ) : (
          <CampaignLoginForm 
            campaignName={campaign.name}
            campaignSlug={campaign.slug}
            theme={campaign.theme}
          />
        )}
      </div>
    </div>
  )
}
