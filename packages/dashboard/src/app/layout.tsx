import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mcp-obs',
  description: 'Observability and management platform for MCP servers',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}