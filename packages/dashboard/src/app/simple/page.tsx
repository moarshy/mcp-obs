export default function SimplePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">mcp-obs</h1>
          <p className="mt-2 text-gray-600">
            Authentication and observability for MCP servers
          </p>
          <p className="mt-4 text-sm text-green-600">
            ✅ Deployment successful! Basic infrastructure is working.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-blue-50 p-4">
            <h3 className="text-sm font-medium text-blue-800">Next Steps:</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Set up database connection</li>
                <li>Configure Better Auth</li>
                <li>Enable authentication flows</li>
                <li>Test organization management</li>
              </ul>
            </div>
          </div>

          <div className="rounded-md bg-yellow-50 p-4">
            <h3 className="text-sm font-medium text-yellow-800">Status:</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>✅ SST infrastructure deployed</li>
                <li>✅ Next.js application running</li>
                <li>✅ Database (Postgres) provisioned</li>
                <li>⏳ Authentication setup pending</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}