"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface Prize {
  id: string
  name: string
  imageUrl?: string
  color?: string
  available?: boolean
  is_prize?: boolean
}

interface SpinnerWheelProps {
  participantName: string
  prizes: Prize[]
  onSpinComplete: (prizeId: string) => void
  hasSpun: boolean
  resultPrize: Prize | null
  spinError?: string | null
  pointerSide?: "top" | "right"
  spinLabel?: string
  className?: string
  theme?: "default" | "gold"
  customColors?: {
    primary?: string
    secondary?: string
  }
  campaignTheme?: {
    backgroundUrl?: string
  }
}

export function SpinnerWheel({
  participantName,
  prizes,
  onSpinComplete,
  hasSpun,
  resultPrize,
  spinError,
  pointerSide = "top",
  spinLabel = "SPIN THE WHEEL!",
  className,
  theme = "default",
  customColors,
  campaignTheme,
}: SpinnerWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [wheelSize, setWheelSize] = useState<number>(384)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const tickTimersRef = useRef<number[]>([])
  const playTick = () => {
    try {
      if (typeof window === "undefined") return
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!audioCtxRef.current) audioCtxRef.current = new AC()
      const ctx = audioCtxRef.current!
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "square"
      osc.frequency.value = 1000
      gain.gain.value = 0.03
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.03, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch {}
  }

  const handleSpin = () => {
    if (isSpinning || hasSpun || prizes.length === 0) return

    setIsSpinning(true)

    // Choose among available prizes to ensure we never land on an exhausted wedge
    const availableIndices = prizes
      .map((p, i) => (p.available !== false ? i : -1))
      .filter((i) => i !== -1)
    if (availableIndices.length === 0) {
      setIsSpinning(false)
      return
    }
    const selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    const selectedPrizeId = prizes[selectedIndex].id

    const segmentAngle = 360 / prizes.length
    const pointerAngle = pointerSide === "right" ? 90 : 0
    const midAngle = selectedIndex * segmentAngle + segmentAngle / 2
    const baseSpin = 360 * 4 // four full turns
    const jitter = (Math.random() - 0.5) * (segmentAngle * 0.2) // small randomness within the wedge
    const targetRotation = baseSpin + pointerAngle - midAngle + jitter

    // Schedule decelerating tick sounds over the spin duration
    const totalTicks = prizes.length * 5
    const durationMs = 4000
    tickTimersRef.current.forEach((t) => clearTimeout(t))
    tickTimersRef.current = []
    for (let i = 0; i < totalTicks; i++) {
      const t = i / (totalTicks - 1)
      const easeOut = 1 - Math.pow(1 - t, 3) // Slightly sharper ease out
      const at = Math.floor(easeOut * durationMs)
      const timer = window.setTimeout(() => playTick(), at)
      tickTimersRef.current.push(timer)
    }

    setRotation(targetRotation)

    setTimeout(() => {
      // Clear any remaining tick timers
      tickTimersRef.current.forEach((t) => clearTimeout(t))
      tickTimersRef.current = []

      setIsSpinning(false)
      onSpinComplete(selectedPrizeId)
    }, 4000)
  }

  useEffect(() => {
    if (hasSpun && resultPrize) {
      setShowWinnerModal(true)
    }
  }, [hasSpun, resultPrize])

  useEffect(() => {
    if (spinError) {
      setShowErrorModal(true)
    }
  }, [spinError])

  useEffect(() => {
    if (typeof window === "undefined") return

    const calcSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isSplitLayout = vw >= 1024
      const availableWidth = isSplitLayout ? vw * 0.5 : vw
      const base = Math.min(availableWidth, vh) * 0.8
      const clamped = Math.max(280, Math.min(480, Math.floor(base)))
      setWheelSize(clamped)
    }

    calcSize()
    window.addEventListener("resize", calcSize)
    return () => window.removeEventListener("resize", calcSize)
  }, [])

  const borderColor = "border-white"
  const fallbackColors =
    theme === "gold"
      ? ["#A97100", "#B88400", "#C79600", "#D6A800", "#E5BA00", "#F4CC00", "#D0A000", "#BF8E00"]
      : ["#e31d2b", "#fff1a8"]
  const resultAccent =
    theme === "gold"
      ? "from-yellow-50 to-yellow-100 border-yellow-500 text-amber-700"
      : "from-blue-50 to-blue-100 border-blue-800 text-blue-900"
  const buttonClasses =
    theme === "gold"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-[#E31D2B] hover:bg-[#c41925] text-white"

  const hasAvailablePrizes = prizes.some(p => p.available !== false)

  return (
    <div className={className}>
      <div className="flex flex-col items-center space-y-16">
        <div className="relative">
          {/* Triangular Pointer - Matches New Reference Image */}
          {pointerSide === "top" && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
              {/* Triangular Shape using SVG */}
              <div className="relative w-12 h-12 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <path
                    d="M24 48L0 0H48L24 48Z"
                    fill="url(#pointer-gradient)"
                  />
                  <defs>
                    <linearGradient id="pointer-gradient" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#FFD54F" />
                      <stop offset="1" stopColor="#FFA000" />
                    </linearGradient>
                  </defs>
                  {/* Subtle top edge highlight */}
                  <path
                    d="M2 2H46"
                    stroke="white"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                </svg>
              </div>
            </div>
          )}

          {prizes.length > 0 && hasAvailablePrizes ? (
            (() => {
              const segmentAngle = 360 / prizes.length
              const colors = prizes.map((p, i) => p.color || fallbackColors[i % fallbackColors.length])
              const stops: string[] = []
              for (let i = 0; i < prizes.length; i++) {
                const start = i * (100 / prizes.length)
                const end = (i + 1) * (100 / prizes.length)
                stops.push(`${colors[i]} ${start}% ${end}%`)
              }
              const gradient = `conic-gradient(${stops.join(", ")})`
              
              return (
                <div className="relative">
                  {/* Clean Outer Ring */}
                  <div 
                    className="absolute -inset-6 rounded-full border-[8px] border-[#daa520] shadow-2xl bg-[#e31d2b] flex items-center justify-center"
                    style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
                  >
                    {/* Bulbs - Simplified for clarity */}
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i}
                        className="absolute w-2.5 h-2.5 rounded-full bg-[#fff1a8] border border-amber-600 animate-pulse shadow-[0_0_8px_#ffd700]"
                        style={{
                          transform: `rotate(${i * 30}deg) translateY(-${wheelSize / 2 + 15}px)`
                        }}
                      />
                    ))}
                  </div>

                  {/* The Wheel */}
                  <div
                    className={`relative rounded-full border-4 border-[#daa520] overflow-hidden transform transition-transform duration-[4000ms] ease-[cubic-bezier(0.1, 0, 0.1, 1)]`}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      backgroundImage: gradient,
                      width: wheelSize,
                      height: wheelSize,
                      boxShadow: "inset 0 0 40px rgba(0,0,0,0.2)",
                    }}
                  >
                    {prizes.map((prize, index) => {
                      const startDeg = index * segmentAngle
                      const labelOffset = Math.round(wheelSize * 0.35)
                      const isLightBg = (prize.color || fallbackColors[index % fallbackColors.length]) === "#fff1a8"
                      
                      return (
                        <div
                          key={prize.id}
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            transform: `rotate(${startDeg + segmentAngle / 2}deg)`,
                          }}
                        >
                          <div
                            className="flex flex-col items-center gap-1"
                            style={{ 
                              transform: `translateY(-${labelOffset}px) rotate(-90deg)`, 
                              transformOrigin: "center",
                              color: isLightBg ? "#1a1a1a" : "#ffffff",
                              width: segmentAngle * (wheelSize / 150), // Prevent text overflow
                            }}
                          >
                            {prize.imageUrl ? (
                              <img
                                src={prize.imageUrl}
                                alt={prize.name}
                                className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-md"
                              />
                            ) : (
                              <span
                                className="text-center font-black uppercase text-sm md:text-base lg:text-lg leading-none break-words"
                                style={{
                                  maxWidth: "100px",
                                  textShadow: isLightBg ? "none" : "0 2px 4px rgba(0,0,0,0.5)"
                                }}
                              >
                                {prize.name}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Clean Center Cap */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="w-12 h-12 rounded-full border-4 border-[#8b6508] bg-gradient-to-b from-[#f7e082] to-[#daa520] shadow-xl flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-white/20 blur-[1px]" />
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div
              className="rounded-full border border-white bg-neutral-100 flex items-center justify-center text-center p-6"
              style={{ width: wheelSize, height: wheelSize, borderWidth: 1 }}
            >
              <p className="font-semibold text-neutral-600">
                {prizes.length === 0 ? "Aucune récompense configurée." : "Merci pour votre participation, vous avez atteint le nombre de cadeaux pour la soirée. Très bonne fin de soirée "}
              </p>
            </div>
          )}
          {prizes.length > 0 && hasAvailablePrizes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative pointer-events-auto">
                {/* Center dot removed in favor of golden cap */}
              </div>
            </div>
          )}
          {pointerSide === "right" && (
            <div className="absolute top-1/2 -translate-y-1/2 -right-6 z-50 flex items-center">
              {/* Triangular Pointer Body (Right-pointing) */}
              <div className="relative w-12 h-12 drop-shadow-[4px_0_6px_rgba(0,0,0,0.5)]">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <path
                    d="M0 24L48 0V48L0 24Z"
                    fill="url(#pointer-gradient-right)"
                  />
                  <defs>
                    <linearGradient id="pointer-gradient-right" x1="48" y1="24" x2="0" y2="24" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#FFD54F" />
                      <stop offset="1" stopColor="#FFA000" />
                    </linearGradient>
                  </defs>
                  {/* Subtle edge highlight */}
                  <path
                    d="M46 2L46 46"
                    stroke="white"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleSpin}
          disabled={isSpinning || hasSpun || !hasAvailablePrizes}
          className={`relative px-12 py-8 rounded-xl border-b-4 border-black/20 text-xl font-bold shadow-xl transform transition-all hover:scale-105 active:scale-95 active:translate-y-1 flex flex-col items-center leading-tight overflow-hidden group ${
            isSpinning ? "opacity-50 cursor-not-allowed" : ""
          } ${!customColors?.primary ? buttonClasses : ""}`}
          style={{
            ...(customColors?.primary
              ? { backgroundColor: customColors.primary, color: "white" }
              : { background: "linear-gradient(to bottom, #ff4e50, #f9d423)" }),
            fontFamily: "fantasy",
          }}
        >
          {isSpinning ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-3xl font-black tracking-tight drop-shadow-md uppercase">TOURNEZ</span>
              <span className="text-[12px] font-bold uppercase tracking-widest opacity-90">pour la Gloire</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
        </Button>

        {showWinnerModal && resultPrize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWinnerModal(false)} />
            <div 
              className={`relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 shadow-2xl p-8 text-center overflow-hidden ${
                theme === "gold" ? "border-yellow-500 bg-gradient-to-b from-yellow-50 to-amber-100" : "border-blue-900 bg-gradient-to-b from-blue-50 to-white"
              }`}
              style={customColors?.secondary ? { borderColor: customColors.secondary } : undefined}
            >

              <div className="relative z-10">
                  <p 
                    className={`text-2xl md:text-3xl font-extrabold ${resultPrize.is_prize === false ? "text-red-600" : (theme === "gold" ? "text-amber-700" : "text-blue-900")}`}
                    style={resultPrize.is_prize !== false && customColors?.primary ? { color: customColors.primary } : undefined}
                  >
                    {resultPrize.is_prize === false ? "Oups !" : "Félicitations !"}
                  </p>
                  <p 
                    className={`text-xl md:text-2xl font-bold mt-2 ${theme === "gold" ? "text-amber-800" : "text-blue-800"}`}
                    style={customColors?.primary ? { color: customColors.primary, opacity: 0.9 } : undefined}
                  >
                    {resultPrize.is_prize === false ? resultPrize.name : `Vous avez gagné : ${resultPrize.name}`}
                  </p>
                  {resultPrize.imageUrl && (resultPrize.imageUrl.startsWith("/") || resultPrize.imageUrl.startsWith("http")) ? (
                    <img src={resultPrize.imageUrl} alt={resultPrize.name} className="w-36 h-36 md:w-36 md:h-36 mx-auto my-5 object-contain drop-shadow-lg" />
                  ) : (
                    resultPrize.is_prize === false && (
                      <div className="text-6xl my-6">😔</div>
                    )
                  )}
                  <Button 
                    onClick={() => setShowWinnerModal(false)} 
                    className={`mt-6 text-white font-bold ${theme === "gold" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-900 hover:bg-blue-800"}`}
                    style={{
                      ...(customColors?.primary ? { backgroundColor: customColors.primary } : {}),
                      fontFamily: "fantasy",
                    }}
                  >
                    Fermer
                  </Button>
              </div>
            </div>
          </div>
        )}

        {showErrorModal && spinError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowErrorModal(false)} />
            <div 
              className="relative w-[92vw] max-w-md mx-auto rounded-2xl border-2 border-red-500 shadow-2xl bg-gradient-to-b from-red-50 to-white p-8 text-center overflow-hidden"
            >
               {campaignTheme?.backgroundUrl && (
                  <div className="absolute inset-0 z-0">
                      <img 
                          src={campaignTheme.backgroundUrl} 
                          alt="" 
                          className="w-full h-full object-cover opacity-10"
                      />
                  </div>
              )}
              <div className="relative z-10">
                  <p className="text-2xl md:text-3xl font-extrabold text-red-600 mb-4">
                    Oups !
                  </p>
                  <p className="text-lg text-gray-800 mb-6">
                    {spinError.includes("City limit") 
                        ? "Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer."
                        : spinError
                    }
                  </p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-8"
                    style={{ fontFamily: "fantasy" }}
                  >
                    Réessayer
                  </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* <h3 className="text-md font-bold text-lg pt-8 text-white">Animateur: {participantName}</h3> */}
      </div>
    </div>
  )
}
