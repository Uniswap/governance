pragma solidity ^0.5.16;

contract FeeToSetter {
    address public factory;
    uint public vestingEnd;

    address public timelock;
    address public handler;

    struct TokenAllowState {
        bool    allowed;
        uint128 disallowCount;
    }
    mapping(address => TokenAllowState) public tokenAllowStates;

    struct PairAllowState {
        uint128 token0DisallowCount;
        uint128 token1DisallowCount;
    }
    mapping(address => PairAllowState) public pairAllowStates;

    constructor(address factory_, uint vestingEnd_, address timelock_) public {
        require(vestingEnd_ > block.timestamp, 'FeeToSetter::constructor: vesting must end after deployment');
        factory = factory_;
        vestingEnd = vestingEnd_;
        timelock = timelock_;
    }

    function setTimelock(address timelock_) public {
        require(msg.sender == timelock, 'FeeToSetter::setTimelock: not allowed');
        timelock = timelock_;
    }

    function setHandler(address handler_) public {
        require(msg.sender == timelock, 'FeeToSetter::setHandler: not allowed');
        handler = handler_;
    }

    function setFeeTo(bool on) public {
        require(block.timestamp >= vestingEnd, 'FeeToSetter::setFeeTo: not time yet');
        require(msg.sender == timelock, 'FeeToSetter::setFeeTo: not allowed');
        IUniswapV2Factory(factory).setFeeTo(on ? address(this) : address(0));
    }

    function updateTokenAllowState(address token, bool allowed) public {
        require(msg.sender == timelock, 'FeeToSetter::updateAllow: not allowed');
        TokenAllowState storage tokenAllowState = tokenAllowStates[token];
        tokenAllowState.allowed = allowed;
        // this condition will only be true on the first call to this function (regardless of the value of allowed)
        // by effectively initializing disallowCount to 1,
        // we force renounce to be called for all pairs including newly allowed token
        if (tokenAllowState.disallowCount == 0) {
            tokenAllowState.disallowCount = 1;
        } else if (allowed == false) {
            tokenAllowState.disallowCount += 1;
        }
    }

    function updateTokenAllowStates(address[] memory tokens, bool allowed) public {
        for (uint i; i < tokens.length; i++) {
            updateTokenAllowState(tokens[i], allowed);
        }
    }

    function renounce(address pair) public returns (uint value) {
        PairAllowState storage pairAllowState = pairAllowStates[pair];
        TokenAllowState storage token0AllowState = tokenAllowStates[IUniswapV2Pair(pair).token0()];
        TokenAllowState storage token1AllowState = tokenAllowStates[IUniswapV2Pair(pair).token1()];

        // we must renounce if any of the following four conditions are true:
        // 1) token0 is currently disallowed
        // 2) token1 is currently disallowed
        // 3) token0 was disallowed at least once since the last time renounce was called
        // 4) token1 was disallowed at least once since the last time renounce was called
        if (
            token0AllowState.allowed == false ||
            token1AllowState.allowed == false ||
            token0AllowState.disallowCount > pairAllowState.token0DisallowCount ||
            token1AllowState.disallowCount > pairAllowState.token1DisallowCount
        ) {
            value = IUniswapV2Pair(pair).balanceOf(address(this));
            if (value > 0) {
                // burn balance into the pair, effectively redistributing underlying tokens pro-rata back to LPs
                // (assert because transfer cannot fail with value as balanceOf)
                assert(IUniswapV2Pair(pair).transfer(pair, value));
                IUniswapV2Pair(pair).burn(pair);
            }

            // if token0 is allowed, we can now update the pair's disallow count to match the token's
            if (token0AllowState.allowed) {
                pairAllowState.token0DisallowCount = token0AllowState.disallowCount;
            }
            // if token1 is allowed, we can now update the pair's disallow count to match the token's
            if (token1AllowState.allowed) {
                pairAllowState.token1DisallowCount = token1AllowState.disallowCount;
            }
        }
    }

    function claim(address pair) public returns (uint value) {
        PairAllowState storage pairAllowState = pairAllowStates[pair];
        TokenAllowState storage token0AllowState = tokenAllowStates[IUniswapV2Pair(pair).token0()];
        TokenAllowState storage token1AllowState = tokenAllowStates[IUniswapV2Pair(pair).token1()];

        // we may claim only if each of the following five conditions are true:
        // 1) token0 is currently allowed
        // 2) token1 is currently allowed
        // 3) renounce was not called since the last time token0 was disallowed
        // 4) renounce was not called since the last time token1 was disallowed
        // 5) handler is not the 0 address
        if (
            token0AllowState.allowed &&
            token1AllowState.allowed &&
            token0AllowState.disallowCount == pairAllowState.token0DisallowCount &&
            token1AllowState.disallowCount == pairAllowState.token1DisallowCount &&
            handler != address(0)
        ) {
            value = IUniswapV2Pair(pair).balanceOf(address(this));
            if (value > 0) {
                // transfer tokens to the handler (assert because transfer cannot fail with value as balanceOf)
                assert(IUniswapV2Pair(pair).transfer(handler, value));
            }
        }
    }
}

interface IUniswapV2Factory {
    function setFeeTo(address) external;
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function burn(address to) external returns (uint amount0, uint amount1);
}