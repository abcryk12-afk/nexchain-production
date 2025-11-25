const { ethers } = require('ethers');
require('dotenv').config();

const mnemonic = process.env.MNEMONIC;
const derivationPath = process.env.DERIVATION_PATH || "m/44'/60'/0'/0/";

// HD Wallet instance
const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);

// Main wallet configuration
const mainWallet = new ethers.Wallet(process.env.MAIN_WALLET_PRIVATE_KEY);

// Generate child address for user
function generateChildAddress(index) {
  const childNode = hdNode.deriveChild(index);
  return {
    address: childNode.address,
    privateKey: childNode.privateKey,
    publicKey: childNode.publicKey,
    index: index
  };
}

// Get main wallet info
function getMainWallet() {
  return {
    address: mainWallet.address,
    privateKey: mainWallet.privateKey,
    publicKey: mainWallet.publicKey
  };
}

module.exports = {
  generateChildAddress,
  getMainWallet,
  hdNode,
  mainWallet,
  derivationPath
};