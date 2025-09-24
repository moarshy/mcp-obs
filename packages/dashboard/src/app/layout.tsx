import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mcp-obs',
  description: 'Observability and management platform for MCP servers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}