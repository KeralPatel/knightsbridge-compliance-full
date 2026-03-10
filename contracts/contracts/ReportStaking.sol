// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ReportStaking
/// @notice Stake tokens to submit scam reports — Sybil resistance mechanism
/// @dev Stakes are slashed for false reports, returned for verified reports with bonus
contract ReportStaking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Stake {
        address staker;
        uint256 amount;
        uint256 reportId;        // off-chain report ID
        StakeStatus status;
        uint256 stakedAt;
        uint256 resolvedAt;
    }

    enum StakeStatus { ACTIVE, RETURNED, SLASHED, REWARDED }

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20 public immutable stakeToken;
    uint256 public minStakeAmount;
    uint256 public rewardMultiplier = 120; // 120% = 20% bonus on verified reports
    uint256 public slashPercentage  = 50;  // 50% slashed for false reports

    mapping(uint256 => Stake) public stakes;
    mapping(address => uint256[]) public stakerStakes;
    uint256 public nextStakeId = 1;

    uint256 public totalStaked;
    uint256 public totalSlashed;
    uint256 public totalRewarded;

    address public treasury;

    // ─── Events ───────────────────────────────────────────────────────────────
    event StakeDeposited(uint256 indexed stakeId, address indexed staker, uint256 amount, uint256 reportId);
    event StakeReturned(uint256 indexed stakeId, address indexed staker, uint256 amount);
    event StakeRewarded(uint256 indexed stakeId, address indexed staker, uint256 amount);
    event StakeSlashed(uint256 indexed stakeId, address indexed staker, uint256 slashedAmount);
    event MinStakeUpdated(uint256 oldAmount, uint256 newAmount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address admin,
        address _stakeToken,
        uint256 _minStakeAmount,
        address _treasury
    ) {
        require(_stakeToken != address(0), "ReportStaking: zero token");
        require(_treasury != address(0), "ReportStaking: zero treasury");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(RESOLVER_ROLE, admin);

        stakeToken = IERC20(_stakeToken);
        minStakeAmount = _minStakeAmount;
        treasury = _treasury;
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Stake tokens to submit a report
    function stakeForReport(
        uint256 reportId,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(amount >= minStakeAmount, "ReportStaking: below minimum stake");
        require(reportId > 0, "ReportStaking: invalid report id");

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 stakeId = nextStakeId++;
        stakes[stakeId] = Stake({
            staker: msg.sender,
            amount: amount,
            reportId: reportId,
            status: StakeStatus.ACTIVE,
            stakedAt: block.timestamp,
            resolvedAt: 0
        });

        stakerStakes[msg.sender].push(stakeId);
        totalStaked += amount;

        emit StakeDeposited(stakeId, msg.sender, amount, reportId);
        return stakeId;
    }

    /// @notice Return stake — report was valid but not verified (neutral outcome)
    function returnStake(uint256 stakeId) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Stake storage stake = stakes[stakeId];
        require(stake.status == StakeStatus.ACTIVE, "ReportStaking: not active");

        stake.status = StakeStatus.RETURNED;
        stake.resolvedAt = block.timestamp;
        totalStaked -= stake.amount;

        stakeToken.safeTransfer(stake.staker, stake.amount);
        emit StakeReturned(stakeId, stake.staker, stake.amount);
    }

    /// @notice Reward staker — report was verified
    function rewardStake(uint256 stakeId) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Stake storage stake = stakes[stakeId];
        require(stake.status == StakeStatus.ACTIVE, "ReportStaking: not active");

        stake.status = StakeStatus.REWARDED;
        stake.resolvedAt = block.timestamp;

        uint256 rewardAmount = (stake.amount * rewardMultiplier) / 100;
        totalStaked -= stake.amount;
        totalRewarded += rewardAmount;

        // Reward comes from treasury for the bonus portion
        uint256 bonus = rewardAmount - stake.amount;
        stakeToken.safeTransfer(stake.staker, stake.amount);
        if (bonus > 0) {
            stakeToken.safeTransferFrom(treasury, stake.staker, bonus);
        }

        emit StakeRewarded(stakeId, stake.staker, rewardAmount);
    }

    /// @notice Slash stake — false report (Sybil attack protection)
    function slashStake(uint256 stakeId) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Stake storage stake = stakes[stakeId];
        require(stake.status == StakeStatus.ACTIVE, "ReportStaking: not active");

        stake.status = StakeStatus.SLASHED;
        stake.resolvedAt = block.timestamp;

        uint256 slashAmount = (stake.amount * slashPercentage) / 100;
        uint256 returnAmount = stake.amount - slashAmount;

        totalStaked -= stake.amount;
        totalSlashed += slashAmount;

        // Slashed portion goes to treasury
        stakeToken.safeTransfer(treasury, slashAmount);
        // Remainder returned to staker
        if (returnAmount > 0) {
            stakeToken.safeTransfer(stake.staker, returnAmount);
        }

        emit StakeSlashed(stakeId, stake.staker, slashAmount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getStake(uint256 stakeId) external view returns (Stake memory) {
        return stakes[stakeId];
    }

    function getStakerStakes(address staker) external view returns (uint256[] memory) {
        return stakerStakes[staker];
    }

    function getContractBalance() external view returns (uint256) {
        return stakeToken.balanceOf(address(this));
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setMinStakeAmount(uint256 newMin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit MinStakeUpdated(minStakeAmount, newMin);
        minStakeAmount = newMin;
    }

    function setRewardMultiplier(uint256 multiplier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(multiplier >= 100, "ReportStaking: multiplier < 100");
        rewardMultiplier = multiplier;
    }

    function setSlashPercentage(uint256 percentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(percentage <= 100, "ReportStaking: exceeds 100");
        slashPercentage = percentage;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "ReportStaking: zero address");
        treasury = _treasury;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
