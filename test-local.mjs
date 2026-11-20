// Local functional test on ganache: mock Agent ID registry + AgentDelegate scenario.
// Exit 0 = all checks pass, 1 = any check fails.
import Ganache from 'ganache';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname);
const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'build', `${n}.json`), 'utf8'));

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failures++;
}

async function expectRevert(name, promise) {
  try {
    const tx = await promise;
    if (tx && typeof tx.wait === 'function') await tx.wait();
    check(name, false);
  } catch (e) {
    check(name, true);
  }
}

const server = Ganache.server({ logging: { quiet: true } });
await server.listen(8545);
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const [deployer, alice, bob, carol] = await provider.listAccounts();

const mock = load('MockAgentID');
const del = load('AgentDelegate');

const MockFactory = new ethers.ContractFactory(mock.abi, mock.bytecode, deployer);
const mockReg = await MockFactory.deploy();
await mockReg.waitForDeployment();
const regAddr = await mockReg.getAddress();
console.log('MockAgentID:', regAddr);

// Give Alice + Bob Agent IDs; Carol gets none.
await (await mockReg.mint(await alice.getAddress())).wait();
await (await mockReg.mint(await bob.getAddress())).wait();

const DelFactory = new ethers.ContractFactory(del.abi, del.bytecode, deployer);
const agentDelegate = await DelFactory.deploy(regAddr);
await agentDelegate.waitForDeployment();
console.log('AgentDelegate:', await agentDelegate.getAddress());

const asAlice = agentDelegate.connect(alice);
const asBob = agentDelegate.connect(bob);
const asCarol = agentDelegate.connect(carol);
const asOwner = agentDelegate.connect(deployer);

const now = async () => (await provider.getBlock('latest')).timestamp;
const SCOPE_CHECK_IN = 1;
const SCOPE_GENERAL = 2;

// 1. Non-holder cannot grant; grant to non-holder reverts; self-grant reverts.
await expectRevert('carol (no Agent ID) cannot grant', asCarol.grantDelegate(await bob.getAddress(), SCOPE_CHECK_IN, (await now()) + 86400));
await (await mockReg.mint(await carol.getAddress())).wait(); // carol now holds one
await expectRevert('grant to self reverts', asAlice.grantDelegate(await alice.getAddress(), SCOPE_CHECK_IN, (await now()) + 86400));
await expectRevert('bad scope reverts', asAlice.grantDelegate(await bob.getAddress(), 3, (await now()) + 86400));
await expectRevert('past expiry reverts', asAlice.grantDelegate(await bob.getAddress(), SCOPE_CHECK_IN, (await now()) - 10));

// 2. Alice grants Bob check-in for 7 days; isDelegate true; grant stored.
const expiry = (await now()) + 7 * 86400;
await (await asAlice.grantDelegate(await bob.getAddress(), SCOPE_CHECK_IN, expiry)).wait();
check('bob is check-in delegate', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_CHECK_IN)) === true);
check('bob is not general delegate', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_GENERAL)) === false);
check('grant expiry stored', (await agentDelegate.grants(await alice.getAddress(), await bob.getAddress(), SCOPE_CHECK_IN)) === BigInt(expiry));

// 3. Bob checks in for Alice; count 1. Carol (not a delegate) cannot.
await (await asBob.checkInFor(await alice.getAddress())).wait();
check('delegated check-ins = 1', (await agentDelegate.delegatedCheckIns(await alice.getAddress())) === 1n);
await expectRevert('carol cannot check in for alice', asCarol.checkInFor(await alice.getAddress()));

// 4. Expiry: move 8 days forward; isDelegate false; checkInFor reverts.
await provider.send('evm_increaseTime', [8 * 86400]);
await provider.send('evm_mine', []);
check('delegate expired after 8 days', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_CHECK_IN)) === false);
await expectRevert('expired delegate cannot check in', asBob.checkInFor(await alice.getAddress()));

// 5. Re-grant, then revoke: isDelegate false again.
// NOTE (ganache quirk, same class as the Squad test): after evm_increaseTime
// the pending block used for gas estimation runs ~8 days ahead of the latest
// mined block, so post-jump grants use far-future expiries and explicit
// gasLimit (skips estimation). The contract logic is unaffected.
const expiry2 = (await now()) + 30 * 86400;
await (await asAlice.grantDelegate(await bob.getAddress(), SCOPE_CHECK_IN, expiry2, { gasLimit: 200000 })).wait();
check('re-grant works', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_CHECK_IN)) === true);
await (await asAlice.revokeDelegate(await bob.getAddress(), SCOPE_CHECK_IN)).wait();
check('revoked delegate inactive', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_CHECK_IN)) === false);
await expectRevert('revoke twice reverts', asAlice.revokeDelegate(await bob.getAddress(), SCOPE_CHECK_IN));

// 6. General scope grant does not authorize check-in.
await (await asAlice.grantDelegate(await bob.getAddress(), SCOPE_GENERAL, (await now()) + 30 * 86400, { gasLimit: 200000 })).wait();
check('general grant active', (await agentDelegate.isDelegate(await alice.getAddress(), await bob.getAddress(), SCOPE_GENERAL)) === true);
await expectRevert('general delegate cannot check in', asBob.checkInFor(await alice.getAddress()));

// 7. Pause: owner pauses, grant blocked; non-owner pause reverts; unpause restores.
await expectRevert('non-owner cannot pause', agentDelegate.connect(alice).pause());
await (await asOwner.pause()).wait();
await expectRevert('grant blocked while paused', asAlice.grantDelegate(await carol.getAddress(), SCOPE_CHECK_IN, (await now()) + 86400));
await (await asOwner.unpause()).wait();
await (await asAlice.grantDelegate(await carol.getAddress(), SCOPE_CHECK_IN, (await now()) + 30 * 86400, { gasLimit: 200000 })).wait();
check('grant works after unpause', (await agentDelegate.isDelegate(await alice.getAddress(), await carol.getAddress(), SCOPE_CHECK_IN)) === true);

await server.close();
if (failures > 0) {
  console.error(`TESTS FAILED: ${failures}`);
  process.exit(1);
}
console.log('ALL TESTS PASSED');
