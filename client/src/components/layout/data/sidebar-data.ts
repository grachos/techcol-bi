import {
  Cable,
  ChartColumn,
  Users,
  HelpCircle,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: 'demo@bi-techcol.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'BI-TechCol',
      logo: Command,
      plan: 'Business Intelligence',
    },
  ],
  navGroups: [
    {
      title: 'Business Intelligence',
      items: [
        {
          title: 'BI Dashboard',
          url: '/bi',
          icon: ChartColumn,
        },
        {
          title: 'Connectors',
          url: '/connectors',
          icon: Cable,
        },
      ],
    },
    {
      title: 'General',
      items: [
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
