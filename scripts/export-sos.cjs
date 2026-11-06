/** Export the same secret-free instructions used by /sos into the code ZIP. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, process: { env: {} }, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected SOS dependency: ${name}`);
  } });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return module.exports;
}
const version = load('src/lib/version.ts');
const site = load('src/lib/site-url.ts');
const release = load('src/lib/release-info.ts', { '@/lib/version': version });
const { buildSosContext } = load('src/lib/sos-context.ts', { '@/lib/version': version, '@/lib/site-url': site, '@/lib/release-info': release });
const text = buildSosContext();
for (const file of ['CONTEXTO-NOVO-CHAT.md', 'public/CONTEXTO-NOVO-CHAT.md']) fs.writeFileSync(file, text);
console.log(`SOS instructions exported for ${version.CODE_VERSION}; no environment values or database access.`);
