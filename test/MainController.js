const {expect} = require('chai');

describe('Simple Checks', () => {
    let MainController;
    let owner, addr1;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
        [owner, addr1] = await ethers.getSigners();
    });

    describe('Deployment', () => {
        it('Should set the right owner', async () => {
            expect(await contract.owner()).to.equal(owner.address);
        });

        it('Should not get paused by random addresses', async () =>{
            await expect(contract.connect(addr1).pause()).to.be.revertedWith('Ownable: caller is not the owner');
        })
    });

    describe('Whitelisting', () => {
        it('Should whitelist the right address for the collections', async () => {
            await contract.whitelistCollection('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
            expect(await contract.allowedCollections('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).to.equal(true);
        });

        it('Should not whitelist random addresses for the collections', async () => {
            await contract.whitelistCollection('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
            expect(await contract.allowedCollections('0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.equal(false);
        });

        it('Should whitelist the right address for the currencies', async () => {
            await contract.whitelistCurrency('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
            expect(await contract.allowedCurrency('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).to.equal(true);
        });

        it('Should not whitelist random addresses for the currencies', async () => {
            await contract.whitelistCurrency('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
            expect(await contract.allowedCurrency('0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.equal(false);
        });

        it('Should not let random address whitelist collections', async () => {
            await expect(contract.connect(addr1).whitelistCollection('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should not let random address whitelist currencies', async () => {
            await expect(contract.connect(addr1).whitelistCurrency('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).to.be.revertedWith('Ownable: caller is not the owner');
        });

    });
});

describe('Main Controller', () => {
    let MainController;
    let Token;
    let owner, addr1, addr2;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
        Token = await ethers.getContractFactory('TokenTest');
        token = await Token.deploy();
        [owner, addr1, addr2, _] = await ethers.getSigners();
        await token.mint(addr1.address, 100000000000);
        await contract.whitelistCollection('0xdAC17F958D2ee523a2206206994597C13D831ec7');
        await contract.whitelistCurrency('0xdAC17F958D2ee523a2206206994597C13D831ec7');
        await contract.whitelistCollection('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
        await contract.whitelistCurrency(token.address);
        await contract.createOffer('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 0, 1000000, 1, 15, token.address);
        firstOffer = await contract.offerInfo('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 0);
    });

    describe('Creating offers', () => {
        it('Should set the right addresses for the offer', async () => {
            await contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 1000000, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7');
            let offer = await contract.offerInfo('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0);
            expect(offer.borrower).to.equal(owner.address);
            expect(offer.lender).to.equal('0x0000000000000000000000000000000000000000');
        });

        it('Should not create the offer with a wrong amount', async () => {
            await expect(contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 100, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.be.revertedWith('ERROR: the loan is too small');
        });

        it('Should not have a time duration of 0', async () => {
            await expect(contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 1000000, 0, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.be.revertedWith("ERROR: the loan time duration can't be 0");
        });

        it('Check whitelisted collection for the offer', async () => {
            await expect(contract.createOffer('0x0000000000000000000000000000000000000000', 0, 1000000, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.be.revertedWith('ERROR: the collection used is not whitelisted');
        });

        it('Check whitelisted currency for the offer', async () => {
            await expect(contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 1000000, 1, 15, '0x0000000000000000000000000000000000000000')).to.be.revertedWith('ERROR: the currency used is not whitelisted');
        });

        it('Should not create the offer if the contract is paused', async () => {
            await contract.pause();
            await expect(contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 1000000, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7')).to.be.revertedWith('Pausable: paused');
            await contract.unpause();
            await contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0, 1000000, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7');
            let offer = await contract.offerInfo('0xdAC17F958D2ee523a2206206994597C13D831ec7', 0);
            expect(offer.loanTimeStart).to.equal(0);
        });

        it('Should change variables when the offer is created', async () => {
            expect(await contract.totalOffers()).to.be.equal(1);
            expect(await contract.offerPerAddress(owner.address)).to.be.equal(1);
            await contract.createOffer('0xdAC17F958D2ee523a2206206994597C13D831ec7', 10, 1000000, 1, 15, '0xdAC17F958D2ee523a2206206994597C13D831ec7');
            expect(await contract.totalOffers()).to.be.equal(2);
            expect(await contract.offerPerAddress(owner.address)).to.be.equal(2);
            expect(await contract.collectionInfoPerAddress(owner.address, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 0)).to.be.equal(10);
        });

    });

    describe('Withdraw Offer', () => {

        it('The offer should not have started before the withdraw', async () => {
            await token.connect(addr1).approve(contract.address, 1000000000000);
            await contract.connect(addr1).acceptOffer('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 0);
            await expect(contract.whitdrawOffer('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 0)).to.be.revertedWith('ERROR: the offer already started');
        });

    });

});