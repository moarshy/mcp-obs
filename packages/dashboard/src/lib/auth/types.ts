import type { User, Organization, Member, Session } from 'database'

// Auth-related types
export type AuthUser = User
export type AuthSession = Session
export type AuthOrganization = Organization
export type AuthMember = Member

// Role types
export type Role = 'owner' | 'admin' | 'member'

// Auth context types
export interface AuthContext {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Organization context types
export interface OrganizationContext {
  organization: AuthOrganization | null
  membership: AuthMember | null
  role: Role | null
  isLoading: boolean
}

// Combined auth and organization context
export interface AppContext extends AuthContext {
  organizations: AuthOrganization[]
  currentOrganization: OrganizationContext
}

// Sign in/up form types
export interface SignInFormData {
  email: string
  password: string
  rememberMe?: boolean
}

export interface SignUpFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  organizationName?: string
  organizationSlug?: string
}

// Organization creation form types
export interface CreateOrganizationFormData {
  name: string
  slug: string
  description?: string
}

// Team invitation types
export interface InviteMemberFormData {
  email: string
  role: Role
}