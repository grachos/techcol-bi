import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import { canAccessPath } from '@/lib/access'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { type NavGroup as NavGroupType, type NavItem } from './types'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { type AuthUser } from '@/lib/auth-api'

// Deja solo los items que el usuario puede abrir (los colapsables se filtran
// por sus subitems). Los grupos que quedan vacios se descartan.
function filterNavGroups(
  groups: NavGroupType[],
  user: AuthUser | null
): NavGroupType[] {
  return groups
    .map((group) => {
      const items = group.items.filter((item: NavItem) => {
        if ('url' in item && item.url) return canAccessPath(user, String(item.url))
        if ('items' in item && item.items) {
          return item.items.some((sub) => canAccessPath(user, String(sub.url)))
        }
        return false
      })
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((s) => s.auth.user)
  const navGroups = filterNavGroups(sidebarData.navGroups, user)
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
