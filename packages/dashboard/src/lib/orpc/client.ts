'use client'

import { createORPCClient } from '@orpc/client'

// Create the base oRPC client
export const orpcClient = createORPCClient({
  url: '/api/rpc',
})

// TODO: Add React hooks when oRPC Next.js integration is properly set up
// For now, export a simple client interface
export const orpc = {
  auth: {
    getMe: () => fetch('/api/rpc/auth/getMe').then(r => r.json()),
    createOrganization: (data: any) =>
      fetch('/api/rpc/auth/createOrganization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json()),
  }
}