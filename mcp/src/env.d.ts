// `?raw` imports: the docs and the JSON Schema are bundled into the server as text.
declare module '*?raw' {
  const text: string
  export default text
}
