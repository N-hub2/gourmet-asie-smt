import type { StaffSession } from '../../shared/types/auth'
export default defineNuxtRouteMiddleware(async to => {
  const fetch = useRequestFetch()
  try {
    const staff = await fetch<StaffSession>('/api/auth/me')
    if (to.path.startsWith('/admin') && staff.role !== 'ADMIN') return navigateTo('/personnel')
  } catch { return navigateTo('/connexion') }
})
