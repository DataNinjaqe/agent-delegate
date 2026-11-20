// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Minimal view of the SPACE ID Agent ID registry (ERC-721).
interface IAgentIDRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentDelegate
/// @notice Agent ID holders delegate scoped, expiring, revocable permissions
/// to another Agent ID holder. First live action: delegated check-in.
/// No payable functions; this contract never holds funds.
contract AgentDelegate is Ownable, Pausable {
    IAgentIDRegistry public immutable registry;

    uint8 public constant SCOPE_CHECK_IN = 1;
    uint8 public constant SCOPE_GENERAL = 2;

    /// delegator => delegate => scope => expiry timestamp (0 = no grant)
    mapping(address => mapping(address => mapping(uint8 => uint256))) public grants;
    /// delegator => number of check-ins done for them by a delegate
    mapping(address => uint256) public delegatedCheckIns;

    event DelegateGranted(address indexed delegator, address indexed delegate, uint8 indexed scope, uint256 expiry);
    event DelegateRevoked(address indexed delegator, address indexed delegate, uint8 indexed scope);
    event DelegatedCheckIn(address indexed delegator, address indexed delegate, uint256 timestamp);

    constructor(address registry_) Ownable(msg.sender) {
        require(registry_ != address(0), "registry required");
        registry = IAgentIDRegistry(registry_);
    }

    modifier onlyAgentID(address who) {
        require(registry.balanceOf(who) > 0, "not an Agent ID holder");
        _;
    }

    /// @notice Grant `delegate` a scoped permission until `expiry` (unix seconds).
    /// Re-granting the same (delegate, scope) overwrites the expiry.
    function grantDelegate(address delegate, uint8 scope, uint256 expiry)
        external
        whenNotPaused
        onlyAgentID(msg.sender)
    {
        require(delegate != address(0), "bad delegate");
        require(delegate != msg.sender, "cannot delegate to self");
        require(registry.balanceOf(delegate) > 0, "delegate must hold Agent ID");
        require(scope == SCOPE_CHECK_IN || scope == SCOPE_GENERAL, "bad scope");
        require(expiry > block.timestamp, "expiry must be future");
        grants[msg.sender][delegate][scope] = expiry;
        emit DelegateGranted(msg.sender, delegate, scope, expiry);
    }

    /// @notice Revoke a grant immediately.
    function revokeDelegate(address delegate, uint8 scope) external whenNotPaused {
        require(grants[msg.sender][delegate][scope] != 0, "no grant");
        delete grants[msg.sender][delegate][scope];
        emit DelegateRevoked(msg.sender, delegate, scope);
    }

    /// @notice True only when the grant exists and has not expired.
    function isDelegate(address delegator, address delegate, uint8 scope) public view returns (bool) {
        uint256 expiry = grants[delegator][delegate][scope];
        return expiry != 0 && expiry > block.timestamp;
    }

    /// @notice A check-in delegate checks in on the delegator's behalf.
    function checkInFor(address delegator) external whenNotPaused onlyAgentID(msg.sender) {
        require(isDelegate(delegator, msg.sender, SCOPE_CHECK_IN), "not an active check-in delegate");
        delegatedCheckIns[delegator] += 1;
        emit DelegatedCheckIn(delegator, msg.sender, block.timestamp);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
