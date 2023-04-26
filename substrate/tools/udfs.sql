


CREATE OR REPLACE FUNCTION `substrate-etl.evm-dev.parse_UniswapV3Pool_event_Swap(data: ARRAY, topics: ARRAY)
RETURNS FLOAT64
LANGUAGE js
OPTIONS (library=["gs://blockchain-etl-bigquery/ethers.js"])
AS r"""
var abi = {"anonymous": false, "inputs": [{"indexed": true, "internalType": "address", "name": "sender", "type": "address"}, {"indexed": true, "internalType": "address", "name": "recipient", "type": "address"}, {"indexed": false, "internalType": "int256", "name": "amount0", "type": "int256"}, {"indexed": false, "internalType": "int256", "name": "amount1", "type": "int256"}, {"indexed": false, "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"}, {"indexed": false, "internalType": "uint128", "name": "liquidity", "type": "uint128"}, {"indexed": false, "internalType": "int24", "name": "tick", "type": "int24"}], "name": "Swap", "type": "event"}

    var interface_instance = new ethers.utils.Interface([abi]);

    // A parsing error is possible for common abis that don't filter by contract address. Event signature is the same
    // for ABIs that only differ by whether a field is indexed or not. E.g. if the ABI provided has an indexed field
    // but the log entry has this field unindexed, parsing here will throw an exception.
    try {
      var parsedLog = interface_instance.parseLog({topics: topics, data: data});
    } catch (e) {
        return null;
    }

    var parsedValues = parsedLog.values;

    var transformParams = function(params, abiInputs) {
        var result = {};
        if (params && params.length >= abiInputs.length) {
            for (var i = 0; i < abiInputs.length; i++) {
                var paramName = abiInputs[i].name;
                var paramValue = params[i];
                if (abiInputs[i].type === 'address' && typeof paramValue === 'string') {
                    // For consistency all addresses are lower-cased.
                    paramValue = paramValue.toLowerCase();
                }
                if (ethers.utils.Interface.isIndexed(paramValue)) {
                    paramValue = paramValue.hash;
                }
                if (abiInputs[i].type === 'tuple' && 'components' in abiInputs[i]) {
                    paramValue = transformParams(paramValue, abiInputs[i].components)
                }
                result[paramName] = paramValue;
            }
        }
        return result;
    };

    var result = transformParams(parsedValues, abi.inputs);

    return result;
""";


----
SELECT count(*) numCalls, call_section, call_method
FROM `substrate-etl.wagmedia.users` as users join 
`substrate-etl.polkadot_enterprise.calls` as calls
 on users.account_pubkey = calls.signer_pub_key
 where account_pubkey is not null
 and date(block_time) >= date(date_sub(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
 group by call_section,  call_method
 order by numCalls desc;


CREATE FUNCTION `substrate-etl.wagmedia.democracyLiveness`(section STRING, method STRING)
RETURNS FLOAT64
LANGUAGE js
AS r"""
  switch ( method ) {
    case 'vote':
    case 'removeVote':    
    case 'delegate':    
    case 'undelegate':     
    case 'payoutStakers':     
    case 'delegatorBondMore':    
    case 'unlock':    
    case 'setIdentity':   
    case 'second':   
      return 20;    
 }
 return 0;
""";

CREATE FUNCTION `substrate-etl.wagmedia.defiLiveness`(section STRING, method STRING)
RETURNS FLOAT64
LANGUAGE js
AS r"""
  switch ( method ) {
    case 'sellAsset':
    case 'setPrice':
    case 'claim':
    case 'claimRewards':
    case 'transferMultiasset':
    case 'swapExactAssetsForAssets':
    case 'swapAssetsForExactAssets':
    case 'swapWithExactSupply':
    case 'swapExactAmountIn':
    case 'swapExactAmountOut':
    case 'limitedTeleportAssets':
    case 'buy':
    case 'sell':
    case 'claim':
    case 'contribute': 
    case 'withdrawClaim':
    case 'withdrawRewards':
    case 'withdrawShares':
    case 'addLiquidity':    
    case 'mintLiquidity':
      return 20;    
 }
 return 0;
""";

CREATE FUNCTION `substrate-etl.wagmedia.stakingLiveness`(section STRING, method STRING)
RETURNS FLOAT64
LANGUAGE js
AS r"""
  switch ( method ) {
    case 'stake':
    case 'claimStaker':
      return 20;    
 }
 return 0;
""";

