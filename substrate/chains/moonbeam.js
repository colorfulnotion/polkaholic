const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class MoonbeamParser extends ChainParser {

    processIncomingXCM(indexer, extrinsic, extrinsicID, events, finalized = false) {
        //IMPORTANT: reset umpReceived at the start of every unsigned extrinsic
        this.umpReceived = false;
        //console.log(`[${extrinsicID}] processIncomingXCM start`, `umpReceived=${this.umpReceived}`)

        //step0. parse incoming messages (raw)
        super.processIncomingXCMMessages(indexer, extrinsic, extrinsicID, events, finalized)

        //step1. parse incoming transfer heuristically
        for (const e of events) {
            this.processIncomingXCMSignal(indexer, extrinsic, extrinsicID, e, finalized)
        }

        for (const e of events) {
            let [candidate, caller] = this.processIncomingAssetSignal(indexer, extrinsicID, e, finalized)
            if (candidate) {
                indexer.updateXCMTransferDestCandidate(candidate, caller)
            }
        }
    }

    processIncomingXCMSignal(indexer, extrinsic, extrinsicID, e, finalized = false) {
        return super.processIncomingXCMSignal(indexer, extrinsicID, e, finalized)
    }

    processIncomingAssetSignal(indexer, extrinsicID, e, finalized = false) {
        let [candidate, caller] = super.processIncomingAssetSignal(indexer, extrinsicID, e, finalized)
        caller = `generic processIncomingAssetSignal assets:Issued`
        if (candidate && candidate.asset != undefined) {
            //remove xc
            candidate.asset = candidate.asset.replace('xc', '') //temporary hack to remove the xc in asset..
        }
        return [candidate, caller]
    }

    processOutgoingXCM(indexer, extrinsic, feed, fromAddress, section = false, method = false, args = false) {
        let module_section = section;
        let module_method = method
        if (section == false && section == false) {
            module_section = extrinsic.section;
            module_method = extrinsic.method;
            args = extrinsic.params
        }
        let section_method = `${module_section}:${module_method}`
        //let outgoingXcmList = [];
        if (args.calls != undefined) { // this is an array
            //console.log(`[${extrinsic.extrinsicID}] descend into calls`, args.calls.length)
            let i = 0;
            for (const c of args.calls) {
                let call_section = c.section;
                let call_method = c.method;
                //console.log(`[${extrinsic.extrinsicID}] call`, i, call_section, call_method, c);
                i++;
                this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, c.args)
            }
        } else if (args.call != undefined) { // this is an object
            let call = args.call
            let call_section = call.section;
            let call_method = call.method;
            //console.log(`[${extrinsic.extrinsicID}] descend into call`, call)
            this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, call.args)
        }
        switch (module_section) {
            case 'xTokens':
                let outgoingXcmList1 = this.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXCM xTokens`, outgoingXcmList1)
                //return outgoingXcmList
                break;
            case 'xcmPallet':
                let outgoingXcmList2 = this.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXcmPallet xcmPallet`, outgoingXcmList2)
                //return outgoingXcmList
                break;
            case 'polkadotXcm':
                let outgoingXcmList3 = this.processOutgoingPolkadotXcm(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXCM polkadotXcm`, outgoingXcmList3)
                //return outgoingXcmList
                break;
            default:
                //console.log(`unknown`)
                //return outgoingXcmList
                break;
        }
    }

    processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // need additional processing for currency_id part
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXTokens start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
            if (assetString) {
                assetString = assetString.replace('xc', '') //temporary hack to remove the xc in asset..
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens xcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // TODO: have not seen case like this yet
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXcmPallet start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
            if (assetString) {
                assetString = assetString.replace('xc', '') //temporary hack to remove the xc in asset..
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`moonbeam processOutgoingXcmPallet xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`moonbeam processOutgoingXcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXcmPallet DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    rewardFilter(palletMethod) {
        if (palletMethod == "parachainStaking(Rewarded)") {
            //console.log(`processReward ${palletMethod}`)
            return true
            //return this.prepareFeedReward(rewardEvent)
        } else {
            return super.rewardFilter(palletMethod)
        }
    }

    prepareFeedReward(indexer, section, method, data, eventID) {
        let palletMethod = `${section}(${method})`
        //let data = rewardEvent.data
        if (palletMethod == "parachainStaking(Rewarded)") {
            /*
            "data": [
              "0x22bA795AA1223F0C8fAE2932F16F4b1F8B573163",
              "0x0000000000000000150101a8f3988e38"
            ]
            */

            let accountID = data[0]
            let bal = paraTool.dechexToInt(data[1]);
            let rewardRec = {
                eventID: eventID,
                section: section,
                method: method,
                account: accountID,
                value: bal
            }
            return rewardRec
        } else {
            return super.prepareFeedReward(indexer, section, method, data, eventID)
        }
        return false
    }
}