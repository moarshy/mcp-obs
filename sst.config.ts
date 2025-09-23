/// <reference path="./.sst/platform/config.d.ts" />

const requireEnv = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

// Authentication providers
const GITHUB_CLIENT_ID = requireEnv('GITHUB_CLIENT_ID')
const GITHUB_CLIENT_SECRET = requireEnv('GITHUB_CLIENT_SECRET')
const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET')

// Better Auth configuration
const BETTER_AUTH_SECRET = requireEnv('BETTER_AUTH_SECRET')
const NEXT_PUBLIC_BETTER_AUTH_URL = requireEnv('NEXT_PUBLIC_BETTER_AUTH_URL')

// Domain configuration
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'mcplatform.com'

// Ngrok configuration for development
const NGROK_STATIC_URL = process.env.NGROK_STATIC_URL

export default $config({
    app(input) {
        return {
            name: 'mcplatform',
            removal: input?.stage === 'production' ? 'retain' : 'remove',
            protect: ['production'].includes(input?.stage),
            home: 'aws'
        }
    },
    async run() {
        const vpc = new sst.aws.Vpc(`Vpc`, {
            nat: {
                type: 'managed'
            },
            bastion: true
        })

        // PostgreSQL database for the application
        const postgres = new sst.aws.Postgres(`Postgres`, {
            vpc,
            database: 'mcplatform',
            proxy: false
        })

        // Configure the Next.js app domain
        const appDomain = $app.stage === 'production' ? DOMAIN_NAME : `${$app.stage}.${DOMAIN_NAME}`

        // URL-encode the postgres password for connection strings
        const urlEncodedPostgresPassword = $resolve([postgres.password]).apply(([postgresPw]) =>
            encodeURIComponent(postgresPw!)
        )

        // Database migrator function
        const migrator = new sst.aws.Function('DatabaseMigrator', {
            link: [postgres],
            vpc,
            handler: 'packages/database/migrator.handler',
            copyFiles: [
                {
                    from: 'packages/database/migrations',
                    to: 'migrations'
                }
            ],
            environment: {
                DATABASE_URL: $interpolate`postgres://${postgres.username}:${urlEncodedPostgresPassword}@${postgres.host}:${postgres.port}/${postgres.database}`
            },
            dev: false // Deploy even in dev mode for testing
        })

        // Run database migrations on deployment
        new aws.lambda.Invocation('DatabaseMigratorInvocation', {
            input: Date.now().toString(),
            functionName: migrator.name
        })

        // Drizzle Studio for database management in development
        new sst.x.DevCommand('Studio', {
            link: [postgres],
            dev: {
                command: 'bun run studio'
            }
        })

        // Configure domain name
        const domainName = $app.stage === 'production' ? DOMAIN_NAME : `${$app.stage}.${DOMAIN_NAME}`

        // Next.js application
        const nextApp = new sst.aws.Nextjs('Dashboard', {
            path: './packages/dashboard',
            regions: ['us-east-1'],
            domain: {
                name: domainName,
                dns: sst.aws.dns(),
                redirects: [`www.${domainName}`],
                aliases: [`*.${domainName}`] // Support subdomains for multi-tenant
            },
            link: [postgres],
            vpc,
            environment: {
                // Database
                DATABASE_URL: $interpolate`postgres://${postgres.username}:${urlEncodedPostgresPassword}@${postgres.host}:${postgres.port}/${postgres.database}`,

                // Authentication
                GITHUB_CLIENT_ID,
                GITHUB_CLIENT_SECRET,
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                NEXT_PUBLIC_BETTER_AUTH_URL: $dev ? NEXT_PUBLIC_BETTER_AUTH_URL : `https://${domainName}`,
                BETTER_AUTH_SECRET,

                // App configuration
                NODE_ENV: $app.stage === 'production' ? 'production' : 'development',
                APP_STAGE: $app.stage
            },
            warm: 1,
            dev: {
                command: 'bun run dev'
            }
        })

        return {
            dashboard: nextApp.url,
            database: postgres.host
        }
    }
})