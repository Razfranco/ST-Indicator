type Tone = 'positive' | 'negative' | 'neutral'

function toneClass(tone: Tone): string {
  if (tone === 'positive') return 'text-emerald-400'
  if (tone === 'negative') return 'text-red-400'
  return 'text-zinc-100'
}

export function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: Tone
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xl font-semibold ${toneClass(tone)}`} dir="ltr">
        {value}
      </span>
    </div>
  )
}
