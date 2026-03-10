// ── Common ABI Fragments ──────────────────────────────────────────────────────

export const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function renounceOwnership()",
  "function transferOwnership(address)",
];

export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const UNISWAP_V2_FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
  "function getPair(address, address) view returns (address)",
  "function allPairs(uint) view returns (address)",
  "function allPairsLength() view returns (uint)",
];

export const UNISWAP_V2_PAIR_ABI = [
  "event Mint(address indexed sender, uint amount0, uint amount1)",
  "event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)",
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
];

export const UNISWAP_V3_FACTORY_ABI = [
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
];

export const PAIR_CREATED_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

export const POOL_CREATED_V3_TOPIC =
  "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";

// Common function signatures for risk analysis
export const DANGEROUS_FUNCTION_SIGS: Record<string, string> = {
  "0x40c10f19": "mint(address,uint256)",
  "0x9dc29fac": "burn(address,uint256)",
  "0xf2fde38b": "transferOwnership(address)",
  "0x715018a6": "renounceOwnership()",
  "0x8456cb59": "pause()",
  "0x3f4ba83a": "unpause()",
  "0x4906b849": "blacklist(address)",
  "0x537df3b6": "unblacklist(address)",
  "0x5b7633d0": "setMaxTxAmount(uint256)",
  "0xa457c2d7": "decreaseAllowance(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x18160ddd": "totalSupply()",
  "0x06fdde03": "name()",
  "0x95d89b41": "symbol()",
};

// Known mixer contract addresses
export const KNOWN_MIXERS: Record<number, string[]> = {
  1: [
    "0x722122dF12D4e14e13Ac3b6895a86e84145b6967", // Tornado Cash 0.1 ETH
    "0xdd4c48C0B24039969fC16D1cdF626eaB821d3384", // Tornado Cash 1 ETH
    "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b", // Tornado Cash 10 ETH
    "0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF", // Tornado Cash 100 ETH
    "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", // Tornado Cash 1000 ETH
    "0x94Be88213a387E992Dd87DE56950a9aef34b9448", // Tornado Cash DAI 100k
    "0xb1C8094b234DcE6e03f10a5b673c1d8C69739A00", // Tornado Cash DAI 1M
    "0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3", // Tornado Cash DAI 10k
  ],
};
