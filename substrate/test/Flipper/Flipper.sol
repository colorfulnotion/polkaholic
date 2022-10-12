pragma solidity 0.8.17;

contract flipper {
        bool private value;
        int public counter;

        event Flipped(address indexed from, bool value, int counter);

        constructor(bool initvalue) {
                value = initvalue;
                counter = 0;
        }

        function flip() public {
                value = !value;
                counter+=1;
                emit Flipped(msg.sender, value, counter);
        }

        function get() public view returns (bool) {
                return value;
        }

        function getCounter() public view returns (int) {
            return counter;
        }
}
