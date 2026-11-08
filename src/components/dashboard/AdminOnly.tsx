import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useStaff } from '../../state/staff'

/** Management screens are for admins. A barista who follows a link lands back on the queue. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useStaff()
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}
