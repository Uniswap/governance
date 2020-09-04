pragma solidity ^0.5.16;

contract FeeToSetterVester {
    address public factory;
    address public timelock;
    uint public vestingEnd;

    constructor(address factory_, address timelock_, uint vestingEnd_) public {
        factory = factory_;
        timelock = timelock_;
        assert(vestingEnd_ > block.timestamp);
        vestingEnd = vestingEnd_;
    }

    function divest() public {
        require(block.timestamp >= vestingEnd, 'FeeToSetterVester::divest: not time yet');
        IUniswapV2Factory(factory).setFeeToSetter(timelock);
    }
}

interface IUniswapV2Factory {
    function setFeeToSetter(address) external;
}