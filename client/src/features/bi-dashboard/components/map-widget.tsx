import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import worldTopo from 'world-atlas/countries-110m.json'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { WIDGET_COLOR_CSS, type Widget } from '@/lib/dashboard-api'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetError, WidgetLoading } from './widget-state'

const VB_W = 800
const VB_H = 420

// Precalculado una sola vez: features del mundo + path SVG por pais
const world = feature(
  worldTopo as unknown as Topology,
  (worldTopo as unknown as Topology).objects.countries
) as unknown as FeatureCollection<Geometry, { name: string }>

const projection = geoNaturalEarth1().fitSize([VB_W, VB_H], world)
const pathGen = geoPath(projection)

const COUNTRY_PATHS = world.features.map((f) => ({
  name: f.properties.name,
  d: pathGen(f) ?? '',
}))

function detectKeys(rows: Row[], xKey: string | null, yKey: string | null) {
  if (rows.length === 0) return { region: xKey ?? '', value: yKey ?? '' }
  const columns = Object.keys(rows[0])
  const sample = rows[0]
  const numeric = columns.filter((c) => !isNaN(Number(sample[c])))
  const textual = columns.filter((c) => isNaN(Number(sample[c])))
  return {
    region: xKey || textual[0] || columns[0] || '',
    value: yKey || numeric[0] || '',
  }
}

interface MapWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

export function MapWidget({ widget, activeFilters }: MapWidgetProps) {
  const { t } = useTranslation()
  const { filteredRows, error, isLoading } = useWidgetData(widget, activeFilters)

  const { region: regionKey, value: valueKey } = useMemo(
    () => detectKeys(filteredRows, widget.xKey, widget.yKey),
    [filteredRows, widget.xKey, widget.yKey]
  )

  // Mapa nombre-de-pais (minusculas) -> valor, y el maximo para la escala de color
  const { valueByName, maxValue } = useMemo(() => {
    const map = new Map<string, number>()
    let max = 0
    filteredRows.forEach((r) => {
      const name = String(r[regionKey] ?? '')
        .trim()
        .toLowerCase()
      const v = Number(r[valueKey])
      if (!name || isNaN(v)) return
      map.set(name, (map.get(name) ?? 0) + v)
      if (map.get(name)! > max) max = map.get(name)!
    })
    return { valueByName: map, maxValue: max }
  }, [filteredRows, regionKey, valueKey])

  const solid = WIDGET_COLOR_CSS[widget.color].solid
  const hasData = valueByName.size > 0

  if (isLoading) return <WidgetLoading />
  if (error) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error })} />
  }

  return (
    <div className='flex h-full flex-col'>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className='h-full w-full'
        preserveAspectRatio='xMidYMid meet'
      >
        {COUNTRY_PATHS.map((c) => {
          const v = valueByName.get(c.name.toLowerCase())
          const opacity =
            v !== undefined && maxValue > 0 ? 0.25 + (v / maxValue) * 0.75 : 0
          return (
            <path
              key={c.name}
              d={c.d}
              fill={v !== undefined ? solid : 'var(--muted)'}
              fillOpacity={v !== undefined ? opacity : 1}
              stroke='var(--background)'
              strokeWidth={0.5}
            >
              {v !== undefined && (
                <title>{`${c.name}: ${new Intl.NumberFormat().format(v)}`}</title>
              )}
            </path>
          )
        })}
      </svg>
      {!hasData && (
        <p className='text-muted-foreground pt-1 text-center text-[11px]'>
          {t('No matching regions. The region column should hold country names.')}
        </p>
      )}
    </div>
  )
}
