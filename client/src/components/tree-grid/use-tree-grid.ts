import { useCallback, useMemo, useState } from 'react'
import { applyColumnFilter, isFilterActive } from './filtering'
import type {
  ColumnFilterValue,
  FlatRow,
  ResolvedTreeGridColumn,
  SortDirection,
  TreeGridColumn,
  TreeGridGroupLevel,
} from './types'

interface GroupNode<TRow> {
  key: string
  label: string
  depth: number
  children: GroupNode<TRow>[]
  leaves: TRow[]
}

function buildGroupTree<TRow>(
  rows: TRow[],
  groupBy: TreeGridGroupLevel<TRow>[],
  levelIndex = 0,
  parentKey = 'root'
): GroupNode<TRow>[] {
  if (levelIndex >= groupBy.length) return []
  const level = groupBy[levelIndex]
  const buckets = new Map<string, TRow[]>()

  for (const row of rows) {
    const bucketKey = level.accessor(row)
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, [])
    buckets.get(bucketKey)!.push(row)
  }

  return Array.from(buckets.entries()).map(([label, groupRows]) => {
    const key = `${parentKey}/${level.id}:${label}`
    return {
      key,
      label,
      depth: levelIndex,
      leaves: groupRows,
      children: buildGroupTree(groupRows, groupBy, levelIndex + 1, key),
    }
  })
}

function collectExpandedKeys<TRow>(
  nodes: GroupNode<TRow>[],
  maxDepth: number,
  acc: Set<string>
) {
  for (const node of nodes) {
    if (node.depth < maxDepth) {
      acc.add(node.key)
      collectExpandedKeys(node.children, maxDepth, acc)
    }
  }
}

function collectLeaves<TRow>(node: GroupNode<TRow>): TRow[] {
  return node.children.length > 0 ? node.children.flatMap(collectLeaves) : node.leaves
}

interface UseTreeGridOptions<TRow> {
  data: TRow[]
  columns: TreeGridColumn<TRow>[]
  groupBy?: TreeGridGroupLevel<TRow>[]
  getRowId?: (row: TRow) => string
  defaultExpandedDepth?: number
}

