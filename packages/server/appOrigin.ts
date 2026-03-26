// APP_ORIGIN sets the public-facing URL (used for OAuth callbacks, email links, assets, etc.)
// Recommended for any reverse proxy / custom domain deployment.
// Falls back to PROTO + HOST + PORT for backward compatibility.
const appOrigin = process.env.APP_ORIGIN
  ? process.env.APP_ORIGIN.replace(/\/$/, '')
  : (() => {
      const proto = process.env.PROTO
      const host = process.env.HOST
      const port = process.env.PORT
      const portSuffix = host !== 'localhost' ? '' : `:${port}`
      return `${proto}://${host}${portSuffix}`
    })()
export default appOrigin
