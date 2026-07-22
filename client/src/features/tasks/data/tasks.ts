/**
 * Datos de ejemplo del modulo Tareas (demo de la plantilla).
 *
 * Se generan aqui en vez de con @faker-js/faker: faker es una devDependency,
 * pero al importarse desde codigo de aplicacion terminaba empaquetado en el
 * bundle de produccion (~424 KB de datos falsos enviados al navegador).
 * Este generador es determinista, asi que la lista es siempre la misma.
 */

const STATUSES = ['todo', 'in progress', 'done', 'canceled', 'backlog'] as const
const LABELS = ['bug', 'feature', 'documentation'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

const SUBJECTS = [
  'El panel de conectores', 'La sincronizacion nocturna', 'El filtro de fechas',
  'La exportacion a CSV', 'El cache de agregaciones', 'La tabla dinamica',
  'El selector de metricas', 'La vista compartida', 'El grafico de barras',
  'La carga inicial',
]
const ACTIONS = [
  'no responde con rangos largos', 'requiere una revision de rendimiento',
  'debe validar los datos de entrada', 'necesita mensajes de error mas claros',
  'pierde el estado al recargar', 'tarda demasiado en refrescar',
  'debe respetar los permisos del usuario', 'muestra columnas vacias',
]
const NAMES = [
  'Ana Torres', 'Carlos Ruiz', 'Lucia Gomez', 'Miguel Peña', 'Sofia Ramirez',
  'Andres Castro', 'Valentina Diaz', 'Javier Morales',
]

/** Generador congruencial lineal: mismos valores en cada carga, sin dependencias. */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = makeRandom(12345)
const pick = <T,>(list: readonly T[]): T =>
  list[Math.floor(random() * list.length)]

// Fecha base fija (no Date.now()) para que la lista no cambie entre cargas.
const BASE = new Date('2026-01-15T12:00:00Z').getTime()
const DAY = 86_400_000
const shiftDays = (days: number) => new Date(BASE + days * DAY)

export const tasks = Array.from({ length: 100 }, (_, i) => ({
  id: `TASK-${1000 + Math.floor(random() * 9000)}`,
  title: `${pick(SUBJECTS)} ${pick(ACTIONS)}`,
  status: pick(STATUSES),
  label: pick(LABELS),
  priority: pick(PRIORITIES),
  createdAt: shiftDays(-180 + (i % 90)),
  updatedAt: shiftDays(-(i % 14)),
  assignee: pick(NAMES),
  description: `${pick(SUBJECTS)} ${pick(ACTIONS)}. Revisar el caso y documentar el resultado.`,
  dueDate: shiftDays(15 + (i % 60)),
}))
