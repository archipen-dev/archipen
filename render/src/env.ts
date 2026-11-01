// Use React's production build unless told otherwise: no dev-only warnings on the console, faster rendering.
// Imported first, before anything that loads React.
process.env.NODE_ENV ??= 'production'
