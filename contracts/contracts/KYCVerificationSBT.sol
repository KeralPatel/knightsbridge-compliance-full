// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title KYCVerificationSBT
/// @notice Soul-Bound Token (SBT) for KYC verification — non-transferable
/// @dev Implements ERC721 with transfer restrictions to create soul-bound tokens
contract KYCVerificationSBT is ERC721, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct KYCData {
        uint256 tokenId;
        address holder;
        KYCLevel level;
        uint256 issuedAt;
        uint256 expiresAt;
        bytes32 dataHash;    // hash of off-chain KYC data
        string jurisdiction;
        bool revoked;
    }

    enum KYCLevel { BASIC, STANDARD, ENHANCED, INSTITUTIONAL }

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 private _nextTokenId = 1;
    mapping(uint256 => KYCData) public kycData;
    mapping(address => uint256) public holderToken;  // one SBT per wallet
    mapping(address => bool) public isKYCd;

    string private _baseTokenURI;

    // ─── Events ───────────────────────────────────────────────────────────────
    event KYCMinted(address indexed holder, uint256 indexed tokenId, KYCLevel level, uint256 expiresAt);
    event KYCRevoked(address indexed holder, uint256 indexed tokenId, string reason);
    event KYCRenewed(uint256 indexed tokenId, uint256 newExpiry);
    event KYCUpgraded(uint256 indexed tokenId, KYCLevel oldLevel, KYCLevel newLevel);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) ERC721("KCC KYC Verification", "KCCKYC") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Issue a KYC SBT to a verified address
    function issueKYC(
        address to,
        KYCLevel level,
        uint256 validityDays,
        bytes32 dataHash,
        string calldata jurisdiction
    ) external onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256) {
        require(to != address(0), "KYCVerificationSBT: zero address");
        require(!isKYCd[to], "KYCVerificationSBT: already has KYC");
        require(validityDays > 0 && validityDays <= 3650, "KYCVerificationSBT: invalid validity");

        uint256 tokenId = _nextTokenId++;
        uint256 expiresAt = block.timestamp + (validityDays * 1 days);

        kycData[tokenId] = KYCData({
            tokenId: tokenId,
            holder: to,
            level: level,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            dataHash: dataHash,
            jurisdiction: jurisdiction,
            revoked: false
        });

        holderToken[to] = tokenId;
        isKYCd[to] = true;

        _safeMint(to, tokenId);

        emit KYCMinted(to, tokenId, level, expiresAt);
        return tokenId;
    }

    /// @notice Revoke a KYC token
    function revokeKYC(uint256 tokenId, string calldata reason) external onlyRole(REVOKER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "KYCVerificationSBT: token not found");
        require(!kycData[tokenId].revoked, "KYCVerificationSBT: already revoked");

        address holder = kycData[tokenId].holder;
        kycData[tokenId].revoked = true;
        isKYCd[holder] = false;

        _burn(tokenId);
        delete holderToken[holder];

        emit KYCRevoked(holder, tokenId, reason);
    }

    /// @notice Renew an existing KYC token
    function renewKYC(uint256 tokenId, uint256 additionalDays) external onlyRole(ISSUER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "KYCVerificationSBT: token not found");
        require(!kycData[tokenId].revoked, "KYCVerificationSBT: revoked");

        uint256 currentExpiry = kycData[tokenId].expiresAt;
        uint256 newExpiry = (currentExpiry > block.timestamp ? currentExpiry : block.timestamp)
            + (additionalDays * 1 days);

        kycData[tokenId].expiresAt = newExpiry;
        emit KYCRenewed(tokenId, newExpiry);
    }

    /// @notice Upgrade KYC level
    function upgradeKYC(uint256 tokenId, KYCLevel newLevel) external onlyRole(ISSUER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "KYCVerificationSBT: token not found");
        require(!kycData[tokenId].revoked, "KYCVerificationSBT: revoked");

        KYCLevel oldLevel = kycData[tokenId].level;
        require(uint8(newLevel) > uint8(oldLevel), "KYCVerificationSBT: cannot downgrade");

        kycData[tokenId].level = newLevel;
        emit KYCUpgraded(tokenId, oldLevel, newLevel);
    }

    // ─── Soul-Bound: Transfer Restrictions ───────────────────────────────────

    /// @dev Override to block all transfers (soul-bound)
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Only allow minting (from == 0) and burning (to == 0)
        require(
            from == address(0) || to == address(0),
            "KYCVerificationSBT: soul-bound, non-transferable"
        );
        return super._update(to, tokenId, auth);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function isVerified(address holder) external view returns (bool) {
        if (!isKYCd[holder]) return false;
        uint256 tokenId = holderToken[holder];
        if (kycData[tokenId].revoked) return false;
        return kycData[tokenId].expiresAt > block.timestamp;
    }

    function getKYCData(address holder) external view returns (KYCData memory) {
        uint256 tokenId = holderToken[holder];
        return kycData[tokenId];
    }

    function getKYCByTokenId(uint256 tokenId) external view returns (KYCData memory) {
        return kycData[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "KYCVerificationSBT: nonexistent token");
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    function setBaseURI(string calldata baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    // ─── Interface Support ────────────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
