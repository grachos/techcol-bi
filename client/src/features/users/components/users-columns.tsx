import { type ColumnDef } from '@tanstack/react-table'
import { type TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { callTypes, roles } from '../data/data'
import { type User } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export function getUsersColumns(t: TFunction): ColumnDef<User>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-0.5'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-0.5'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ row }) => (
        <LongText className='max-w-48 ps-3'>{row.original.name ?? '—'}</LongText>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Email')} />
      ),
      cell: ({ row }) => (
        <div className='w-fit ps-2 text-nowrap'>{row.getValue('email')}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const { status } = row.original
        const badgeColor = callTypes.get(status)
        return (
          <Badge variant='outline' className={cn('capitalize', badgeColor)}>
            {t(status)}
          </Badge>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      enableSorting: false,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Role')} />
      ),
      cell: ({ row }) => {
        const userType = roles.find(({ value }) => value === row.original.role)
        if (!userType) return null
        return (
          <div className='flex items-center gap-x-2' title={userType.description}>
            {userType.icon && (
              <userType.icon size={16} className='text-muted-foreground' />
            )}
            <span className='text-sm'>{t(userType.label)}</span>
          </div>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      enableSorting: false,
    },
    {
      id: 'permissions',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Permissions')} />
      ),
      cell: ({ row }) => {
        const { role, permissions } = row.original
        if (role === 'admin') {
          return <Badge variant='default'>{t('Full Access')}</Badge>
        }
        const dashboards = permissions?.dashboardIds?.length ?? 0
        const pages = permissions?.pageNames?.length ?? 0
        if (dashboards === 0 && pages === 0) {
          return <Badge variant='outline'>{t('No access')}</Badge>
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {dashboards > 0 && (
              <Badge variant='secondary'>
                {dashboards} {t('Dashboard(s)')}
              </Badge>
            )}
            {pages > 0 && (
              <Badge variant='secondary'>
                {pages} {t('Page(s)')}
              </Badge>
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      cell: DataTableRowActions,
    },
  ]
}
