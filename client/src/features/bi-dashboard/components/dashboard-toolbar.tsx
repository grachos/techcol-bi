import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronsUpDown,
  Edit3,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { dashboardApi, type DashboardSummary } from '@/lib/dashboard-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShareDashboardDialog } from './share-dashboard-dialog'

interface DashboardToolbarProps {
  dashboards: DashboardSummary[]
  selectedId: number | null
  onSelect: (id: number) => void
  onChanged: () => void
  onAddWidget: () => void
  isEditing: boolean
  onToggleEditing: (editing: boolean) => void
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function DashboardToolbar({
  dashboards,
  selectedId,
  onSelect,
  onChanged,
  onAddWidget,
  isEditing,
  onToggleEditing,
}: DashboardToolbarProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tab, setTab] = useState<'favorites' | 'explore'>('favorites')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [name, setName] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = dashboards.find((d) => d.id === selectedId)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    dashboards.forEach((d) => d.tags.forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [dashboards])

  const favorites = dashboards.filter((d) => d.isFavorite)

  const filteredExplore = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dashboards.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.tags.some((tag) => tag.toLowerCase().includes(q))
      const matchesTag = !activeTag || d.tags.includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [dashboards, search, activeTag])

  const handleToggleFavorite = async (d: DashboardSummary) => {
    try {
      await dashboardApi.update(d.id, { isFavorite: !d.isFavorite })
      onChanged()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const created = await dashboardApi.create(name, parseTagsInput(tagsInput))
      toast.success(t('Dashboard "{{name}}" created', { name }))
      setCreateOpen(false)
      setName('')
      setTagsInput('')
      onChanged()
      onSelect(created.id)
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!name.trim() || !selectedId) return
    setSaving(true)
    try {
      await dashboardApi.update(selectedId, {
        name,
        tags: parseTagsInput(tagsInput),
      })
      toast.success(t('Dashboard updated'))
      setEditOpen(false)
      onChanged()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId || !selected) return
    if (
      !window.confirm(
        t('Delete dashboard "{{name}}"? This cannot be undone.', {
          name: selected.name,
        })
      )
    )
      return
    try {
      await dashboardApi.remove(selectedId)
      toast.success(t('Dashboard deleted'))
      onChanged()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    }
  }

  const renderList = (list: DashboardSummary[], emptyHint: string) => (
    <div className='max-h-72 space-y-1 overflow-y-auto p-1'>
      {list.length === 0 && (
        <p className='text-muted-foreground p-3 text-center text-sm'>
          {emptyHint}
        </p>
      )}
      {list.map((d) => (
        <div
          key={d.id}
          className={cn(
            'hover:bg-accent flex items-center gap-2 rounded-md p-2 text-sm',
            d.id === selectedId && 'bg-accent'
          )}
        >
          <button
            type='button'
            className='shrink-0'
            onClick={() => handleToggleFavorite(d)}
            title={
              d.isFavorite ? t('Remove from favorites') : t('Add to favorites')
            }
          >
            <Star
              size={16}
              className={cn(
                d.isFavorite
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
          <button
            type='button'
            className='flex flex-1 flex-col items-start truncate text-start'
            onClick={() => {
              onSelect(d.id)
              setPickerOpen(false)
            }}
          >
            <span className='truncate font-medium'>{d.name}</span>
            {d.tags.length > 0 && (
              <span className='flex flex-wrap gap-1'>
                {d.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant='outline'
                    className='px-1 text-[10px]'
                  >
                    #{tag}
                  </Badge>
                ))}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant='outline' className='w-64 justify-between'>
            <span className='flex items-center gap-1 truncate'>
              {selected?.isFavorite && (
                <Star size={14} className='fill-yellow-400 text-yellow-400' />
              )}
              {selected?.name ?? t('Choose a dashboard')}
            </span>
            <ChevronsUpDown className='size-4 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-80 p-2' align='start'>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className='w-full'>
              <TabsTrigger value='favorites' className='flex-1'>
                <Star size={14} className='me-1' /> {t('Favorites')}
              </TabsTrigger>
              <TabsTrigger value='explore' className='flex-1'>
                <Search size={14} className='me-1' /> {t('Explore')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'favorites' &&
            renderList(
              favorites,
              t(
                'No favorites yet. Star a dashboard in "Explore" to pin it here.'
              )
            )}

          {tab === 'explore' && (
            <div className='space-y-2 pt-2'>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search dashboards or tags…')}
                className='h-8'
              />
              {allTags.length > 0 && (
                <div className='flex flex-wrap gap-1'>
                  {allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={activeTag === tag ? 'default' : 'outline'}
                      className='cursor-pointer px-1.5 text-[10px]'
                      onClick={() =>
                        setActiveTag((prev) => (prev === tag ? null : tag))
                      }
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              {renderList(filteredExplore, t('No dashboards match your search.'))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant='outline'
        size='icon'
        disabled={!selected}
        onClick={() => {
          setName(selected?.name ?? '')
          setTagsInput(selected?.tags.join(', ') ?? '')
          setEditOpen(true)
        }}
        title={t('Edit dashboard')}
      >
        <Pencil size={16} />
      </Button>
      <Button
        variant='outline'
        size='icon'
        disabled={!selected}
        onClick={() => setShareOpen(true)}
        title={t('Share dashboard')}
      >
        <Share2 size={16} />
      </Button>
      <Button
        variant='outline'
        size='icon'
        disabled={!selected || dashboards.length <= 1}
        onClick={handleDelete}
        title={t('Delete dashboard')}
      >
        <Trash2 size={16} />
      </Button>
      <Button
        variant='outline'
        onClick={() => {
          setName('')
          setTagsInput('')
          setCreateOpen(true)
        }}
      >
        <Plus size={16} /> {t('New dashboard')}
      </Button>

      {isEditing ? (
        <Button
          className='ms-auto'
          onClick={() => onToggleEditing(false)}
        >
          <Save size={16} /> {t('Save layout')}
        </Button>
      ) : (
        <Button
          variant='outline'
          className='ms-auto'
          onClick={() => onToggleEditing(true)}
          disabled={!selected}
        >
          <Edit3 size={16} /> {t('Edit layout')}
        </Button>
      )}

      <Button onClick={onAddWidget} disabled={!selected || !isEditing}>
        <Plus size={16} /> {t('Add widget')}
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>{t('New dashboard')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Dashboard name')}
              autoFocus
            />
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t('Tags, comma-separated (optional)')}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>{t('Edit dashboard')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Dashboard name')}
              autoFocus
            />
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t('Tags, comma-separated (optional)')}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <ShareDashboardDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          dashboardId={selected.id}
          dashboardName={selected.name}
        />
      )}
    </div>
  )
}
