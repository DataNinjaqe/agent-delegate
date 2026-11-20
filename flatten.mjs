// Flatten AgentDelegate.sol + its @openzeppelin import closure into one file
// for BscScan's "Solidity (Single file)" verification fallback.
// Dependencies first (post-order DFS), imports stripped, one SPDX + one pragma kept.
import solc from 'solc';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname);

function readLocal(p) {
  return fs.readFileSync(p.startsWith('@') ? path.join(ROOT, 'node_modules', p) : path.resolve(ROOT, 'contracts', p), 'utf8');
}
function resolveKey(importer, dep) {
  if (dep.startsWith('./') || dep.startsWith('../')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(importer), dep));
  }
  return dep;
}

const emitted = new Set();
const order = [];
function visit(name) {
  if (emitted.has(name)) return;
  emitted.add(name);
  const content = readLocal(name);
  for (const m of content.matchAll(/import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)) {
    visit(resolveKey(name, m[1]));
  }
  order.push(name);
}
visit('AgentDelegate.sol');

const parts = [];
for (const name of order) {
  let content = readLocal(name);
  content = content.replace(/^import\s+[^;]+;\s*$/gm, '');
  content = content.replace(/^\/\/ SPDX-License-Identifier:.*$/m, '');
  content = content.replace(/^pragma solidity [^;]+;\s*$/m, '');
  parts.push(`// ---- ${name} ----\n` + content.trim());
}
const flat = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n` + parts.join('\n\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'AgentDelegate.flattened.sol'), flat);
console.log('flattened files:', order.length, '| size:', flat.length, 'bytes');

// Sanity: compile the flattened file alone and compare code (metadata stripped)
// against the deployed artifact's creation bytecode.
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'AgentDelegate.flattened.sol': { content: flat } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
})));
const errs = (out.errors || []).filter((e) => e.severity === 'error');
if (errs.length) { console.log('FLAT COMPILE ERRORS:', errs); process.exit(1); }
const stripMeta = (hex) => {
  const b = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  const metaLen = b.readUInt16BE(b.length - 2);
  return b.subarray(0, b.length - 2 - metaLen).toString('hex');
};
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'AgentDelegate.json'), 'utf8'));
const flatCreation = out.contracts['AgentDelegate.flattened.sol'].AgentDelegate.evm.bytecode.object;
const flatRuntime = out.contracts['AgentDelegate.flattened.sol'].AgentDelegate.evm.deployedBytecode.object;
console.log('creation code matches (metadata stripped):', stripMeta(flatCreation) === stripMeta(artifact.bytecode));
console.log('runtime code: skipped (build json has no deployedBytecode)');
