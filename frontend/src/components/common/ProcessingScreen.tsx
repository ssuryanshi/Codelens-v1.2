import { useEffect, useState } from 'react'

// Steps advance on a believable timeline (seconds). The last step stays
// active until the real work completes and the parent unmounts us.
const STEPS: Array<{ text: string; etaSec: number }> = [
  { text: 'Parsing repository files', etaSec: 2 },
  { text: 'Chunking source and building context', etaSec: 5 },
  { text: 'Generating semantic embeddings', etaSec: 12 },
  { text: 'Detecting architectural patterns', etaSec: 20 },
  { text: 'Composing AI insights', etaSec: 30 },
]

export function ProcessingScreen() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const id = setInterval(() => {
      setElapsed((performance.now() - start) / 1000)
    }, 120)
    return () => clearInterval(id)
  }, [])

  // Current step index: the first step whose eta we haven't passed yet.
  const activeIdx = Math.min(
    STEPS.findIndex((s) => elapsed < s.etaSec),
    STEPS.length - 1,
  )
  const safeActive = activeIdx === -1 ? STEPS.length - 1 : activeIdx

  // Progress asymptotes toward ~92% — looks alive but doesn't lie about being
  // "nearly done". The real completion yanks us off-screen.
  const target = 92
  const progress = target * (1 - Math.exp(-elapsed / 14))

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#121210' }}
    >
      {/* Ambient background grid — subtle, non-distracting */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(232,100,58,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(232,100,58,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 70%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 70%)',
        }}
      />

      <div
        className="relative z-10 px-10 py-9"
        style={{
          background: '#191917',
          border: '1px solid #2e2d29',
          borderRadius: '8px',
          width: '560px',
          maxWidth: '92vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        {/* Dual-ring spinner — outer slow, inner fast, offset gives a 'thinking' feel */}
        <div className="mb-7 flex items-center">
          <div className="relative w-11 h-11">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: '2px solid rgba(255,255,255,0.08)',
                borderTopColor: 'rgba(232,100,58,0.9)',
                animation: 'cl-spin 1.6s cubic-bezier(0.5,0,0.5,1) infinite',
              }}
            />
            <div
              className="absolute inset-[6px] rounded-full"
              style={{
                border: '2px solid rgba(255,255,255,0.04)',
                borderBottomColor: 'rgba(232,100,58,0.55)',
                animation: 'cl-spin-rev 1.1s linear infinite',
              }}
            />
          </div>
          <div className="ml-4">
            <div className="font-display text-[22px] text-bone leading-none">
              Analyzing repository
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {STEPS[safeActive].text}
              <span className="inline-block ml-1" style={{ animation: 'cl-blink 1.4s infinite' }}>
                …
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar with shimmer sweep */}
        <div
          className="relative w-full h-[6px] rounded-full overflow-hidden mb-7"
          style={{ background: '#2a2925' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background:
                'linear-gradient(90deg, rgba(232,100,58,0.85) 0%, #e8643a 60%, rgba(232,100,58,0.85) 100%)',
            }}
          />
          <div
            className="absolute inset-y-0"
            style={{
              width: '30%',
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
              animation: 'cl-shimmer 1.8s linear infinite',
            }}
          />
        </div>

        {/* Step list — three states, visually distinct */}
        <ul className="space-y-[10px]">
          {STEPS.map((step, i) => {
            const done = i < safeActive
            const active = i === safeActive
            return (
              <li key={i} className="flex items-center text-[13px]">
                <span className="flex-shrink-0 mr-3 inline-flex items-center justify-center" style={{ width: 18, height: 18 }}>
                  {done ? (
                    <span
                      className="inline-flex items-center justify-center rounded-full"
                      style={{
                        width: 16,
                        height: 16,
                        background: '#e8643a',
                        color: '#121210',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  ) : active ? (
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: 10,
                        height: 10,
                        background: '#e8643a',
                        boxShadow: '0 0 0 4px rgba(232,100,58,0.18)',
                        animation: 'cl-pulse 1.3s ease-in-out infinite',
                      }}
                    />
                  ) : (
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: '#2e2d29',
                        border: '1px solid #3a3833',
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    color: done ? '#9ca3af' : active ? '#f5f5f3' : '#5c5a55',
                    fontWeight: active ? 500 : 400,
                    textDecoration: done ? 'line-through' : 'none',
                    textDecorationColor: 'rgba(156,163,175,0.35)',
                    textDecorationThickness: '1px',
                    textUnderlineOffset: '2px',
                  }}
                >
                  {step.text}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Small hint — rotates subtly on time so the screen feels alive */}
        <div className="mt-7 pt-4 text-[11px] text-gray-500 flex items-center justify-between" style={{ borderTop: '1px solid #2a2925' }}>
          <span>Running on serverless infra. First-time ingest can take a minute.</span>
          <span className="font-mono tabular-nums text-gray-500">
            {Math.floor(elapsed)}s
          </span>
        </div>
      </div>

      <style>{`
        @keyframes cl-spin { to { transform: rotate(360deg); } }
        @keyframes cl-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes cl-shimmer { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
        @keyframes cl-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(232,100,58,0.18); }
          50% { transform: scale(1.15); box-shadow: 0 0 0 7px rgba(232,100,58,0.05); }
        }
        @keyframes cl-blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
