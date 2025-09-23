import ngrok from '@ngrok/ngrok'

const NGROK_STATIC_URL = process.env.NGROK_STATIC_URL
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN

if (!NGROK_STATIC_URL) {
    console.error('NGROK_STATIC_URL environment variable is required')
    process.exit(1)
}

if (!NGROK_AUTH_TOKEN) {
    console.error('NGROK_AUTH_TOKEN environment variable is required')
    process.exit(1)
}

console.log(`Starting ngrok tunnel to localhost:3000 with domain: ${NGROK_STATIC_URL}`)

await ngrok.forward({
    port: 3000,
    proto: 'http',
    domain: NGROK_STATIC_URL,
    authtoken: NGROK_AUTH_TOKEN
})

console.log(`✅ Ngrok tunnel active: ${NGROK_STATIC_URL} -> localhost:3000`)

// Keep the tunnel alive
while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100_000))
}