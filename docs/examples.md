<script setup>
import { withBase } from 'vitepress'
import { data as examples } from './examples.data'
</script>

# Examples

These files live in [`examples/`](../examples/minimal.archipen.json) in the repository. They are checked by the
validator, open as templates on the app's home page, and show the [file format](./file-format) in practice.
"Open" shows each one as a read-only share link in the app; from there you can present it or save a copy.

<table>
  <thead><tr><th>Diagram</th><th>Size</th><th></th></tr></thead>
  <tbody>
    <tr v-for="e in examples" :key="e.file">
      <td><strong>{{ e.name }}</strong><br><a :href="withBase('/examples/' + e.file)" target="_blank"><code>{{ e.file }}</code></a></td>
      <td>{{ e.nodes }} nodes, {{ e.zones }} zones, {{ e.edges }} wires<template v-if="e.pages > 1"> on {{ e.pages }} pages</template></td>
      <td><a :href="withBase('/app/') + '#/share#' + e.share" target="_blank">Open in Archipen →</a></td>
    </tr>
  </tbody>
</table>

Check your own files the same way:

```sh
npm run validate -- my-diagram.archipen.json
```
