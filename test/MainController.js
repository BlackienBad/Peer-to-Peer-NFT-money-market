const {expect} = require('chai');

let zeroAddress = '0x0000000000000000000000000000000000000000';

describe('Simple Checks', () => {
    let MainController;
    let owner, addr1;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
        Token = await ethers.getContractFactory('TokenTest');
        token = await Token.deploy();
        Collection = await ethers.getContractFactory('CollectionTest');
        collection = await Collection.deploy();
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
            await contract.whitelistCollection(collection.address);
            expect(await contract.allowedCollections(collection.address)).to.equal(true);
        });

        it('Should not whitelist random addresses for the collections', async () => {
            await contract.whitelistCollection(collection.address);
            expect(await contract.allowedCollections(token.address)).to.equal(false);
        });

        it('Should whitelist the right address for the currencies', async () => {
            await contract.whitelistCurrency(token.address);
            expect(await contract.allowedCurrency(token.address)).to.equal(true);
        });

        it('Should not whitelist random addresses for the currencies', async () => {
            await contract.whitelistCurrency(token.address);
            expect(await contract.allowedCurrency(collection.address)).to.equal(false);
        });

        it('Should not let random address whitelist collections', async () => {
            await expect(contract.connect(addr1).whitelistCollection(collection.address)).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should not let random address whitelist currencies', async () => {
            await expect(contract.connect(addr1).whitelistCurrency(token.address)).to.be.revertedWith('Ownable: caller is not the owner');
        });

    });
});

