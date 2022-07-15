import {expect} from chai;

describe('Main Controller', () => {
    let MainController;

    beforeEach(async () => {
        MainController = await ethers.getContractFactory('MainController');
        contract = await MainController.deploy();
    });

    describe('Deployment', () => {
        it('')
    })
});