export function useTreeGrid<TRow>({
  data,
  columns,
  groupBy = [],
  getRowId,
  defaultExpandedDepth = 1,
}: UseTreeGridOptions<TRow>) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.id))
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.visible === false).map((c) => c.id))
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.id, c.width ?? 140]))
  )
  const [sort, setSortState] = useState<{ columnId: string; direction: SortDirection } | null>(null)
  const [filters, setFilters] = useState<Record<string, ColumnFilterValue>>({})
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (groupBy.length === 0) return new Set()
    const acc = new Set<string>()
    collectExpandedKeys(buildGroupTree(data, groupBy), defaultExpandedDepth, acc)
    return acc
  })

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])

  const setColumnWidth = useCallback((id: string, width: number) => {
    const column = columnsById.get(id)
    const min = column?.minWidth ?? 60
    const max = column?.maxWidth ?? 800
    setColumnWidths((prev) => ({ ...prev, [id]: Math.min(max, Math.max(min, width)) }))
  }, [columnsById])

  const reorderColumn = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setColumnOrder((prev) => {
      const next = prev.filter((id) => id !== draggedId)
      const targetIndex = next.indexOf(targetId)
      next.splice(targetIndex, 0, draggedId)
      return next
    })
  }, [])

  const toggleColumnVisibility = useCallback((id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: 'asc' }
      if (prev.direction === 'asc') return { columnId, direction: 'desc' }
      return null
    })
  }, [])

  const setFilter = useCallback((columnId: string, value: ColumnFilterValue) => {
    setFilters((prev) => ({ ...prev, [columnId]: value }))
  }, [])

  const clearFilters = useCallback(() => setFilters({}), [])

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const resolvedColumns = useMemo<ResolvedTreeGridColumn<TRow>[]>(() => {
    const ordered = columnOrder
      .map((id) => columnsById.get(id))
      .filter((c): c is TreeGridColumn<TRow> => !!c && !hiddenColumns.has(c.id))

    const left = ordered.filter((c) => c.pinned === 'left')
    const right = ordered.filter((c) => c.pinned === 'right')
    const center = ordered.filter((c) => !c.pinned)
    const final = [...left, ...center, ...right]

    let leftOffset = 0
    const leftOffsets = new Map<string, number>()
    for (const c of left) {
      leftOffsets.set(c.id, leftOffset)
      leftOffset += columnWidths[c.id] ?? c.width ?? 140
    }

    let rightOffset = 0
    const rightOffsets = new Map<string, number>()
    for (let i = right.length - 1; i >= 0; i--) {
      const c = right[i]
      rightOffsets.set(c.id, rightOffset)
      rightOffset += columnWidths[c.id] ?? c.width ?? 140
    }

    return final.map((c) => ({
      ...c,
      width: columnWidths[c.id] ?? c.width ?? 140,
      stickyLeft: leftOffsets.get(c.id),
      stickyRight: rightOffsets.get(c.id),
    }))
  }, [columnOrder, hiddenColumns, columnWidths, columnsById])

  const filteredLeaves = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => isFilterActive(v))
    if (activeFilters.length === 0) return data
    return data.filter((row) =>
      activeFilters.every(([columnId, value]) => {
        const column = columnsById.get(columnId)
        if (!column) return true
        return applyColumnFilter(column.accessor(row), value, column.type ?? 'text')
      })
    )
  }, [data, filters, columnsById])

  const sortedLeaves = useMemo(() => {
    if (!sort || !sort.direction) return filteredLeaves
    const column = columnsById.get(sort.columnId)
    if (!column) return filteredLeaves
    const dir = sort.direction === 'asc' ? 1 : -1

    return [...filteredLeaves].sort((a, b) => {
      const av = column.accessor(a)
      const bv = column.accessor(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filteredLeaves, sort, columnsById])

  const tree = useMemo(() => {
    if (groupBy.length === 0) return null
    return buildGroupTree(sortedLeaves, groupBy)
  }, [sortedLeaves, groupBy])

  const flatRows = useMemo<FlatRow<TRow>[]>(() => {
    const out: FlatRow<TRow>[] = []

    function walk(nodes: GroupNode<TRow>[], depth: number) {
      for (const node of nodes) {
        const isExpanded = expanded.has(node.key)
        const groupLeaves = collectLeaves(node)
        out.push({
          key: node.key,
          depth,
          isGroup: true,
          label: node.label,
          count: groupLeaves.length,
          groupRows: groupLeaves,
          expanded: isExpanded,
        })
        if (!isExpanded) continue
        if (node.children.length > 0) {
          walk(node.children, depth + 1)
        } else {
          for (const leaf of node.leaves) {
            out.push({
              key: getRowId ? getRowId(leaf) : `${node.key}/${out.length}`,
              depth: depth + 1,
              isGroup: false,
              data: leaf,
            })
          }
        }
      }
    }

    if (tree) {
      walk(tree, 0)
    } else {
      for (const leaf of sortedLeaves) {
        out.push({
          key: getRowId ? getRowId(leaf) : `row/${out.length}`,
          depth: 0,
          isGroup: false,
          data: leaf,
        })
      }
    }

    return out
  }, [tree, expanded, sortedLeaves, getRowId])

  const expandAll = useCallback(() => {
    if (!tree) return
    const all = new Set<string>()
    function walk(nodes: GroupNode<TRow>[]) {
      for (const node of nodes) {
        all.add(node.key)
        walk(node.children)
      }
    }
    walk(tree)
    setExpanded(all)
  }, [tree])

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  return {
    resolvedColumns,
    flatRows,
    filteredLeafRows: sortedLeaves,
    filteredLeafCount: sortedLeaves.length,
    totalLeafCount: data.length,
    sort,
    setSort,
    filters,
    setFilter,
    clearFilters,
    hiddenColumns,
    toggleColumnVisibility,
    reorderColumn,
    setColumnWidth,
    toggleExpand,
    expandAll,
    collapseAll,
  }
}
