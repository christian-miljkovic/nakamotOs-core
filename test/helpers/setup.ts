import { deployments, ethers, network } from "hardhat";
import { deploy } from ".";
import { MAX_SUPPLY, NAME, SYMBOL, NFT_URI, MAX_NFT_SUPPLY } from "../../constants";
import { NakamotOsERC20, NakamotOsERC721 } from "../../typechain";
import { networkConfig, getNetworkIdFromName } from "../../config/networks";

const setup = deployments.createFixture(async hre => {
    const [admin, user] = await ethers.getSigners();
    const bagHolderAddress = await admin.getAddress();
    const networkId = Number(getNetworkIdFromName(hre.network.name));
    const networkParams = networkConfig[networkId];
    let { fee, keyHash, vrfCoordinator } = networkParams;
    const { linkToken: linkTokenAddress } = networkParams;

    let link;
    if (linkTokenAddress) {
        link = (await ethers.getContractFactory("LinkToken")).attach(linkTokenAddress as string);
    } else {
        fee = 1;
        keyHash = "0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4";
        vrfCoordinator = bagHolderAddress;
        link = await deploy("LinkToken", { args: [], connect: admin });
    }

    if (network.name === "kovan") {
        const { address: nftAddress } = await deployments.get("NakamotOsERC721");
        const { address: tokenAddress } = await deployments.get("NakamotOsERC20");

        const token = ((await ethers.getContractAt("NakamotOsERC20", tokenAddress)) as unknown) as NakamotOsERC20;
        const nft = ((await ethers.getContractAt("NakamotOsERC20", nftAddress)) as unknown) as NakamotOsERC721;

        return {
            token,
            nft,
            bagHolderAddress,
            userSigner: user,
            link,
            fee,
        };
    }

    const nft = ((await deploy("NakamotOsERC721", {
        args: [NAME, SYMBOL, NFT_URI],
        connect: admin,
        from: await admin.getAddress(),
    })) as unknown) as NakamotOsERC721;

    const token = ((await deploy("NakamotOsERC20", {
        args: [
            NAME,
            SYMBOL,
            MAX_SUPPLY,
            await admin.getAddress(),
            nft.address,
            MAX_NFT_SUPPLY,
            50, // lottery block
            keyHash,
            vrfCoordinator,
            link.address,
            fee,
        ],
        connect: admin,
    })) as unknown) as NakamotOsERC20;

    await nft.setERC20Address(token.address);
    await nft.renounceOwnership();

    return {
        token,
        nft,
        bagHolderAddress,
        userSigner: user,
        link,
        fee,
    };
});

export default setup;
