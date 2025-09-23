import { Resource } from 'sst'
import { db } from '@mcplatform/database'

// In production, DATABASE_URL comes from SST Resource
// In development, it comes from .env.local
export const database = db