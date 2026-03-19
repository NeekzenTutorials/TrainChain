pragma solidity ^0.8.19;

contract Counter {
    uint public count;

    function increment() public {
        count = count + 1;
    }

    function decrement() public {
        require(count > 0, "Le compteur est deja a zero");
        count = count - 1;
    }

    function reset() public {
        count = 0;
    }

    function getCount() public view returns(uint) {
        return count;
    }
}