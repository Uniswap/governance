pragma solidity ^0.5.16;

contract FeeToSetterVester {
    address public factory;
    address public timelock;
    uint public vestingEnd;
    address public feeToSetterToBe;

    constructor(address factory_, address timelock_, uint vestingEnd_) public {
        require(vestingEnd_ > block.timestamp, 'FeeToSetterVester::constructor: vesting must end after deployment');

        factory = factory_;
        timelock = timelock_;
        vestingEnd = vestingEnd_;
    }

    function setFeeToSetterToBe(address feeToSetterToBe_) public {
        require(msg.sender == timelock, 'FeeToSetterVester::setFeeToSetterToBe: not authorized');
        feeToSetterToBe = feeToSetterToBe_;
    }

    function divest() public {
        require(block.timestamp >= vestingEnd, 'FeeToSetterVester::divest: not time yet');
        require(feeToSetterToBe != address(0), 'FeeToSetterVester::divest: zero address');
        IUniswapV2Factory(factory).setFeeToSetter(feeToSetterToBe);
    }
}

interface IUniswapV2Factory {
    function setFeeToSetter(address) external;
}