// Build the exact Standard JSON input Sourcify/BscScan needs to verify AgentDelegate.
// Reproduces compile.mjs input byte-for-byte: same sources (AgentDelegate.sol,
// MockAgentID.sol, full @openzeppelin import closure), same settings
// (optimizer runs 200, evmVersion shanghai). Also prints the ABI-encoded
// constructor argument (registry address).
import solc from 'solc';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname);
const REGISTRY = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F';

function readLocal(p) {
  return fs.readFileSync(p.startsWith('@') ? path.join(ROOT, 'node_modules', p) : path.resolve(ROOT, 'contracts', p), 'utf8');
}

function resolveKey(importer, dep) {
  if (dep.startsWith('./') || dep.startsWith('../')) {
    const dir = path.posix.dirname(importer);
    return path.posix.normalize(path.posix.join(dir, dep));
  }
  return dep;
}

const sources = {};
const queue = ['AgentDelegate.sol', 'MockAgentID.sol'];
const seen = new Set();
while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  let content;
  try {
    content = readLocal(name);
  } catch {
    console.log('MISSING SOURCE:', name);
    process.exit(1);
  }
  sources[name] = { content };
  for (const m of content.matchAll(/import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const dep = resolveKey(name, m[1]);
    if (dep.endsWith('.sol') && !seen.has(dep)) queue.push(dep);
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), {
  import: (p) => {
    try { return { contents: readLocal(p) }; } catch { return { error: 'not found: ' + p }; }
  },
}));
const errs = (out.errors || []).filter((e) => e.severity === 'error');
if (errs.length) { console.log('COMPILE ERRORS:', errs); process.exit(1); }
const created = '0x' + out.contracts['AgentDelegate.sol'].AgentDelegate.evm.bytecode.object;
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'AgentDelegate.json'), 'utf8'));
console.log('creation bytecode matches deployed artifact:', created.toLowerCase() === artifact.bytecode.toLowerCase());
console.log('solc:', solc.version());
console.log('sources in JSON:', Object.keys(sources).length);

fs.writeFileSync(path.join(ROOT, 'verify-input.json'), JSON.stringify(input, null, 2));
console.log('wrote verify-input.json, size:', fs.statSync(path.join(ROOT, 'verify-input.json')).size, 'bytes');

const abiCoder = new ethers.AbiCoder();
console.log('constructor args:', abiCoder.encode(['address'], [REGISTRY]).slice(2));