describe('Main Controller', () => {

    let MainController, Token, Collection;
    let owner, addr1, addr2;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
        Token = await ethers.getContractFactory('TokenTest');
        token = await Token.deploy();
        Collection = await ethers.getContractFactory('CollectionTest');
        collection = await Collection.deploy();
        [owner, addr1, addr2, _] = await ethers.getSigners();
        await token.mint(addr1.address, 100000000000);
        await token.connect(addr1).approve(contract.address, 100000000000);
        await collection.safeMint(owner.address, 0);
        await collection.safeMint(owner.address, 1);
        await collection.approve(contract.address, 0);
        await collection.approve(contract.address, 1);
        await contract.whitelistCollection(collection.address);
        await contract.whitelistCurrency(token.address);
        await contract.createOffer(collection.address, 0, 1000000, 1, 15, token.address);
        firstOffer = await contract.offerInfo(collection.address, 0);
    });

    describe('Creating offers', () => {
        it('Should set the right addresses for the offer', async () => {
            let offer = await contract.offerInfo(collection.address, 0);
            expect(offer.borrower).to.equal(owner.address);
            expect(offer.lender).to.equal(zeroAddress);
        });

        it('Should not create the offer with a wrong amount', async () => {
            await expect(contract.createOffer(collection.address, 0, 100, 1, 15, token.address)).to.be.revertedWith('ERROR: the loan is too small');
        });

        it('Should not have a time duration of 0', async () => {
            await expect(contract.createOffer(collection.address, 0, 1000000, 0, 15, token.address)).to.be.revertedWith("ERROR: the loan time duration can't be 0");
        });

        it('Check whitelisted collection for the offer', async () => {
            await expect(contract.createOffer(zeroAddress, 0, 1000000, 1, 15, token.address)).to.be.revertedWith('ERROR: the collection used is not whitelisted');
        });

        it('Check whitelisted currency for the offer', async () => {
            await expect(contract.createOffer(collection.address, 0, 1000000, 1, 15, zeroAddress)).to.be.revertedWith('ERROR: the currency used is not whitelisted');
        });

        it('Should not create the offer if the contract is paused', async () => {
            await contract.pause();
            await expect(contract.createOffer(collection.address, 1, 1000000, 1, 15, token.address)).to.be.revertedWith('Pausable: paused');
            await contract.unpause();
            await contract.createOffer(collection.address, 1, 1000000, 1, 15, token.address);
            let offer = await contract.offerInfo(collection.address, 1);
            expect(offer.loanTimeStart).to.equal(0);
        });

        it('Should change variables when the offer is created', async () => {
            expect(await contract.totalOffers()).to.be.equal(1);
            expect(await contract.offerPerAddress(owner.address)).to.be.equal(1);
            await contract.createOffer(collection.address, 1, 1000000, 1, 15, token.address);
            expect(await contract.totalOffers()).to.be.equal(2);
            expect(await contract.offerPerAddress(owner.address)).to.be.equal(2);
            expect(await contract.collectionInfoPerAddress(owner.address, collection.address, 0)).to.be.equal(0);
        });

    });

    describe('Withdraw Offer', () => {

        it('Should change the flag when the offer has been withdrawn', async () =>{
            let offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.controlFlags.withdrawn).to.be.equal(false);
            await contract.withdrawOffer(collection.address, 0);
            offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.controlFlags.withdrawn).to.be.equal(true);
        });

        it('The offer should not have started before the withdraw', async () => {
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await expect(contract.withdrawOffer(collection.address, 0)).to.be.revertedWith('ERROR: the offer already started');
        });

        it('Random addresses should not be able to withdraw the offer', async () => {
            await expect(contract.connect(addr1).withdrawOffer(collection.address, 0)).to.be.revertedWith('ERROR: you are not the borrower');
        });

        it('The offer should not be withdrawn after it started', async () => {
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await expect(contract.withdrawOffer(collection.address, 0)).to.be.revertedWith('ERROR: the offer already started');
        });

    });

    describe('Accept Offer', () => {

        it('Should change the lender and block.timestamp accordingly', async () => {
            let offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.loanTimeStart).to.be.equal(0);
            expect(offerTemp.lender).to.be.equal(zeroAddress);
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.loanTimeStart).to.be.equal(timestampBefore);
            expect(offerTemp.lender).to.be.equal(addr1.address);
        });

        it('The offer should exist', async () => {
            await expect(contract.acceptOffer(zeroAddress, 0)).to.be.revertedWith("ERROR: the offer doesn't exists");
        });

        it('Should not have started', async () => {
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await expect(contract.connect(addr2).acceptOffer(collection.address, 0)).to.be.revertedWith('ERROR: the offer already started');
        });

        it('Should not have been withdrawn', async () => {
            await contract.withdrawOffer(collection.address, 0);
            await expect(contract.connect(addr1).acceptOffer(collection.address, 0)).to.be.revertedWith('ERROR: the offer has been withdrawn');
        });

        it('The contract should not be paused', async () => {
            await contract.pause();
            await expect(contract.connect(addr1).acceptOffer(collection.address, 0)).to.be.revertedWith('Pausable: paused');
            await contract.unpause();
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            let offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.lender).to.be.equal(addr1.address);
        });

        it('Should change the balance of the lender', async () => {
            const balanceBefore = await token.balanceOf(addr1.address);
            let offerTemp = await contract.offerInfo(collection.address, 0);
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            expect(await token.balanceOf(addr1.address)).to.be.equal(balanceBefore - offerTemp.loanAmount);
        });

    });

    describe('Borrow', async () => {

        it('Should change the borrowed flag in the offer info', async () => {
            let offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.controlFlags.borrowed).to.be.equal(false);
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await contract.borrow(collection.address, 0);
            offerTemp = await contract.offerInfo(collection.address, 0);
            expect(offerTemp.controlFlags.borrowed).to.be.equal(true);
        });

        it('Should change the balance of the borrower', async () => {
            const balanceBefore = await token.balanceOf(owner.address);
            let offerTemp = await contract.offerInfo(collection.address, 0);
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await contract.borrow(collection.address, 0);
            expect(await token.balanceOf(owner.address)).to.be.equal(balanceBefore + offerTemp.loanAmount);
        });

        it('The offer should exist', async () => {
            await expect(contract.borrow(zeroAddress, 0)).to.be.revertedWith("ERROR: the offer doesn't exists");
        });

        it('Random addresses should not be able to borrow', async () => {
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await expect(contract.connect(addr2).borrow(collection.address, 0)).to.be.revertedWith('ERROR: you are not the borrower');
        });

        it('The offer should have already started', async () => {
            await expect(contract.borrow(collection.address, 0)).to.be.revertedWith('ERROR: the offer has not started');
        });

        it('Should fail if the offer has already been borrowed', async () => {
            await contract.connect(addr1).acceptOffer(collection.address, 0);
            await contract.borrow(collection.address, 0);
            await expect(contract.borrow(collection.address, 0)).to.be.revertedWith('ERROR: the amount has already been borrowed');
        });

    });

});

describe('Repay and withdraw', async () =>{

    let MainController, Token, Collection;
    let owner, addr1, addr2;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
        Token = await ethers.getContractFactory('TokenTest');
        token = await Token.deploy();
        Collection = await ethers.getContractFactory('CollectionTest');
        collection = await Collection.deploy();
        [owner, addr1, addr2, _] = await ethers.getSigners();
        await token.mint(addr1.address, 100000000000);
        await token.connect(addr1).approve(contract.address, 100000000000);
        await collection.safeMint(owner.address, 0);
        await collection.safeMint(owner.address, 1);
        await collection.approve(contract.address, 0);
        await collection.approve(contract.address, 1);
        await contract.whitelistCollection(collection.address);
        await contract.whitelistCurrency(token.address);
        await contract.createOffer(collection.address, 0, 1000000, 1, 15, token.address);
        firstOffer = await contract.offerInfo(collection.address, 0);
    });

});
