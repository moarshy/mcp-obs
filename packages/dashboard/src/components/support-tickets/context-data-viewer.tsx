'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Code, Clock, Globe, Wrench } from 'lucide-react'

interface ContextDataViewerProps {
  contextData: string | null
}

interface ParsedContext {
  toolCall?: {
    name?: string
    arguments?: any
    result?: any
  }
  timestamp?: number
  endpoint?: string
  userAgent?: string
  [key: string]: any
}

export function ContextDataViewer({ contextData }: ContextDataViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!contextData) {
    return null
  }

  let parsedData: ParsedContext
  try {
    parsedData = JSON.parse(contextData)
  } catch (error) {
    // Fallback to raw display if JSON parsing fails
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="h-4 w-4" />
            Session Context
          </CardTitle>
          <CardDescription>
            Raw context data (parsing failed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4">
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {contextData}
            </pre>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatJson = (data: any) => {
    if (typeof data === 'string') return data
    return JSON.stringify(data, null, 2)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-4 w-4" />
              Session Context
            </CardTitle>
            <CardDescription>
              Technical details captured when the ticket was created
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Information Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parsedData.timestamp && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Timestamp</p>
                <p className="text-muted-foreground">{formatTimestamp(parsedData.timestamp)}</p>
              </div>
            </div>
          )}

          {parsedData.endpoint && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Endpoint</p>
                <p className="text-muted-foreground font-mono">{parsedData.endpoint}</p>
              </div>
            </div>
          )}

          {parsedData.toolCall?.name && (
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Tool Call</p>
                <Badge variant="secondary">{parsedData.toolCall.name}</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Tool Call Details */}
        {parsedData.toolCall && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Tool Call Details</h4>

            {parsedData.toolCall.arguments && (
              <div>
                <p className="text-sm font-medium mb-2">Arguments:</p>
                <div className="bg-muted rounded p-3">
                  <pre className="text-xs overflow-x-auto">
                    {formatJson(parsedData.toolCall.arguments)}
                  </pre>
                </div>
              </div>
            )}

            {parsedData.toolCall.result && (
              <div>
                <p className="text-sm font-medium mb-2">Result:</p>
                <div className="bg-muted rounded p-3">
                  <pre className="text-xs overflow-x-auto">
                    {formatJson(parsedData.toolCall.result)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expanded Raw Data */}
        {isExpanded && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Raw Context Data:</p>
            <div className="bg-muted rounded-lg p-4">
              <pre className="text-xs text-muted-foreground overflow-x-auto">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}