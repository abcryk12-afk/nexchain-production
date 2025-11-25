const { ethers } = require('ethers');
require('dotenv').config();

const USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT_ADDRESS,
  USDT_ABI,
  provider
);

module.exports = {
  provider,
  usdtContract,
  USDT_ABI,
  network: {
    name: 'BSC Mainnet',
    chainId: 56,
    confirmationsRequired: parseInt(process.env.CONFIRMATIONS_REQUIRED) || 3
  },
  gas: {
    price: ethers.parseUnits(process.env.BSC_GAS_PRICE || '5', 'gwei'),
    limit: parseInt(process.env.BSC_GAS_LIMIT) || 100000
  },
  token: {
    address: process.env.USDT_CONTRACT_ADDRESS,
    decimals: parseInt(process.env.USDT_DECIMALS) || 18,
    minDeposit: ethers.parseUnits(process.env.MIN_DEPOSIT_AMOUNT || '1', 18)
  }
};