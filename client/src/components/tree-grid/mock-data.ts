export interface SalesRecord {
  id: string
  region: string
  category: string
  product: string
  date: string
  units: number
  revenue: number
  cost: number
  margin: number
  marginTarget: number
}

const REGIONS = ['North America', 'Europe', 'LatAm', 'APAC', 'MEA']
const CATEGORIES = ['Electronics', 'Home & Living', 'Apparel', 'Grocery', 'Sports']
const PRODUCT_NAMES = [
  'Pro', 'Max', 'Lite', 'Plus', 'Mini', 'Air', 'Ultra', 'Classic', 'Studio', 'Edge',
]

// PRNG determinista (mulberry32) para evitar dependencias de mock/faker en produccion.
function mulberry32(seed: number) {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateMockSalesData(leafCount = 2000): SalesRecord[] {
  const random = mulberry32(42)
  const rows: SalesRecord[] = []

  for (let i = 0; i < leafCount; i++) {
    const region = REGIONS[Math.floor(random() * REGIONS.length)]
    const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)]
    const productName = PRODUCT_NAMES[Math.floor(random() * PRODUCT_NAMES.length)]
    const units = Math.round(20 + random() * 480)
    const revenue = Math.round(units * (15 + random() * 85))
    const marginTarget = Number((0.18 + random() * 0.12).toFixed(3))
    const marginNoise = (random() - 0.5) * 0.2
    const margin = Number(Math.max(0.02, marginTarget + marginNoise).toFixed(3))
    const cost = Math.round(revenue * (1 - margin))
    const month = 1 + Math.floor(random() * 12)
    const day = 1 + Math.floor(random() * 27)

    rows.push({
      id: `rec-${i}`,
      region,
      category,
      product: `${category} ${productName} ${String(i).padStart(4, '0')}`,
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      units,
      revenue,
      cost,
      margin,
      marginTarget,
    })
  }

  return rows
}
