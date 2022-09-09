cbt createtable  addressextrinsic  "families=feed:maxversions=1,feedunfinalized:maxversions=1,feedtransfer:maxversions=1,feedtransferunfinalized:maxversions=1,feedxcm:maxversions=1,feedxcmdest:maxversions=1,feedxcmunfinalized:maxversions=1,feedcrowdloan:maxversions=1,feedreward:maxversions=1"
cbt setgcpolicy  addressextrinsic  feedtransferunfinalized maxage=1200s or maxversions=1
cbt setgcpolicy  addressextrinsic  feedunfinalized maxage=7d or maxversions=1
cbt setgcpolicy  addressextrinsic  feedxcmunfinalized maxage=7d or maxversions=1

cbt createtable  accountrealtime   "families=realtime:maxversions=1,wasmcontract:maxversions=1,evmcontract:maxversions=1"
cbt createfamily accountrealtime wasmcontract
cbt createfamily accountrealtime evmcontract
cbt setgcpolicy  accountrealtime wasmcontract maxversions=1
cbt setgcpolicy  accountrealtime evmcontract maxversions=1

cbt createtable  accounthistory    "families=history:maxversions=1"

cbt createtable  hashes  "families=feed:maxversions=1,feedunfinalized:maxversions=1,feedevmunfinalized:maxversions=1,feedpending:maxversions=1,feedxcmdest:maxversions=1,xcmmessage:maxversions=1,symbol:maxversions=1,chain:maxversions=1,wasmcode:maxversions=1"
cbt createfamily hashes  xcmmessage
cbt createfamily hashes  symbol
cbt createfamily hashes  chain
cbt createfamily hashes  wasmcode
cbt setgcpolicy  hashes  xcmmessage maxversions=1
cbt setgcpolicy  hashes  symbol     maxversions=1
cbt setgcpolicy  hashes  chain      maxversions=1
cbt setgcpolicy  hashes  wasmcode   maxversions=1
cbt setgcpolicy  hashes  feedunfinalized maxage=600s or maxversions=1
cbt setgcpolicy  hashes  feedevmunfinalized maxage=600s or maxversions=1
cbt setgcpolicy  hashes  feedpending maxage=600s or maxversions=1

cbt createtable  apikeys  "families=rate:maxversions=1,n:maxversions=1"
cbt setgcpolicy  apikeys  rate maxage=3d or maxversions=1

# chain tables follow the following schema; but evm chain tables have 4 additional columns: blockrawevm, feedevm, receiptsevm, traceevm
cbt createtable  chain0      "families=blockraw:maxversions=1,autotrace=maxversions=1,trace:maxversions=1,finalized:maxversions=1,n:maxversions=1,events:maxversions=1,feed:maxversions=1"
cbt createtable  chain2004   "families=blockraw:maxversions=1,autotrace=maxversions=1,trace:maxversions=1,finalized:maxversions=1,n:maxversions=1,events:maxversions=1,feed:maxversions=1,blockrawevm:maxversions=1,feedevm:maxversions=1,receiptsevm:maxversions=1,traceevm:maxversions=1"


# rowKey:  {contractAddress}#{invTS}#{txhash}
#  feedto:       evmtx incoming INTO contract by users (whereas addressextrinsic feed is from other the users)
#  feedinternal: txn initiated BY contract during execution
#  feederc20:    erc20transfer incoming/outgoing into/out from contract
cbt createtable  evmtx          "families=feedto:maxversions=1,feedinternal:maxversions=1,feederc20:maxversions=1"

# Note: contract transfers are already in addressextrinsic "feedtransfer" column family ({contractAddress}#{invTS}#{txhash}, column: {txhash}#{eventID}
# Example: cbt read addressextrinsic prefix=0xacc15dc74880c9944775448304b263d191c6077f
# 0xacc15dc74880c9944775448304b263d191c6077f#0x9cb8855e#0x4929dabb5e40262c53697b3d6c47e797c09aa6ecd1c55df3e55e2ed88313b429
#   feedtransfer:0x4929dabb5e40262c53697b3d6c47e797c09aa6ecd1c55df3e55e2ed88313b429#2004-1812817-7-71 @ 2022/09/06-20:12:18.000000

