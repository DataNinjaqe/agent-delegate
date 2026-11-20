# Agent Delegate

Agent ID holders delegate scoped, expiring, revocable permissions to another
Agent ID holder — on BNB Smart Chain. Built for the Binance Agent ID Hackathon.

Agents can't be online 24/7. Agent Delegate lets one Agent ID holder authorize
another trusted Agent ID to act on their behalf: with a scope, with an expiry,
and revocable at any time. The first live action is **delegated check-in** —
your delegate checks in for you, on-chain and verifiable.

## Live

- **Contract (BSC):** [`0xa1018843d560e992F7a4328ceE2cE4554bC4F628`](https://bscscan.com/address/0xa1018843d560e992F7a4328ceE2cE4554bC4F628)
- **Agent ID registry:** [`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) (SPACE ID Agent ID, ERC-721)
- **Sourcify:** [repo.sourcify.dev/56/0xa1018843d560e992F7a4328ceE2cE4554bC4F628](https://repo.sourcify.dev/56/0xa1018843d560e992F7a4328ceE2cE4554bC4F628)

## How it works

1. Hold an Agent ID (verified on-chain via the registry's `balanceOf`).
2. Grant a delegation: pick a delegate (must also hold an Agent ID), a scope,
   and an expiry.
   - Scope `1` = check-in — the delegate may check in on your behalf.
   - Scope `2` = general — a general-purpose delegation.
3. The delegate acts for you. `checkInFor(delegator)` records one delegated
   check-in and emits `DelegatedCheckIn`.
4. Revoke any time with `revokeDelegate`, or let it expire — `isDelegate`
   returns false once the expiry passes.

## Contract

`contracts/AgentDelegate.sol` — single contract, no payable functions, never
holds funds. The owner can only pause/unpause (disclosed in the hackathon
submission). Owner is `0x4A0fa64e6bE1191DC8ae603290A11E782D818851`.

Key functions:

- `grantDelegate(address delegate, uint8 scope, uint256 expiry)`
- `revokeDelegate(address delegate, uint8 scope)`
- `isDelegate(address delegator, address delegate, uint8 scope) view returns (bool)`
- `checkInFor(address delegator)`
- `grants(address, address, uint8) view returns (uint256)` — stored expiry (0 = no grant)
- `delegatedCheckIns(address) view returns (uint256)`

## Development

```sh
npm install
node compile.mjs        # solc 0.8.39, optimizer 200 runs, evmVersion shanghai
node test-local.mjs     # 19 checks on ganache (mock Agent ID registry)
node deploy-mainnet.mjs # deploys to BSC, transfers ownership to w1
node build-verify-json.mjs  # Standard JSON input for Sourcify / BscScan
node flatten.mjs        # single-file source for BscScan fallback
```

`verify-input.json` is the exact Standard JSON input used for verification;
`AgentDelegate.flattened.sol` is the flattened single-file source.

## License

MIT
