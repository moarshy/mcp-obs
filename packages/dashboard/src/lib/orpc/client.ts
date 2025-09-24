'use client'

import { createORPCClient } from '@orpc/client'
import { createORPCQueryUtils, createORPCHooks } from '@orpc/next/react'

// Create the base oRPC client
export const orpcClient = createORPCClient({
  url: '/api/rpc',
})

// Create React hooks for oRPC
export const orpcHooks = createORPCHooks({
  client: orpcClient,
})

export const orpcUtils = createORPCQueryUtils({
  client: orpcClient,
})

// Export commonly used hooks
export const { useQuery, useMutation, useSuspenseQuery } = orpcHooks