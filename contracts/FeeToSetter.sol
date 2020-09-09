pragma solidity ^0.5.16;

contract FeeToSetter {
    address public factory;
    uint public vestingEnd;

    address public timelock;
    address public feeToTarget;

    constructor(address factory_, uint vestingEnd_, address timelock_, address feeToTarget_) public {
        require(vestingEnd_ > block.timestamp, 'FeeToSetter::constructor: vesting must end after deployment');
        factory = factory_;
        vestingEnd = vestingEnd_;
        timelock = timelock_;
        feeToTarget = feeToTarget_;
    }

    // allows timelock to change itself at any time
    function setTimelock(address timelock_) public {
        require(msg.sender == timelock, 'FeeToSetter::setTimelock: not allowed');
        timelock = timelock_;
    }

    // allows timelock to set the address that feeTo will be set to if fees are turned on at any time
    function setFeeToTarget(address feeToTarget_) public {
        require(msg.sender == timelock, 'FeeToSetter::setFeeToTarget: not allowed');
        feeToTarget = feeToTarget_;
    }

    // allows timelock to turn fees on/off after vesting
    function toggleFees(bool on) public {
        require(block.timestamp >= vestingEnd, 'FeeToSetter::toggleFees: not time yet');
        require(msg.sender == timelock, 'FeeToSetter::toggleFees: not allowed');
        IUniswapV2Factory(factory).setFeeTo(on ? feeToTarget : address(0));
    }
}

interface IUniswapV2Factory {
    function setFeeTo(address) external;
}
