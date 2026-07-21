import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Zap, Settings, Database } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/help-center/')({
  component: HelpCenter,
})

function HelpCenter() {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('metrics')

  const sections = [
    { id: 'metrics', label: 'Guía de Métricas', icon: Zap },
    { id: 'formulas', label: 'Lenguaje de Fórmulas', icon: BookOpen },
    { id: 'constants', label: 'Constantes y Variables', icon: Settings },
    { id: 'functions', label: 'Funciones Disponibles', icon: Database },
  ]

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 gap-6'>
        {/* Sidebar */}
        <aside className='w-64 pt-4'>
          <div className='sticky top-20'>
            <h2 className='font-semibold text-lg mb-4'>{t('Help Topics')}</h2>
            <nav className='space-y-2'>
              {sections.map((section) => {
                const IconComponent = section.icon
                return (
                  <Button
                    key={section.id}
                    variant={activeSection === section.id ? 'default' : 'ghost'}
                    className='w-full justify-start gap-2'
                    onClick={() => setActiveSection(section.id)}
                  >
                    <IconComponent className='size-4' />
                    {section.label}
                  </Button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className='flex-1 pt-4 pb-6'>
          {activeSection === 'metrics' && <MetricsGuide />}
          {activeSection === 'formulas' && <FormulasReference />}
          {activeSection === 'constants' && <ConstantsGuide />}
          {activeSection === 'functions' && <FunctionsReference />}
        </div>
      </Main>
    </>
  )
}

function MetricsGuide() {
  return (
    <div className='space-y-6 max-w-3xl'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Guía Completa de Métricas</h1>
        <p className='text-muted-foreground'>
          Aprende cómo crear y configurar métricas personalizadas en tu dashboard
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>¿Qué es una Métrica?</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p>
            Una métrica es un cálculo personalizado basado en los datos de tu base de datos. Permite:
          </p>
          <ul className='list-disc list-inside space-y-2 text-sm'>
            <li>Extraer información específica (mes, año, día de una fecha)</li>
            <li>Realizar cálculos matemáticos sobre columnas</li>
            <li>Comparar contra objetivos o constantes</li>
            <li>Crear indicadores clave (KPIs) complejos</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paso a Paso: Crear una Métrica</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-3'>
            <div className='border-l-4 border-primary pl-4 py-2'>
              <h4 className='font-semibold mb-1'>Paso 1: Acceder al Widget</h4>
              <p className='text-sm text-muted-foreground'>
                En tu dashboard, haz clic en "Agregar Widget" o edita uno existente
              </p>
            </div>

            <div className='border-l-4 border-primary pl-4 py-2'>
              <h4 className='font-semibold mb-1'>Paso 2: Seleccionar Tipo de Widget</h4>
              <p className='text-sm text-muted-foreground'>
                Elige el tipo de visualización (KPI, Gráfica, Tabla, etc.)
              </p>
            </div>

            <div className='border-l-4 border-primary pl-4 py-2'>
              <h4 className='font-semibold mb-1'>Paso 3: Configurar la Consulta</h4>
              <p className='text-sm text-muted-foreground mb-2'>
                Selecciona tu tabla y columnas. Para fórmulas personalizadas, usa el campo de fórmula
              </p>
              <div className='bg-muted p-2 rounded text-xs font-mono'>
                Example: MONTH(fecha_venta)
              </div>
            </div>

            <div className='border-l-4 border-primary pl-4 py-2'>
              <h4 className='font-semibold mb-1'>Paso 4: Usar Constantes (Opcional)</h4>
              <p className='text-sm text-muted-foreground mb-2'>
                Puedes referenciar constantes como venta_objetivo:
              </p>
              <div className='bg-muted p-2 rounded text-xs font-mono'>
                venta_total / venta_objetivo * 100
              </div>
            </div>

            <div className='border-l-4 border-primary pl-4 py-2'>
              <h4 className='font-semibold mb-1'>Paso 5: Guardar</h4>
              <p className='text-sm text-muted-foreground'>
                Haz clic en "Guardar" para aplicar la métrica a tu widget
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplo Práctico: Ventas por Mes</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div>
            <p className='text-sm font-semibold mb-2'>Objetivo: Mostrar ventas totales de cada mes</p>
            <div className='bg-muted p-3 rounded'>
              <p className='text-xs text-muted-foreground mb-1'>Fórmula:</p>
              <p className='font-mono text-sm'>MONTH(fecha_venta)</p>
            </div>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mt-4'>
              Esto agrupará automáticamente las ventas por mes (1-12)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplo Práctico: Concatenar Columnas (ej. Ruta = Origen + Destino)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div>
            <p className='text-sm font-semibold mb-2'>
              Objetivo: mostrar "Origen - Destino" como una sola columna "Ruta"
            </p>
            <div className='bg-muted p-3 rounded'>
              <p className='text-xs text-muted-foreground mb-1'>Fórmula (con el operador +):</p>
              <p className='font-mono text-sm mb-3'>origen + " - " + destino</p>
              <p className='text-xs text-muted-foreground mb-1'>O con la función CONCAT:</p>
              <p className='font-mono text-sm'>CONCAT(origen, " - ", destino)</p>
            </div>
          </div>
          <p className='text-xs text-muted-foreground mt-4'>
            Si origen="Bogotá" y destino="Cali": resultado = "Bogotá - Cali"
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplo Práctico: Porcentaje Alcanzado de Meta</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div>
            <p className='text-sm font-semibold mb-2'>Objetivo: Mostrar % de meta cumplida</p>
            <div className='bg-muted p-3 rounded'>
              <p className='text-xs text-muted-foreground mb-1'>Primero, define la constante:</p>
              <p className='font-mono text-sm mb-3'>venta_objetivo = 50000</p>
              <p className='text-xs text-muted-foreground mb-1'>Luego, usa esta fórmula:</p>
              <p className='font-mono text-sm'>(venta_total / venta_objetivo) * 100</p>
            </div>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mt-4'>
              Si vendiste 35,000: (35000 / 50000) * 100 = 70%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FormulasReference() {
  return (
    <div className='space-y-6 max-w-3xl'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Lenguaje de Fórmulas</h1>
        <p className='text-muted-foreground'>
          El sistema usa un lenguaje similar a Excel/Google Sheets
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Características Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className='space-y-2 text-sm'>
            <li className='flex gap-2'>
              <Badge>Sintaxis</Badge>
              <span>Similar a Excel y Google Sheets</span>
            </li>
            <li className='flex gap-2'>
              <Badge>Operadores</Badge>
              <span>+, -, *, /, %, comparadores (==, !=, &lt;, &gt;, &lt;=, &gt;=)</span>
            </li>
            <li className='flex gap-2'>
              <Badge>Concatenar texto</Badge>
              <span>El operador + une texto (columna1 + " " + columna2), o usa CONCAT(...)</span>
            </li>
            <li className='flex gap-2'>
              <Badge>Funciones</Badge>
              <span>SUM, AVG, COUNT, MAX, MIN, DISTINCTCOUNT, IF, ROUND, ABS, COALESCE, CONCAT, YEAR, MONTH, DAY, UPPER, LOWER</span>
            </li>
            <li className='flex gap-2'>
              <Badge>Variables</Badge>
              <span>Puedes referenciar columnas y constantes</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operadores Soportados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>+</p>
                <p className='text-muted-foreground'>Suma</p>
              </div>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>-</p>
                <p className='text-muted-foreground'>Resta</p>
              </div>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>*</p>
                <p className='text-muted-foreground'>Multiplicación</p>
              </div>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>/</p>
                <p className='text-muted-foreground'>División</p>
              </div>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>%</p>
                <p className='text-muted-foreground'>Módulo</p>
              </div>
              <div>
                <p className='font-mono bg-muted p-2 rounded mb-1'>==, &lt;, &gt;, &lt;=, &gt;=, !=</p>
                <p className='text-muted-foreground'>Comparación (igualdad es == , no =)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orden de Operaciones</CardTitle>
        </CardHeader>
        <CardContent className='text-sm space-y-2'>
          <p>Como en Excel, se respeta el siguiente orden:</p>
          <ol className='list-decimal list-inside space-y-1'>
            <li>Paréntesis ()</li>
            <li>Funciones</li>
            <li>Multiplicación y División</li>
            <li>Suma y Resta</li>
            <li>Comparadores</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function ConstantsGuide() {
  return (
    <div className='space-y-6 max-w-3xl'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Constantes y Variables</h1>
        <p className='text-muted-foreground'>
          Define valores fijos que puedas reutilizar en múltiples fórmulas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>¿Qué es una Constante?</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 text-sm'>
          <p>
            Una constante es un valor fijo que definas una sola vez y puedas usar en múltiples fórmulas.
            Ejemplos comunes:
          </p>
          <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
            <li>venta_objetivo: 50000</li>
            <li>aumento_esperado: 0.15 (15%)</li>
            <li>margen_minimo: 0.20 (20%)</li>
            <li>max_clientes: 1000</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo Definir una Constante</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 text-sm'>
          <p className='font-semibold'>En el formulario de configuración del widget:</p>
          <div className='bg-muted p-3 rounded space-y-2'>
            <p className='text-xs text-muted-foreground'>Nombre: venta_objetivo</p>
            <p className='text-xs text-muted-foreground'>Valor: 50000</p>
          </div>
          <p className='text-muted-foreground mt-3'>
            Luego puedes usarla en cualquier fórmula simplemente escribiendo su nombre
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplos de Uso</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          <div>
            <p className='font-semibold mb-2'>Ejemplo 1: Porcentaje de Meta</p>
            <div className='bg-muted p-3 rounded font-mono text-xs'>
              <p className='mb-1'>venta_objetivo = 50000</p>
              <p className='text-muted-foreground'>(venta_total / venta_objetivo) * 100</p>
            </div>
          </div>

          <div>
            <p className='font-semibold mb-2'>Ejemplo 2: Ganancia Esperada</p>
            <div className='bg-muted p-3 rounded font-mono text-xs'>
              <p className='mb-1'>aumento_esperado = 0.15</p>
              <p className='text-muted-foreground'>venta_total * (1 + aumento_esperado)</p>
            </div>
          </div>

          <div>
            <p className='font-semibold mb-2'>Ejemplo 3: Verificar Mínimo</p>
            <div className='bg-muted p-3 rounded font-mono text-xs'>
              <p className='mb-1'>margen_minimo = 0.20</p>
              <p className='text-muted-foreground'>IF(margen &gt;= margen_minimo, "OK", "Bajo")</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ventajas de Usar Constantes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className='space-y-2 text-sm'>
            <li className='flex gap-2'>
              <Badge variant='outline'>Reutilización</Badge>
              <span>Define una vez, usa en muchas fórmulas</span>
            </li>
            <li className='flex gap-2'>
              <Badge variant='outline'>Mantenimiento</Badge>
              <span>Cambia el valor en un solo lugar</span>
            </li>
            <li className='flex gap-2'>
              <Badge variant='outline'>Claridad</Badge>
              <span>Nombres descriptivos hacen fórmulas legibles</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function FunctionsReference() {
  const functions = [
    {
      name: 'MONTH',
      category: 'Fecha',
      description: 'Extrae el mes de una fecha. Acepta formato opcional (MM=mes con 0, M=mes sin 0, nombre_mes).',
      example: 'MONTH(fecha_venta) → 5 | MONTH(fecha_venta, "MM") → 05 | MONTH(fecha_venta, "MMMM") → Mayo',
    },
    {
      name: 'YEAR',
      category: 'Fecha',
      description: 'Extrae el año de una fecha. Acepta formato opcional (YYYY=4 dígitos, YY=2 dígitos).',
      example: 'YEAR(fecha_venta) → 2024 | YEAR(fecha_venta, "YYYY") → 2024 | YEAR(fecha_venta, "YY") → 24',
    },
    {
      name: 'DAY',
      category: 'Fecha',
      description: 'Extrae el día del mes. Acepta formato opcional (DD=día con 0, D=día sin 0).',
      example: 'DAY(fecha_venta) → 15 | DAY(fecha_venta, "DD") → 05 | DAY(fecha_venta, "D") → 5',
    },
    {
      name: 'SUM',
      category: 'Agregación',
      description: 'Suma todos los valores',
      example: 'SUM(ventas) → 150000',
    },
    {
      name: 'AVG',
      category: 'Agregación',
      description: 'Calcula el promedio',
      example: 'AVG(precios) → 250.50',
    },
    {
      name: 'COUNT',
      category: 'Agregación',
      description: 'Cuenta la cantidad de registros',
      example: 'COUNT(id) → 1250',
    },
    {
      name: 'MAX',
      category: 'Agregación',
      description: 'Encuentra el valor máximo',
      example: 'MAX(ventas) → 5000',
    },
    {
      name: 'MIN',
      category: 'Agregación',
      description: 'Encuentra el valor mínimo',
      example: 'MIN(ventas) → 100',
    },
    {
      name: 'ROUND',
      category: 'Matemática',
      description: 'Redondea a N decimales',
      example: 'ROUND(valor, 2) → 123.45',
    },
    {
      name: 'ABS',
      category: 'Matemática',
      description: 'Valor absoluto',
      example: 'ABS(-50) → 50',
    },
    {
      name: 'IF',
      category: 'Lógica',
      description: 'Condicional: IF(condición, si_verdadero, si_falso)',
      example: 'IF(ventas > 10000, "Excelente", "Bueno")',
    },
    {
      name: 'UPPER',
      category: 'Texto',
      description: 'Convierte a mayúsculas',
      example: 'UPPER(nombre) → "JUAN"',
    },
    {
      name: 'LOWER',
      category: 'Texto',
      description: 'Convierte a minúsculas',
      example: 'LOWER(nombre) → "juan"',
    },
    {
      name: 'CONCAT',
      category: 'Texto',
      description: 'Une dos o más valores en un solo texto',
      example: 'CONCAT(origen, " - ", destino) → "Bogotá - Cali"',
    },
    {
      name: 'DISTINCTCOUNT',
      category: 'Agregación',
      description: 'Cuenta valores distintos (no repetidos)',
      example: 'DISTINCTCOUNT(cliente) → 48',
    },
    {
      name: 'COALESCE',
      category: 'Lógica',
      description: 'Retorna el primer valor no nulo/vacío de la lista',
      example: 'COALESCE(descuento, 0) → 0',
    },
  ]

  const categories = [...new Set(functions.map((f) => f.category))]

  return (
    <div className='space-y-6 max-w-3xl'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Funciones Disponibles</h1>
        <p className='text-muted-foreground'>
          Todas las funciones que puedes usar en tus fórmulas
        </p>
      </div>

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className='text-lg'>{category}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {functions
              .filter((f) => f.category === category)
              .map((func) => (
                <div key={func.name} className='border-b pb-4 last:border-0'>
                  <div className='flex items-start justify-between mb-2'>
                    <code className='bg-muted px-2 py-1 rounded font-bold text-sm'>
                      {func.name}()
                    </code>
                    <Badge variant='outline'>{category}</Badge>
                  </div>
                  <p className='text-sm mb-2'>{func.description}</p>
                  <div className='bg-muted p-2 rounded'>
                    <p className='font-mono text-xs'>{func.example}</p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Notas Importantes</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <p>
            • Los nombres de funciones son <strong>case-insensitive</strong> (MONTH = month)
          </p>
          <p>
            • Los nombres de columnas y constantes son <strong>case-sensitive</strong>
          </p>
          <p>
            • Las fechas deben estar en formato ISO (YYYY-MM-DD)
          </p>
          <p>
            • Usa comillas para valores de texto: "ejemplo"
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
