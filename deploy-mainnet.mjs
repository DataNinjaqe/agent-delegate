// Deploy AgentDelegate to BSC mainnet, then transfer ownership to w1 (xixiya).
// Safety: refuses to send anything unless the deployer holds >= 0.0005 BNB,
// and refuses to redeploy if deployment.json already has a contract address.
// The deployer key is SHARED with Agent Squad (one-time EOA) and lives ONLY
// at ~/workspace/agent-squad/.deployer-key — never copied into this repo.
// Usage: node deploy-mainnet.mjs   (deployer already funded from Squad)
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(import.meta.dirname);
const REGISTRY = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F';
const W1 = '0x4A0fa64e6bE1191DC8ae603290A11E782D818851';
const MIN_BALANCE = ethers.parseEther('0.0005');
const RPCS = [
  'https://bsc-dataseed1.bnbchain.org',
  'https://bsc-mainnet.public.blastapi.io',
  'https://bsc-dataseed.bnbchain.org',
];
const DEPLOY_JSON = path.join(ROOT, 'deployment.json');

const existing = fs.existsSync(DEPLOY_JSON) ? JSON.parse(fs.readFileSync(DEPLOY_JSON, 'utf8')) : null;
if (existing?.contractAddress) {
  console.log('ALREADY DEPLOYED:', existing.contractAddress, '- refusing to redeploy.');
  process.exit(0);
}

const key = fs.readFileSync(path.join(os.homedir(), 'workspace/agent-squad/.deployer-key'), 'utf8').trim();
const pk = key.startsWith('0x') ? key : '0x' + key;

let provider = null;
for (const url of RPCS) {
  for (let attempt = 1; attempt <= 3 && !provider; attempt++) {
    try {
      const req = new ethers.FetchRequest(url);
      req.timeout = 10000;
      const p = new ethers.JsonRpcProvider(req, 56, { staticNetwork: true });
      await p.getBlockNumber();
      provider = p;
      console.log('RPC:', url, `(attempt ${attempt})`);
    } catch { /* retry */ }
  }
  if (provider) break;
}
if (!provider) { console.log('ERROR: no BSC RPC reachable'); process.exit(1); }

const wallet = new ethers.Wallet(pk, provider);
console.log('deployer:', wallet.address);
const bal = await provider.getBalance(wallet.address);
console.log('deployer balance:', ethers.formatEther(bal), 'BNB');
if (bal < MIN_BALANCE) {
  console.log(`ERROR: balance below ${ethers.formatEther(MIN_BALANCE)} BNB - ask user to fund the deployer first, nothing sent.`);
  process.exit(1);
}

const { abi, bytecode } = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'AgentDelegate.json'), 'utf8'));
const factory = new ethers.ContractFactory(abi, bytecode, wallet);
console.log('deploying AgentDelegate...');
const contract = await factory.deploy(REGISTRY);
console.log('deploy tx:', contract.deploymentTransaction().hash);
await contract.waitForDeployment();
const addr = await contract.getAddress();
const receipt = await contract.deploymentTransaction().wait();
console.log('DEPLOYED:', addr, 'gasUsed:', receipt.gasUsed.toString());

console.log('transferring ownership to w1', W1, '...');
const tx = await contract.transferOwnership(W1);
console.log('transfer tx:', tx.hash);
await tx.wait();
console.log('owner is now:', await contract.owner());

fs.writeFileSync(DEPLOY_JSON, JSON.stringify({
  contractAddress: addr,
  deployTx: contract.deploymentTransaction().hash,
  transferOwnershipTx: tx.hash,
  deployer: wallet.address,
  owner: W1,
  registry: REGISTRY,
  chainId: 56,
  deployedAt: new Date().toISOString(),
}, null, 2));
console.log('saved', DEPLOY_JSON);
