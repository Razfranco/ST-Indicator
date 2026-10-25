import { Card } from './ui/card'

type Tone = 'positive' | 'negative' | 'neutral'

function toneClass(tone: Tone): string {
  if (tone === 'positive') return 'text-primary'
  if (tone === 'negative') return 'text-destructive'
  return 'text-foreground'
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
    <Card size="sm" className="gap-1 shadow-sm">
      <div className="flex flex-col gap-1 px-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xl font-semibold ${toneClass(tone)}`} dir="ltr">
          {value}
        </span>
      </div>
    </Card>
  )
}
