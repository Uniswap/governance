import { getEnvList } from "./deploy-utils";
import { NonceManager } from "@ethersproject/experimental";
import { ethers } from "hardhat";
import { getEnv } from "./deploy-utils";

const vestRecipients = getEnvList("VEST_RECIPIENTS");
const vestAmounts = getEnvList("VEST_AMOUNTS");
const vestStarts = getEnvList("VEST_STARTS");
const vestEnds = getEnvList("VEST_ENDS");
const vestCliffs = getEnvList("VEST_CLIFFS");
const termTokenAddress = getEnv("TERM_TOKEN");

async function main() {
  const [defaultSigner] = await ethers.getSigners();

  const managedSigner = new NonceManager(defaultSigner as any);

  const treasuryVesterFactory = await ethers.getContractFactory("TreasuryVester", managedSigner);
  for (let i = 0; i < vestRecipients.length; i++) {
    const vester = await treasuryVesterFactory.deploy(termTokenAddress, vestRecipients[i], vestAmounts[i], vestStarts[i], vestCliffs[i], vestEnds[i]);
    await vester.deployed()
    console.log(`Vester deployed to address ${vester.address} for recipient ${vestRecipients[i]} with amount ${vestAmounts[i]} starting at ${vestStarts[i]} with cliff ${vestCliffs[i]} and ending at ${vestEnds[i]}`);
  }
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

