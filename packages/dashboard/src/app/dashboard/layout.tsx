import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, session } = await getServerSession()

  if (!user || !session) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} />
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}