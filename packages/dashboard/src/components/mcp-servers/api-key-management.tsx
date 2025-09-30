'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Key,
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { listApiKeysAction, generateApiKeyAction, revokeApiKeyAction } from '@/lib/orpc/actions/telemetry-api-keys'

interface ApiKeyManagementProps {
  serverId: string
  serverSlug: string
}

interface ApiKey {
  id: string
  name: string | null
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
  status: 'active' | 'revoked'
  apiKeyPreview: string | null
}

export function ApiKeyManagement({ serverId, serverSlug }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [error, setError] = useState('')
  const [showNewKey, setShowNewKey] = useState(false)

  const loadApiKeys = async () => {
    try {
      setLoading(true)
      const keys = await listApiKeysAction({ mcpServerId: serverId })
      console.log('Raw API keys response:', keys)
      console.log('Response type:', typeof keys)
      console.log('Response is array:', Array.isArray(keys))
      console.log('Response structure:', JSON.stringify(keys, null, 2))
      console.log('Server ID being used:', serverId)

      // Handle the case where oRPC might return [null, actualData] format
      let actualKeys = keys
      if (Array.isArray(keys) && keys.length > 0 && keys[0] === null && Array.isArray(keys[1])) {
        console.log('Detected nested array format, extracting actual data')
        actualKeys = keys[1]
      }

      // Only show active (non-revoked) keys, filter out any null/undefined keys
      const activeKeys = actualKeys.filter(key => key && key.status === 'active')
      console.log('Filtered active keys:', activeKeys)

      setApiKeys(activeKeys)
      setError('')
    } catch (err: any) {
      console.error('Error loading API keys:', err)
      setError(err.message || 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const generateNewApiKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please provide a name for the API key')
      return
    }

    try {
      setGenerating(true)
      setError('')
      const result = await generateApiKeyAction({
        mcpServerId: serverId,
        name: newKeyName.trim()
      })

      console.log('Generate API Key Result:', result)
      console.log('API Key from result:', result.apiKey)
      console.log('Result type:', typeof result)
      console.log('Result structure:', JSON.stringify(result, null, 2))

      // Handle the case where oRPC might return [null, actualData] format
      let actualResult = result
      if (Array.isArray(result) && result.length >= 2 && result[0] === null && result[1]) {
        console.log('Detected nested array format for API key result, extracting actual data')
        actualResult = result[1]
      }

      console.log('Final API key to set:', actualResult.apiKey)
      setNewApiKey(actualResult.apiKey)
      setShowNewKey(true)
      setNewKeyName('')
      await loadApiKeys()
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key')
    } finally {
      setGenerating(false)
    }
  }

  const revokeApiKey = async (keyId: string) => {
    try {
      await revokeApiKeyAction({ apiKeyId: keyId })
      await loadApiKeys()
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  useEffect(() => {
    console.log('ApiKeyManagement useEffect triggered:', { serverId })
    loadApiKeys()
  }, [serverId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Key className="h-5 w-5" />
            Telemetry API Keys
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for OpenTelemetry data export from your MCP server
          </p>
        </div>
        <Button
          onClick={() => setShowNewKey(!showNewKey)}
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate New Key
        </Button>
      </div>

      {error && (
        <div className="flex items-center p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* New API Key Generation */}
      {showNewKey && (
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h4 className="text-sm font-medium mb-3">Generate New API Key</h4>
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="API Key Name (e.g., Production Key)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                disabled={generating}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={generateNewApiKey}
                disabled={generating || !newKeyName.trim()}
                size="sm"
              >
                {generating ? (
                  <div className="flex items-center">
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    Generating...
                  </div>
                ) : (
                  <>
                    <Key className="h-3 w-3 mr-2" />
                    Generate Key
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowNewKey(false)
                  setNewKeyName('')
                  setNewApiKey(null)
                }}
                variant="outline"
                size="sm"
                disabled={generating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Newly Generated API Key Display */}
      {newApiKey && (
        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              New API Key Generated
            </span>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mb-3">
            Save this API key now - it won't be shown again for security reasons.
          </p>

          <div className="bg-white dark:bg-gray-800 border rounded p-3">
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-mono flex-1 break-all">
                {newApiKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(newApiKey)}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/40 rounded border">
            <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">
              Quick Setup:
            </p>
            <div className="font-mono text-xs text-green-700 dark:text-green-300">
              <div>export MCP_OBS_API_KEY="{newApiKey}"</div>
              <div className="mt-1">configureMCPTelemetry(&#123;</div>
              <div>&nbsp;&nbsp;serverSlug: '{serverSlug}',</div>
              <div>&nbsp;&nbsp;apiKey: process.env.MCP_OBS_API_KEY</div>
              <div>&#125;)</div>
            </div>
          </div>

          <div className="mt-3 text-right">
            <Button
              onClick={() => setNewApiKey(null)}
              variant="outline"
              size="sm"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Existing API Keys */}
      <div>
        <h4 className="text-sm font-medium mb-3">Active API Keys</h4>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No API keys found</p>
            <p className="text-xs">Generate your first API key to start collecting telemetry</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => {
              if (!key || !key.id) {
                return null // Skip invalid keys
              }

              return (
                <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.name || 'Unnamed Key'}
                      </code>
                      <Badge variant="outline" className="text-green-600">
                        {key.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-x-4">
                      <span>Created: {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      {key.lastUsedAt ? (
                        <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      ) : (
                        <span>Never used</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeApiKey(key.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}