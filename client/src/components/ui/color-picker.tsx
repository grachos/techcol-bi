import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// --- Helper Functions for HSV / HEX / RGB / HSL Conversions ---

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function hsvToHex(h: number, s: number, v: number): string {
  s /= 100
  v /= 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0,
    g = 0,
    b = 0

  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (clean.length !== 6) return { h: 0, s: 100, v: 100 }

  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : Math.round((d / max) * 100)
  const v = Math.round(max * 100)

  return { h, s, v }
}

export function hexToRgbStr(hex: string): string {
  let clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (clean.length !== 6) return '245, 73, 39'
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export interface ColorPickerProps {
  value: string
  onChange: (hexColor: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const initialHsv = hexToHsv(value.startsWith('#') ? value : '#F54927')
  const [hsv, setHsv] = useState(initialHsv)
  const [format, setFormat] = useState<'Hex' | 'RGB' | 'HSL'>('Hex')
  const [copied, setCopied] = useState(false)

  const satBoxRef = useRef<HTMLDivElement>(null)
  const hueSliderRef = useRef<HTMLDivElement>(null)

  // Keep HSV in sync if external value changes (e.g. preset selection)
  useEffect(() => {
    if (value.startsWith('#')) {
      const parsed = hexToHsv(value)
      setHsv(parsed)
    }
  }, [value])

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v)

  const updateHsv = useCallback(
    (newHsv: Partial<{ h: number; s: number; v: number }>) => {
      setHsv((prev) => {
        const next = { ...prev, ...newHsv }
        const hex = hsvToHex(next.h, next.s, next.v)
        onChange(hex)
        return next
      })
    },
    [onChange]
  )

  // Saturation / Value Drag Handler
  const handleSatPointer = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!satBoxRef.current) return
      const rect = satBoxRef.current.getBoundingClientRect()
      const x = clamp(e.clientX - rect.left, 0, rect.width)
      const y = clamp(e.clientY - rect.top, 0, rect.height)

      const s = Math.round((x / rect.width) * 100)
      const v = Math.round((1 - y / rect.height) * 100)

      updateHsv({ s, v })
    },
    [updateHsv]
  )

  const onSatPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    handleSatPointer(e)
  }

  const onSatPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) {
      handleSatPointer(e)
    }
  }

  // Hue Slider Drag Handler
  const handleHuePointer = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!hueSliderRef.current) return
      const rect = hueSliderRef.current.getBoundingClientRect()
      const x = clamp(e.clientX - rect.left, 0, rect.width)
      const h = Math.round((x / rect.width) * 360) % 360
      updateHsv({ h })
    },
    [updateHsv]
  )

  const onHuePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    handleHuePointer(e)
  }

  const onHuePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) {
      handleHuePointer(e)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentHex)
    setCopied(true)
    toast.success(`Color ${currentHex} copiado`)
    setTimeout(() => setCopied(false), 1500)
  }

  const pureHueHex = hsvToHex(hsv.h, 100, 100)

  return (
    <div
      className={cn(
        'w-full max-w-[340px] rounded-xl border bg-card p-3.5 shadow-md flex flex-col gap-3 select-none',
        className
      )}
    >
      {/* 2D Saturation / Value Canvas */}
      <div
        ref={satBoxRef}
        onPointerDown={onSatPointerDown}
        onPointerMove={onSatPointerMove}
        className='relative h-44 w-full rounded-lg cursor-crosshair overflow-hidden border shadow-inner'
        style={{
          backgroundColor: pureHueHex,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        {/* Pointer ring cursor */}
        <div
          className='pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30 transition-transform duration-75'
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Rainbow Hue Slider */}
      <div
        ref={hueSliderRef}
        onPointerDown={onHuePointerDown}
        onPointerMove={onHuePointerMove}
        className='relative h-4 w-full rounded-full cursor-pointer shadow-inner border overflow-visible'
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        {/* Hue pointer ring handle */}
        <div
          className='pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/4 rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/20'
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            backgroundColor: pureHueHex,
          }}
        />
      </div>

      {/* Bottom Bar: Color Preview, Code Input, Copy, Format Selector */}
      <div className='flex items-center gap-2 pt-1'>
        {/* Color preview circle */}
        <div
          className='size-7 rounded-full border border-black/10 shadow-xs shrink-0'
          style={{ backgroundColor: currentHex }}
        />

        {/* Input box */}
        <div className='relative flex-1 flex items-center'>
          <span className='absolute left-2.5 text-xs text-muted-foreground font-mono'>#</span>
          <Input
            value={currentHex.replace('#', '')}
            onChange={(e) => {
              const val = e.target.value.trim()
              if (/^[0-9A-Fa-f]{6}$/.test(val)) {
                onChange(`#${val.toUpperCase()}`)
              }
            }}
            className='pl-6 pr-8 h-8 font-mono text-xs font-semibold tracking-wider uppercase'
            maxLength={6}
          />
          <button
            type='button'
            onClick={handleCopy}
            title='Copiar código de color'
            className='absolute right-2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer'
          >
            {copied ? <Check className='size-3.5 text-emerald-500' /> : <Copy className='size-3.5' />}
          </button>
        </div>

        {/* Format selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' className='h-8 px-2.5 text-xs gap-1 font-medium'>
              {format}
              <ChevronDown className='size-3 opacity-60' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => setFormat('Hex')}>Hex</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFormat('RGB')}>RGB</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFormat('HSL')}>HSL</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
