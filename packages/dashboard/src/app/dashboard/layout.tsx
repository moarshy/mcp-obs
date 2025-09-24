import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'

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
    <div className="min-h-screen bg-gray-900 flex">
      <DashboardSidebar user={user} />
      <main className="flex-1 overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
              <p className="text-sm text-gray-400">Overview of your organization's activity and insights</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}