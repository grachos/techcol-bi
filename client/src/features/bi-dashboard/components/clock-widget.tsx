import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Widget informativo: fecha y hora actual, sin conector */
export function ClockWidget() {
  const { i18n } = useTranslation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US'

  return (
    <div className='flex h-full flex-col items-center justify-center gap-1'>
      <span className='text-3xl font-bold tabular-nums'>
        {now.toLocaleTimeString(locale)}
      </span>
      <span className='text-muted-foreground text-sm capitalize'>
        {now.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </span>
    </div>
  )
}
