import {
  Cable,
  ChartColumn,
  Users,
  HelpCircle,
  Layers,
  Table2,
  LayoutGrid,
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
      logo: ChartColumn,
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
        {
          title: 'Dashboards',
          url: '/dashboard',
          icon: LayoutGrid,
        },
      ],
    },
    {
      title: 'Labs',
      items: [
        {
          title: 'Semantic Layer',
          url: '/semantic-layer-demo',
          icon: Layers,
        },
        {
          title: 'TreeGrid',
          url: '/tree-grid-demo',
          icon: Table2,
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
