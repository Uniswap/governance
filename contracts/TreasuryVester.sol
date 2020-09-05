pragma solidity ^0.5.16;

import "./SafeMath.sol";

contract TreasuryVester {
    using SafeMath for uint;

    address public uni;
    address public recipient;

    uint public vestingAmount;
    uint public vestingBegin;
    uint public vestingEnd;

    uint public lastUpdate;

    constructor(address uni_, address recipient_, uint vestingAmount_, uint vestingBegin_, uint vestingEnd_) public {
        uni = uni_;
        recipient = recipient_;
        vestingAmount = vestingAmount_;
        assert(vestingBegin_ > block.timestamp);
        vestingBegin = vestingBegin_;
        assert(vestingEnd_ > vestingBegin_);
        vestingEnd = vestingEnd_;
        lastUpdate = vestingBegin;
    }

    function setRecipient(address recipient_) public {
        require(msg.sender == recipient, 'TreasuryVester::setRecipient: unauthorized');
        recipient = recipient_;
    }

    function claim() public {
        require(block.timestamp > vestingBegin, 'TreasuryVester::claim: not time yet');
        uint amount;
        if (block.timestamp >= vestingEnd) {
            amount = IUni(uni).balanceOf(address(this));
        } else {
            amount = vestingAmount.mul(block.timestamp - lastUpdate).div(vestingEnd - vestingBegin);
            lastUpdate = block.timestamp;
        }
        IUni(uni).transfer(recipient, amount);
    }
}

interface IUni {
    function balanceOf(address account) external view returns (uint);
    function transfer(address dst, uint rawAmount) external returns (bool);
}