import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const [template, css, core, app] = await Promise.all(['src/index.html', 'src/style.css', 'src/core.js', 'src/app.js'].map(load));
const html = template.replace('<!-- APP_STYLE -->', () => `<style>\n${css}\n</style>`)
  .replace('<!-- CORE_SCRIPT -->', () => `<script>\n${core}\n</script>`)
  .replace('<!-- APP_SCRIPT -->', () => `<script>\n${app}\n</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
console.log(`Built ${fileURLToPath(new URL('dist/index.html', root))} (${Buffer.byteLength(html)} bytes)`);
