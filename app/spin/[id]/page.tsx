import { notFound } from "next/navigation"
import SpinPageClient from "@/components/spin-page-client"
import { getSpinData } from "@/app/actions/finalize-spin"

export const dynamic = "force-dynamic"

export default async function SpinPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const res = await getSpinData(id)
  if (!res.success || !res.data) notFound()

  return (
    <SpinPageClient
      participantId={id}
      initialParticipant={res.data.participant as any}
      initialCampaign={res.data.campaign as any}
      initialPrizes={(res.data.prizes as any) || []}
      initialCityId={res.data.cityId}
    />
  )
}
