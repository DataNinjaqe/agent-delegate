# Agent Delegate — DESIGN.md

第二参赛项目（币安 Agent ID 黑客松）。与 Agent Squad 完全不同类型：
Squad 是社交组队游戏；Delegate 是基础设施原语——Agent 之间的授权委托。

## 一句话

Agent 不可能 24 小时在线。Agent Delegate 让一个 Agent ID 持有者把指定权限委托给另一个可信的 Agent ID：有范围、有期限、可撤销，全程链上可查。

## 玩法

1. 持有 Agent ID 的地址 A（委托人）授权另一个持有 Agent ID 的地址 B（被委托人）。
2. 授权带范围 scope 与过期时间 expiry，到期自动失效；委托人随时可撤销。
3. 被委托人凭授权代委托人执行动作。首个落地动作：代签到 `checkInFor(delegator)`——B 替 A 完成一次签到，链上记数并发出事件。
4. 任何人可链上查 `isDelegate(delegator, delegate, scope)` 验证授权是否有效。

## 范围 scope（uint8）

- 1 = 代签到（CHECK_IN）
- 2 = 通用代操作（GENERAL）

## 合约 AgentDelegate（单合约，BSC）

- 无 payable 函数、永不持币。
- 注册表：SPACE ID Agent ID `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`，`balanceOf` 验身份。
- 授权与撤销：
  - `grantDelegate(address delegate, uint8 scope, uint256 expiry)`：调用者与被委托人都须持有 Agent ID；expiry 须在未来；同一 (delegator, delegate, scope) 重复授权覆盖过期时间。
  - `revokeDelegate(address delegate, uint8 scope)`：删除授权。
  - `isDelegate(address delegator, address delegate, uint8 scope) returns (bool)`：授权存在、未撤销、未过期。
- 代执行：
  - `checkInFor(address delegator)`：调用者须是 delegator 的 scope=1 有效被委托人；`delegatedCheckIns[delegator] += 1`，事件 `DelegatedCheckIn(delegator, delegate, timestamp)`。
  - `delegatedCheckIns(address) returns (uint256)` 公开读数。
- owner 仅可 pause/unpause（提交材料中披露）。部署后 owner 转给 w1 xixiya。

## 前端

连接钱包 → 查 Agent ID → 授权表单（被委托人地址 + 范围 + 天数）→ 我的授权（我发出的 / 我收到的）→ 撤销 → 代签到演示。静态站 + ethers.js，作为提交材料里的「官网」。

## 技术栈（与 Squad 同一套，已验证）

- solc 0.8.39+commit.ce47f2c8，optimizer 开（runs 200），evmVersion shanghai，OZ @openzeppelin/contracts@5.0.2。
- 部署走一次性 EOA 0x16B5cE7673186590299E68cC81B4eDEd7336591F（私钥只存 ~/workspace/agent-squad/.deployer-key 0600，绝不外泄、不推送、不复制进仓库）；部署后 owner 转 w1 xixiya。
- 验证先走 Sourcify（BscScan 自家验证在 Squad 上失败 4 次），再核对 BscScan 合约页。
- GitHub：DataNinjaqe/agent-delegate（公开），白名单复制，.gitignore 含 .deployer-key。
- 演示视频：同 Squad 做法（旁白 + 卡片），Chromium 装成后换实拍版。

## 参赛定位

- 冲应用创新奖：Agent ID 应用深度（委托是 Agent 协作的基础原语）、实用性（Agent 掉线/休眠是真问题）、完成度、创新性。
- 门槛同样是产品已上线 + 期内 ≥30 个 Agent ID 地址交互；推广走同一套路（X 帖 + 双话题）。
- 与 Squad 的关系：两个独立项目、独立合约、独立提交；Delegate 的代签到动作设计上可与 Squad 的小队签到呼应，但不依赖 Squad 合约。

## 费用

- 部署约 0.0001 BNB（Squad 实测 0.000095），部署地址现有约 0.0006 BNB，够用，无需再转。
- 授权/撤销/代签到各一笔 gas，约 0.05 gwei。

## 待定

- 第二个项目的表单是独立提交还是与 Squad 同一团队多投：以官方表单规则为准，提交前核对。
- 传播奖是按项目还是按人：X 帖须另发一条带 Delegate 链接的原创帖。
