import { createMongoAbility } from '@casl/ability'

const emailRouteComponent = () => import('@/pages/template/apps/email/index.vue')

// Ordered map: back-office screen (CASL subject) -> landing route name.
// The first screen the user is allowed to read becomes their landing page.
// Each screen subject maps to a route whose page declares that same subject,
// so the landing route is always one the user is actually allowed to open.
const screenLandingRoutes = [
  ['dashboard', 'dashboard'],
  ['events', 'events'],
  ['bookings', 'orders'],
  ['payments', 'payments'],
  ['promotions', 'promotions'],
  ['tickets', 'tickets'],
  ['coupons', 'coupons'],
  ['categories', 'categories'],
  ['venues', 'venues'],
  ['organizers', 'organizers'],
  ['users', 'users'],
  ['withdrawals', 'withdrawals'],
  ['notifications', 'notifications'],
  ['administrators', 'roles'],
]

// Picks the first route the current user is allowed to see, based on the
// ability rules persisted at login / on the last /me refresh.
export const resolveLandingRoute = () => {
  const rules = useCookie('userAbilityRules').value ?? []
  const ability = createMongoAbility(rules)
  const match = screenLandingRoutes.find(([subject]) => ability.can('read', subject))

  return match ? { name: match[1] } : null
}

// 👉 Redirects
export const redirects = [
  // ℹ️ Real ACL is ability-based; the landing page is the first screen the
  // user is allowed to access.
  {
    path: '/',
    name: 'index',
    redirect: to => {
      const isLoggedIn = !!(useCookie('userData').value && useCookie('accessToken').value)
      if (!isLoggedIn)
        return { name: 'template-login', query: to.query }

      return resolveLandingRoute() ?? { name: 'template-not-authorized' }
    },
  },
  {
    path: '/pages/user-profile',
    name: 'template-pages-user-profile',
    redirect: () => ({ name: 'template-pages-user-profile-tab', params: { tab: 'profile' } }),
  },
  {
    path: '/pages/account-settings',
    name: 'template-pages-account-settings',
    redirect: () => ({ name: 'template-pages-account-settings-tab', params: { tab: 'account' } }),
  },

  // 👉 Compatibilité & Redirections des URL de notifications (/admin/... et /organizer/...)
  {
    path: '/admin/organizers/:pathMatch(.*)*',
    redirect: () => ({ path: '/organizers' }),
  },
  {
    path: '/admin/events/:id',
    redirect: to => ({ path: `/events/${to.params.id}` }),
  },
  {
    path: '/admin/events',
    redirect: () => ({ path: '/events' }),
  },
  {
    path: '/admin/orders/:id',
    redirect: to => ({ path: `/orders/${to.params.id}` }),
  },
  {
    path: '/admin/orders',
    redirect: () => ({ path: '/orders' }),
  },
  {
    path: '/admin/withdrawals',
    redirect: () => ({ path: '/withdrawals' }),
  },
  {
    path: '/admin/:pathMatch(.*)*',
    redirect: to => {
      const p = to.params.pathMatch
      return p ? { path: `/${p}` } : { path: '/dashboard' }
    },
  },
  {
    path: '/organizer/orders/:id',
    redirect: to => ({ path: `/orders/${to.params.id}` }),
  },
  {
    path: '/organizer/orders',
    redirect: () => ({ path: '/orders' }),
  },
  {
    path: '/organizer/events/:id',
    redirect: to => ({ path: `/events/${to.params.id}` }),
  },
  {
    path: '/organizer/events',
    redirect: () => ({ path: '/events' }),
  },
  {
    path: '/organizer/:pathMatch(.*)*',
    redirect: to => {
      const p = to.params.pathMatch
      return p ? { path: `/${p}` } : { path: '/dashboard' }
    },
  },
  {
    path: '/organizers/:id',
    redirect: () => ({ path: '/organizers' }),
  },
]
export const routes = [
  // Email filter
  {
    path: '/apps/email/filter/:filter',
    name: 'template-apps-email-filter',
    component: emailRouteComponent,
    meta: {
      navActiveLink: 'template-apps-email',
      layoutWrapperClasses: 'layout-content-height-fixed',
    },
  },

  // Email label
  {
    path: '/apps/email/label/:label',
    name: 'template-apps-email-label',
    component: emailRouteComponent,
    meta: {
      // contentClass: 'email-application',
      navActiveLink: 'template-apps-email',
      layoutWrapperClasses: 'layout-content-height-fixed',
    },
  },
  {
    path: '/dashboards/logistics',
    name: 'template-dashboards-logistics',
    component: () => import('@/pages/template/apps/logistics/dashboard.vue'),
  },
  {
    path: '/dashboards/academy',
    name: 'template-dashboards-academy',
    component: () => import('@/pages/template/apps/academy/dashboard.vue'),
  },
  {
    path: '/apps/ecommerce/dashboard',
    name: 'template-apps-ecommerce-dashboard',
    component: () => import('@/pages/template/dashboards/ecommerce.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'template-not-found-fallback',
    component: () => import('@/pages/template/[...error].vue'),
    meta: {
      layout: 'blank',
      public: true,
    },
  },
]
