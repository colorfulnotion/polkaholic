cbt createtable  addressextrinsic  "families=feed:maxversions=1,feedunfinalized:maxversions=1,feedtransfer:maxversions=1,feedtransferunfinalized:maxversions=1,feedxcm:maxversions=1,feedxcmdest:maxversions=1,feedxcmunfinalized:maxversions=1,feedcrowdloan:maxversions=1,feedreward:maxversions=1"

cbt createtable  accountrealtime   "families=realtime:maxversions=1"
cbt createtable  accounthistory    "families=history:maxversions=1"

cbt createtable  hashes  "families=feed:maxversions=1,feedunfinalized:maxversions=1,feedevmunfinalized:maxversions=1,feedpending:maxversions=1,feedxcmdest:maxversions=1,related:maxversions=1"

cbt setgcpolicy  addressextrinsic  feedtransferunfinalized maxage=1200s or maxversions=1
cbt setgcpolicy  addressextrinsic  feedunfinalized maxage=7d or maxversions=1
cbt setgcpolicy  addressextrinsic  feedxcmunfinalized maxage=7d or maxversions=1
cbt setgcpolicy  hashes  feedunfinalized maxage=600s or maxversions=1
cbt setgcpolicy  hashes  feedevmunfinalized maxage=600s or maxversions=1
cbt setgcpolicy  hashes  feedpending maxage=600s or maxversions=1

cbt createtable  apikeys  "families=rate:maxversions=1,n:maxversions=1"
cbt setgcpolicy  apikeys  rate maxage=3d or maxversions=1

# chain tables follow the following schema; but evm chain tables have 4 additional columns: blockrawevm, feedevm, receiptsevm, traceevm
cbt createtable  chain0      "families=blockraw:maxversions=1,trace:maxversions=1,finalized:maxversions=1,n:maxversions=1,events:maxversions=1,feed:maxversions=1"
cbt createtable  chain2004   "families=blockraw:maxversions=1,trace:maxversions=1,finalized:maxversions=1,n:maxversions=1,events:maxversions=1,feed:maxversions=1,blockrawevm:maxversions=1,feedevm:maxversions=1,receiptsevm:maxversions=1,traceevm:maxversions=1"
