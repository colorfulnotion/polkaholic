beauty:
	js-beautify -r index.js api.js substrate/*.js substrate/chains/*.js public/account.js public/accountui.js public/address.js public/addressui.js public/asset.js public/assetui.js public/block.js public/chains.js public/chainsadmin.js public/chainui.js public/evmblock.js public/query.js public/symbol.js public/timeline.js public/token.js public/trace.js public/tx.js public/uihelper.js public/verify.js public/wallet.js public/wasmcode.js public/wasmcontract.js substrate/test/*.js test/*.js substrate/xcmTrace
	@echo "Done beautifying Polkaholic!"
