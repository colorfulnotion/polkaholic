
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

