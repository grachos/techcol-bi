import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'

const data = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => ({
  name,
  clicks: Math.floor(Math.random() * 900) + 100,
  uniques: Math.floor(Math.random() * 700) + 80,
}))

export function AnalyticsChart() {
  const { t } = useTranslation()
  const translated = data.map((d) => ({ ...d, name: t(d.name) }))
  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart data={translated}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Area
          type='monotone'
          dataKey='clicks'
          stroke='currentColor'
          className='text-primary'
          fill='currentColor'
          fillOpacity={0.15}
        />
        <Area
          type='monotone'
          dataKey='uniques'
          stroke='currentColor'
          className='text-muted-foreground'
          fill='currentColor'
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
