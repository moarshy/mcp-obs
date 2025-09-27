'use server'

import { db, mcpServer } from 'database'
import { eq, and, ne } from 'drizzle-orm'

export async function validateSlug(slug: string, excludeId?: string) {
  try {
    // Check if slug is already taken globally (across all organizations)
    // Exclude the current server if we're editing
    const whereConditions = excludeId
      ? and(eq(mcpServer.slug, slug), ne(mcpServer.id, excludeId))
      : eq(mcpServer.slug, slug)

    const existingServer = await db
      .select({ id: mcpServer.id })
      .from(mcpServer)
      .where(whereConditions)
      .then(rows => rows[0])

    if (existingServer) {
      return {
        available: false,
        message: 'This subdomain is already taken. Please choose a different one.'
      }
    }

    // Check if slug contains reserved words
    const reservedSlugs = ['www', 'api', 'admin', 'dashboard', 'app', 'mail', 'ftp', 'blog', 'help', 'support']
    if (reservedSlugs.includes(slug.toLowerCase())) {
      return {
        available: false,
        message: 'This subdomain is reserved. Please choose a different one.'
      }
    }

    return {
      available: true,
      message: 'This subdomain is available!'
    }
  } catch (error) {
    console.error('Error validating slug:', error)
    return {
      available: false,
      message: 'Error checking slug availability. Please try again.'
    }
  }
}