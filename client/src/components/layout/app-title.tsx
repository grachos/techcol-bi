import { Link } from '@tanstack/react-router'
import { ChartColumn } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-2.5 py-1 hover:bg-transparent active:bg-transparent cursor-pointer'
          asChild
        >
          <Link
            to='/'
            onClick={() => setOpenMobile(false)}
            className='flex items-center gap-2.5 flex-1 overflow-hidden'
          >
            <div className='bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shrink-0 shadow-xs'>
              <ChartColumn className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight overflow-hidden'>
              <span className='truncate font-semibold text-foreground'>BI-TechCol</span>
              <span className='truncate text-xs text-muted-foreground'>Business Intelligence</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
