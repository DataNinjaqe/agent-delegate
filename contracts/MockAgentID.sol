// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Test-only mock of the SPACE ID Agent ID registry (ERC-721, balanceOf-gated).
contract MockAgentID is ERC721 {
    uint256 public nextId = 1;

    constructor() ERC721("Mock Agent ID", "MAID") {}

    function mint(address to) external returns (uint256 id) {
        id = nextId++;
        _safeMint(to, id);
    }
}
