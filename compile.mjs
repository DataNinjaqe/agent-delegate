// Compile contracts with solc (npm) and write ABI + bytecode to build/.
import solc from 'solc';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname);

function findImports(importPath) {
  let full;
  if (importPath.startsWith('@')) {
    full = path.join(ROOT, 'node_modules', importPath);
  } else {
    full = path.resolve(ROOT, 'contracts', importPath);
  }
  try {
    return { contents: fs.readFileSync(full, 'utf8') };
  } catch (e) {
    return { error: `import not found: ${importPath}` };
  }
}

const input = {
  language: 'Solidity',
  sources: {
    'AgentDelegate.sol': { content: fs.readFileSync(path.join(ROOT, 'contracts/AgentDelegate.sol'), 'utf8') },
    'MockAgentID.sol': { content: fs.readFileSync(path.join(ROOT, 'contracts/MockAgentID.sol'), 'utf8') },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // OZ 5.0.2 (pre-MCOPY) + shanghai: same pinned stack as Agent Squad,
    // verified to work on local ganache and BSC mainnet.
    evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

const errors = (output.errors || []).filter((e) => e.severity === 'error');
for (const e of output.errors || []) {
  console.log(`[${e.severity}] ${e.formattedMessage}`);
}
if (errors.length > 0) {
  console.error(`COMPILE FAILED: ${errors.length} error(s)`);
  process.exit(1);
}

fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
for (const [file, contracts] of Object.entries(output.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    const out = { contractName: name, sourceName: file, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
    fs.writeFileSync(path.join(ROOT, 'build', `${name}.json`), JSON.stringify(out, null, 2));
    console.log(`OK ${name} (${file}) bytecode=${c.evm.bytecode.object.length / 2} bytes`);
  }
}
console.log('COMPILE OK');
