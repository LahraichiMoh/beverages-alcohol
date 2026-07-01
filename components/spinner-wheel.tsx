"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace("#", "")
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b }
  }
  if (raw.length !== 6) return null
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return { r, g, b }
}

function mixHex(a: string, b: string, t: number) {
  const ar = hexToRgb(a)
  const br = hexToRgb(b)
  const tt = clamp01(t)
  if (!ar || !br) return b
  const r = Math.round(ar.r + (br.r - ar.r) * tt)
  const g = Math.round(ar.g + (br.g - ar.g) * tt)
  const bb = Math.round(ar.b + (br.b - ar.b) * tt)
  return `rgb(${r} ${g} ${bb})`
}

function rgbaFromHex(hex: string, a: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(56, 189, 248, ${clamp01(a)})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp01(a)})`
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

    // Weighted random selection:
    // - Real gifts get weight (stock remaining + 1)
    // - Fake gifts get weight 1 (always have small chance)
    const availablePrizes: { index: number; weight: number }[] = []

    prizes.forEach((p, i) => {
      if (p.available === false) return

      if (p.is_prize !== false) {
        // Real gift: weight based on max_winners, default to 10 if unlimited
        const remaining = p.max_winners > 0 
          ? Math.max(1, p.max_winners - p.current_winners) 
          : 10
        availablePrizes.push({ index: i, weight: remaining })
      } else {
        // Fake gift: gets weight 3 so it comes up more often
        availablePrizes.push({ index: i, weight: 3 })
      }
    })

    if (availablePrizes.length === 0) {
      setIsSpinning(false)
      return
    }

    // Weighted random selection
    const totalWeight = availablePrizes.reduce((sum, p) => sum + p.weight, 0)
    let random = Math.random() * totalWeight
    let selectedIndex = availablePrizes[0].index
    for (const p of availablePrizes) {
      random -= p.weight
      if (random <= 0) {
        selectedIndex = p.index
        break
      }
    }
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

  const accentColor = customColors?.secondary || customColors?.primary || (theme === "gold" ? "#F4CC00" : "#38bdf8")
  const primaryColor = customColors?.primary || accentColor

  const fallbackColors =
    theme === "gold"
      ? ["#A97100", "#B88400", "#C79600", "#D6A800", "#E5BA00", "#F4CC00", "#D0A000", "#BF8E00"]
      : [
          mixHex("#0b1220", primaryColor, 0.62),
          mixHex("#0b1220", accentColor, 0.62),
          mixHex("#0b1220", primaryColor, 0.78),
          mixHex("#0b1220", accentColor, 0.78),
          mixHex("#0b1220", primaryColor, 0.68),
          mixHex("#0b1220", accentColor, 0.68),
          mixHex("#0b1220", primaryColor, 0.84),
          mixHex("#0b1220", accentColor, 0.84),
        ]
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
                  {theme !== "gold" ? (
                    <>
                      <div
                        className="absolute -inset-4 rounded-full"
                        style={{
                          background: `conic-gradient(from 0deg, rgb(248 250 252), rgb(203 213 225), ${mixHex(
                            "#cbd5e1",
                            accentColor,
                            0.35
                          )}, rgb(148 163 184), rgb(15 23 42), rgb(148 163 184), ${mixHex(
                            "#cbd5e1",
                            accentColor,
                            0.35
                          )}, rgb(203 213 225), rgb(248 250 252))`,
                          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                        }}
                      />
                      <div
                        className="absolute -inset-3 rounded-full"
                        style={{
                          boxShadow: `0 0 0 6px rgba(148,163,184,0.6), 0 0 45px ${rgbaFromHex(
                            accentColor,
                            0.45
                          )}, 0 0 120px ${rgbaFromHex(accentColor, 0.2)}`,
                        }}
                      />
                    </>
                  ) : (
                    <div
                      className="absolute -inset-4 rounded-full"
                      style={{
                        background:
                          "conic-gradient(from 0deg, #fff7cc, #f4cc00, #d6a800, #bf8e00, #fff7cc)",
                        boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                      }}
                    />
                  )}

                  {/* The Wheel */}
                  <div
                    className={`relative rounded-full overflow-hidden transform transition-transform duration-[4000ms] ease-[cubic-bezier(0.1, 0, 0.1, 1)]`}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      backgroundImage: gradient,
                      width: wheelSize,
                      height: wheelSize,
                      boxShadow:
                        theme === "gold" ? "inset 0 0 60px rgba(0,0,0,0.3)" : "inset 0 0 90px rgba(0,0,0,0.55)",
                      outline: theme === "gold" ? "4px solid rgba(218, 165, 32, 0.75)" : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {prizes.map((prize, index) => {
                      const startDeg = index * segmentAngle
                      const baseImageSize = wheelSize * 0.22
                      const angleFactor = Math.max(0.55, Math.min(1, segmentAngle / 60))
                      const imageSize = Math.round(Math.max(56, Math.min(120, baseImageSize * angleFactor)))
                      const labelOffset = Math.round(wheelSize * 0.33 + imageSize * 0.12)
                      const isLightBg =
                        theme === "gold" &&
                        (prize.color || fallbackColors[index % fallbackColors.length]) === "#fff1a8"
                      
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
                                className="object-contain drop-shadow-md"
                                style={{ width: imageSize, height: imageSize }}
                              />
                            ) : (
                              <span
                                className="text-center font-black uppercase text-sm md:text-base lg:text-lg leading-none break-words"
                                style={{
                                  
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
              <span className="text-2xl font-black tracking-tight drop-shadow-md uppercase">TOURNEZ</span>
              <span className="text-[12px] font-bold uppercase tracking-widest opacity-90">pour la Gloire</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
        </Button>

        {mounted && showWinnerModal && resultPrize
          ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 w-[100dvw] h-[100dvh] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowWinnerModal(false)}
            />
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
                    {resultPrize.is_prize === false ? "Retentez votre chance !" : "Félicitations !"}
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
          , document.body)
          : null}

        {mounted && showErrorModal && spinError
          ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 w-[100dvw] h-[100dvh] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowErrorModal(false)}
            />
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
                    Retentez votre chance !!
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
          , document.body)
          : null}
        
        {/* <h3 className="text-md font-bold text-lg pt-8 text-white">Animateur: {participantName}</h3> */}
      </div>
    </div>
  )
}
