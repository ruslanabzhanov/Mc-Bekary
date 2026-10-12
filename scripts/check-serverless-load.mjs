// Загружает API так же, как это делает серверная функция Vercel: обычная компиляция TS → JS
// и нативный ESM-импорт. `npm run lint` и `npm run build` такую поломку не видят: tsc и esbuild
// понимают импорт соседнего файла без расширения (`./orderNorms`), а Node в режиме ESM — нет, и
// тогда весь /api отвечает 500 (FUNCTION_INVOCATION_FAILED). Один раз так уже уронили продакшн.
// Запуск: npm run check:serverless — перед каждой выкладкой, если трогали src/server или src/lib.
import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';

const out = '.esmtest';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
writeFileSync(`${out}/package.json`, '{"type":"module"}');

try {
  execSync(
    `npx tsc api/index.ts --outDir ${out} --module esnext --target es2022 --moduleResolution bundler --skipLibCheck --isolatedModules --jsx react-jsx`,
    { stdio: 'pipe' }
  );
} catch {
  // tsc может ругаться на типы и всё равно выдать JS; важно, загрузится ли он
}

const loader = [
  "import('./api/index.js')",
  "  .then(() => { console.log('OK: API загружается как на Vercel'); process.exit(0); })",
  "  .catch((e) => { console.error('ОШИБКА ЗАГРУЗКИ:', e.code || '', String(e.message).split('\\n')[0]); process.exit(1); });",
].join('\n');
writeFileSync(`${out}/load.mjs`, loader);

let failed = false;
try {
  execSync(`node --env-file=.env ${out}/load.mjs`, { stdio: 'inherit' });
} catch {
  failed = true;
} finally {
  rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
