// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.

const Crawler = require("./crawler");
const paraTool = require("./paraTool");
const mysql = require("mysql2");

module.exports = class IdentityManager extends Crawler {
    debugLevel = 0;
    /*
    debugLevel = 0 no console log
    debugLevel = 1 error only
    debugLevel = 2 info
    debugLevel = 3 verbose
    */
    constructor(debugLevel = false) {
        super()

        if (debugLevel) {
            this.debugLevel = debugLevel;
        }
    }

    async getHeader(chainID) {
        let bn = false;
        let blockHash = false;
        let chain = await this.setupChainAndAPI(chainID);
        try {
            let h = await this.api.rpc.chain.getHeader()
            if (h.toJSON() != undefined) {
                bn = paraTool.dechexToInt(h.toJSON().number) - 1
                blockHash = paraTool.dechexToInt(h.toJSON().parentHash) - 1
            }
        } catch (e) {
            console.log(`getHeader err`, e.toString())
            return [false, false]
        }
        return [bn, blockHash]
    }

    async updateOnChainProxyFull(chainID) {
        let proxyAddrs = await this.getOnchainProxyList(chainID);
        await this.updateOnChainProxy(chainID, proxyAddrs)
    }

    async updateOnChainSubIdentitiesFull(chainID) {
        let identityAddrs = await this.getOnchainSubIdentityList(chainID);
        await this.updateOnChainSubIdentities(chainID, identityAddrs)
    }

    async updateOnChainIdentitiesFull(chainID) {
        let identityAddrs = await this.getOnchainIdentityList(chainID);
        await this.updateOnChainIdentities(chainID, identityAddrs)
    }

    async getKnownIdentityList(chainID) {
        let sql = false;
        let identityAddrs = []
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return identityAddrs
        }
        if (chainID == paraTool.chainIDPolkadot) {
            sql = 'select address from account where info is not null;'
        } else if (chainID == paraTool.chainIDKusama) {
            sql = 'select address from account where infoKSM is not null;'
        }

        var knownAccts = await this.poolREADONLY.query(sql);
        for (const a of knownAccts) {
            identityAddrs.push({
                address: a.address
            })
        }
        return identityAddrs
    }

    async getOnchainIdentityList(chainID) {
        let identityAddrs = []
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return identityAddrs
        }
        let chain = await this.setupChainAndAPI(chainID);
        let keys = await this.api.query.identity.identityOf.keys()
        for (const key of keys) {
            let addr = paraTool.getPubKey(key.args.map((k) => k.toHuman())[0])
            identityAddrs.push({
                address: addr
            })
        }
        return identityAddrs
    }

    async updateOnChainIdentities(chainID, identityAddrs) {
        // step 0: only accept polkadot/kusama
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
        }

        // step 1: pass in a list of addrs from (query res)
        console.log(`[${chainID}] Input: identityAddrs[${identityAddrs.length}]`)

        //step 2: currl identity records
        // maintain two list (latest registry + removed)
        let identityRecs = []
        let removedRecs = []
        let chain = await this.setupChainAndAPI(chainID);
        for (const a of identityAddrs) {
            let [found, r] = await this.fetchOnchainIdentity(chainID, a.address)
            if (found) {
                //identityRecs.push(r)
                /*
                [0x08754abb6afba51a2f74f0b97bbcdb383f579a02a5e4541fee736710af562c6c] {
                address: '0x08754abb6afba51a2f74f0b97bbcdb383f579a02a5e4541fee736710af562c6c',
                judgements: [ { registrarIndex: 0, status: 'knownGood' } ],
                info: {
                  additional: [],
                  display: 'Parity',
                  legal: 'Parity Technologies (UK) Ltd',
                  web: 'https://parity.io/',
                  email: 'info@parity.io',
                  twitter: '@paritytech'
                  }
                }
                */
                let judgementsStr = mysql.escape(JSON.stringify(r.judgements))
                let infoStr = mysql.escape(JSON.stringify(r.info))
                var d = `('${r.address}', ${judgementsStr}, ${infoStr})`
                identityRecs.push(d)
            } else {
                removedRecs.push(r)
            }
        }


        if (chainID == paraTool.chainIDPolkadot) {
            console.log(`[Polkadot] current identityRecs[${identityRecs.length}]`, identityRecs)
            console.log(`[Polkadot] Removed identityRecs[${removedRecs.length}]`, removedRecs)
            let removedAddrList = `"` + removedRecs.join('","') + `"`
            let removevalSQL = `update account set info = null, judgements = null where address in (${removedAddrList})`
            console.log(removevalSQL);
            this.batchedSQL.push(removevalSQL);
            await this.update_batchedSQL();

            // step 3: update mysql tbl
            await this.upsertSQL({
                "table": "account",
                "keys": ["address"],
                "vals": ["judgements", "info"],
                "data": identityRecs,
                "replace": ["judgements", "info"],
            }, true);
        }

        if (chainID == paraTool.chainIDKusama) {
            console.log(`[Kusama] current identityRecs[${identityRecs.length}]`, identityRecs)
            console.log(`[Kusama] Removed identityRecs[${removedRecs.length}]`, removedRecs)
            let removedAddrList = `"` + removedRecs.join('","') + `"`
            let removevalSQL = `update account set infoKSM = null, judgementsKSM = null where address in (${removedAddrList})`
            console.log(removevalSQL);
            this.batchedSQL.push(removevalSQL);
            await this.update_batchedSQL();

            // step 3: update mysql tbl
            await this.upsertSQL({
                "table": "account",
                "keys": ["address"],
                "vals": ["judgementsKSM", "infoKSM"],
                "data": identityRecs,
                "replace": ["judgementsKSM", "infoKSM"],
            }, true);
        }
    }


    async getKnownSubIdentityList(chainID) {
        let sql = false;
        let subIdentityAddrs = []
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return subIdentityAddrs
        }
        if (chainID == paraTool.chainIDKusama) {
            sql = 'select address as subAddress from subaccount where parentKSM is not null;'
        } else if (chainID == paraTool.chainIDPolkadot) {
            sql = 'select address as subAddress from subaccount where parent is not null;'
        }

        var subaccounts = await this.poolREADONLY.query(sql);
        for (const suba of subaccounts) {
            subIdentityAddrs.push({
                subAddress: suba.subAddress
            })
        }
        return subIdentityAddrs
    }

    async getOnchainSubIdentityList(chainID) {
        let subIdentityAddrs = []
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return subIdentityAddrs
        }
        let chain = await this.setupChainAndAPI(chainID);
        let keys = await this.api.query.identity.superOf.keys()
        for (const key of keys) {
            let addr = paraTool.getPubKey(key.args.map((k) => k.toHuman())[0])
            subIdentityAddrs.push({
                subAddress: addr
            })
        }
        return subIdentityAddrs
    }

    async updateOnChainSubIdentities(chainID, subIdentityAddrs) {
        // step 0: only accept polkadot/kusama
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
        }

        // step 1: pass in a list of addrs from (query res)
        console.log(`[${chainID}] Input: subIdentityAddrs[${subIdentityAddrs.length}]`)

        //step 2: currl identity records
        // maintain two list (latest registry + removed)
        let subIdentityRecs = []
        let removedSubIdentityRecs = []
        let chain = await this.setupChainAndAPI(chainID);
        for (const a of subIdentityAddrs) {
            let [found, r] = await this.fetchOnchainSubIdentity(chainID, a.subAddress)
            if (found) {
                //identityRecs.push(r)
                /*
                [0x08754abb6afba51a2f74f0b97bbcdb383f579a02a5e4541fee736710af562c6c] {
                address: '0x08754abb6afba51a2f74f0b97bbcdb383f579a02a5e4541fee736710af562c6c',
                judgements: [ { registrarIndex: 0, status: 'knownGood' } ],
                info: {
                  additional: [],
                  display: 'Parity',
                  legal: 'Parity Technologies (UK) Ltd',
                  web: 'https://parity.io/',
                  email: 'info@parity.io',
                  twitter: '@paritytech'
                  }
                }
                */
                var d = `('${r.subAddress}', '${r.parentAddress}', '${r.subName}')`
                subIdentityRecs.push(d)
            } else {
                removedSubIdentityRecs.push(r)
            }
        }


        if (chainID == paraTool.chainIDPolkadot) {
            console.log(`[Polkadot] current subIdentityRecs[${subIdentityRecs.length}]`, subIdentityRecs)
            console.log(`[Polkadot] Removed subIdentityRecs[${removedSubIdentityRecs.length}]`, removedSubIdentityRecs)
            let removedAddrList = `"` + removedSubIdentityRecs.join('","') + `"`
            let removevalSQL = `update subaccount set parent = null, subName = null where address in (${removedAddrList})`
            console.log(removevalSQL);
            this.batchedSQL.push(removevalSQL);
            await this.update_batchedSQL();

            // step 3: update mysql tbl
            await this.upsertSQL({
                "table": "subaccount",
                "keys": ["address"],
                "vals": ["parent", "subName"],
                "data": subIdentityRecs,
                "replace": ["parent", "subName"],
            }, true);
        }

        if (chainID == paraTool.chainIDKusama) {
            console.log(`[Kusama] current subIdentityRecs[${subIdentityRecs.length}]`, subIdentityRecs)
            console.log(`[Kusama] Removed subIdentityRecs[${removedSubIdentityRecs.length}]`, removedSubIdentityRecs)
            let removedAddrList = `"` + removedSubIdentityRecs.join('","') + `"`
            let removevalSQL = `update subaccount set parentKSM = null, subNameKSM = null where address in (${removedAddrList})`
            console.log(removevalSQL);
            this.batchedSQL.push(removevalSQL);
            await this.update_batchedSQL();

            // step 3: update mysql tbl
            await this.upsertSQL({
                "table": "subaccount",
                "keys": ["address"],
                "vals": ["parentKSM", "subNameKSM"],
                "data": subIdentityRecs,
                "replace": ["parentKSM", "subNameKSM"],
            }, true);
        }

    }



    async fetchOnchainIdentity(chainID, addr) {
        let val = await this.api.query.identity.identityOf(addr)
        let decoratedVal = val.toString()
        let decoratedVal2 = JSON.stringify(val.toHuman())
        let identityRec = this.processIdentityVal(chainID, addr, decoratedVal, decoratedVal2)
        return identityRec
    }


    /*
      kusama: 1077
      polkadot: 486

      async getOnchainSubIdentityList(chainID) {
          if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
              console.log(`skipped. only support polkadot/kusama`)
          }
          let chain = await this.setupChainAndAPI(chainID);
          let keys = await this.api.query.identity.subsOf.entries()
          let subIdentityAddrs = []
          for (const key of keys) {
              let addr = paraTool.getPubKey(key.args.map((k) => k.toHuman())[0])
              subIdentityAddrs.push({
                  address: addr
              })
          }
          return identityAddrs
      }

    */

    async fetchOnchainSubIdentity(chainID, subAddr) {
        let val = await this.api.query.identity.superOf(subAddr)
        let decoratedVal = val.toString()
        let decoratedVal2 = JSON.stringify(val.toHuman())
        let identityRec = this.processSubIdentityVal(chainID, subAddr, decoratedVal, decoratedVal2)
        return identityRec
    }

    processIdentityVal(chainID, addr, decoratedVal, decoratedVal2) {
        //console.log(`parsed [${addr}]`, decoratedVal)
        //can not differentiate cleared vs failed extrinsic - add both
        let identityRec = {
            address: addr,
            judgements: [],
            info: {},
        }
        try {
            if (decoratedVal == '') {
                //identity removed / failed to begin with
                console.log(`[${addr}] removed`)
                return [false, addr]
            }
            let v = JSON.parse(decoratedVal)
            let v2 = JSON.parse(decoratedVal2)

            //let v = ledec(val)
            //console.log(`parsed [${addr}]`, v)
            for (const j of v.judgements) {
                let registar = {
                    registrarIndex: j[0],
                    status: Object.keys(j[1])[0]
                }
                identityRec.judgements.push(registar)
            }

            let vInfo = v.info
            for (const fld of Object.keys(vInfo)) {
                if (chainID == paraTool.chainIDPolkadot) {
                    identityRec['info'].polkadotAddress = paraTool.getAddress(addr, paraTool.chainIDPolkadot)
                } else if (chainID == paraTool.chainIDKusama) {
                    identityRec['info'].kusamaAddress = paraTool.getAddress(addr, paraTool.chainIDKusama)
                }
                if (fld == 'additional') {
                    identityRec['info'].additional = v2.info.additional
                } else {
                    let vObj = vInfo[fld]
                    if (vObj === null) {
                        //identityRec['info'][fld] = 'Null'
                    } else if (vObj.raw != undefined) {
                        identityRec['info'][fld] = paraTool.hexToString(vObj.raw)
                    } else if (vObj.none === null) {
                        //identityRec['info'][fld] = 'None'
                    } else {
                        let vObjKey = Object.keys(vObj)[0]
                        let vObjVal = vObj[vObjKey]
                        identityRec['info'][fld] = {
                            type: vObjKey,
                            val: vObjVal,
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`processIdentityVal err decoratedVal=${decoratedVal}, err=`, e)
        }
        console.log(`[${addr}]`, identityRec)
        return [true, identityRec]
    }


    processSubIdentityVal(chainID, subAddr, decoratedVal, decoratedVal2) {
        //console.log(`parsed [${addr}]`, decoratedVal)
        //can not differentiate cleared vs failed extrinsic - add both
        let subIdentityRec = {
            parentAddress: null,
            subAddress: subAddr,
            subName: null,
        }
        try {
            if (decoratedVal == '') {
                //identity removed / failed to begin with
                console.log(`subIdentity [${addr}] removed`)
                return [false, addr]
            }
            let v = JSON.parse(decoratedVal)
            let v2 = JSON.parse(decoratedVal2)

            subIdentityRec.parentAddress = paraTool.getPubKey(v2[0])
            let nameFld = v2[1]
            for (const fld of Object.keys(nameFld)) {
                if (fld == 'Raw') {
                    subIdentityRec.subName = `${nameFld[fld]}`
                } else {
                    subIdentityRec.subName = `${nameFld[fld]} (${fld})`
                }
            }

            //console.log(`parsed [${subAddr}]`, v)

        } catch (e) {
            console.log(`processSubIdentityVal err decoratedVal=${decoratedVal}, err=`, e)
        }
        console.log(`[${subAddr}]`, subIdentityRec)
        return [true, subIdentityRec]
    }

    async getKnownProxyList(chainID) {
        let sql = false;
        let proxyAddrs = []
        /*
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return identityAddrs
        }
        */
        sql = `select address, delegate from proxyaccount where chainID=${chainID};`
        var knownProxyAccts = await this.poolREADONLY.query(sql);
        var knownProxyAcctsMap = {}
        for (const a of knownProxyAccts) {
            if (knownProxyAcctsMap[a.address] == undefined) {
                knownProxyAcctsMap[a.address] = {
                    address: a.address,
                    delegates: [],
                }
            }
            knownProxyAcctsMap[a.address].delegates.push(a.delegate)
        }
        for (const p of Object.keys(knownProxyAcctsMap)) {
            proxyAddrs.push(knownProxyAcctsMap[p])
        }
        return proxyAddrs
    }

    async getOnchainProxyList(chainID) {
        let proxyAddrs = []
        /*
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`skipped. only support polkadot/kusama`)
            return identityAddrs
        }
        */
        let chain = await this.setupChainAndAPI(chainID);
        let keys = await this.api.query.proxy.proxies.keys()
        for (const key of keys) {
            let addr = paraTool.getPubKey(key.args.map((k) => k.toHuman())[0])
            proxyAddrs.push({
                address: addr,
                delegates: [],
            })
        }
        return proxyAddrs
    }


    async updateOnChainProxy(chainID, proxyAddrs) {
        // step 0: get header
        let [currentBN, currentBlockHash] = await this.getHeader(chainID)
        if (!currentBN || !currentBlockHash) {
            console.log('terminated!!')
            return
        }
        // step 1: pass in a list of addrs from (query res)
        console.log(`[${chainID}] Input: proxyAddrs[${proxyAddrs.length}]`)

        //step 2: currl identity records
        // maintain two list (latest registry + removed)
        let proxyRecs = []
        let fullyRemovedProxyAddrs = []
        let removedProxySQL = []
        let chain = await this.setupChainAndAPI(chainID);
        for (const p of proxyAddrs) {
            let proxyAddr = p.address
            let [found, r] = await this.fetchOnchainProxy(chainID, proxyAddr, p.delegates, currentBlockHash)
            if (found) {
                console.log(`found proxy addr=${proxyAddr}`, r)
                for (const dl of r.delegates) {
                    let delegatePieces = dl.split('|')
                    var d = `('${chainID}', '${proxyAddr}', '${delegatePieces[1]}', '${delegatePieces[2]}', '${delegatePieces[3]}', '${currentBN}','${currentBN}')`
                    proxyRecs.push(d)
                }
                if (r.removed.length > 0) {
                    let removedDelegateList = `"` + r.removed.join('","') + `"`
                    console.log(`[partially removed] proxy addr=${proxyAddr}. removedAddr=${removedDelegateList}`)
                    let removevalSQL = `delete from proxyaccount where address = '${proxyAddr}' and delegates in (${removedDelegateList}) and chainID = ${chainID}`
                    removedProxySQL.push(removevalSQL)
                    this.batchedSQL.push(removevalSQL);
                }
            } else {
                console.log(`[fully removed] proxy addr=${proxyAddr}`)
                fullyRemovedProxyAddrs.push(proxyAddr)
            }
        }

        if (fullyRemovedProxyAddrs.length > 0) {
            let removedProxyList = `"` + fullyRemovedProxyAddrs.join('","') + `"`
            console.log(`[Fully removed] removedProxyList=${removedProxyList}`)
            let removevalSQL = `delete from proxyaccount where address in (${removedProxyList}) and chainID = ${chainID}`
            removedProxySQL.push(removevalSQL)
            this.batchedSQL.push(removevalSQL);
        }

        await this.upsertSQL({
            "table": "proxyaccount",
            "keys": ["chainID", "address", "delegate"],
            "vals": ["proxyType", "delay", "lastUpdateBN", "lastCrawlBN"],
            "data": proxyRecs,
            "replace": ["proxyType", "delay", "lastUpdateBN", "lastCrawlBN"],
        }, true);

        await this.update_batchedSQL();

    }


    async fetchOnchainProxy(chainID, addr, knownDelegates = [], currentBlockHash = false) {
        //console.log(`fetchOnchainProxy addr=${addr}`)
        let isFound = false
        let proxyRec = {
            address: addr,
            delegates: [],
            removed: [],
        }
        try {
            let val
            if (currentBlockHash) {
                //TODO..
                val = await this.api.query.proxy.proxies(addr)
            } else {
                val = await this.api.query.proxy.proxies(addr)
            }
            let decoratedVal = val.toString()
            let [recFound, currProxyRec] = this.processProxyVal(chainID, addr, knownDelegates, decoratedVal)
            isFound = recFound
            proxyRec = currProxyRec
        } catch (e) {
            console.log(`fetchOnchainProxy addr=${addr} err:`, e.toString())
            return [false, proxyRec]
        }
        return [isFound, proxyRec]
    }

    /*
    //HBVw5bpPWs3qwLq88YyovrXYDj6SUJvTwJ1oZi3J7JUwLx5 (0xcbc5959dbf516891fb1a22f198c9c0bc4b47e29df44d5f060240e3099e57ff1e)
    [
      [
        {
          delegate: 'ELue9okRW6cgRy1E5yP6zCvjvDvyr2WXCkzk3xmRk9qEFVW',
          proxyType: 'Governance',
          delay: 0
        },
        {
          delegate: 'Edyfdyoi4KJVdXUJ3SU3nuZYMpg13HHa1SWYtPDCV8UPdxy',
          proxyType: 'Staking',
          delay: 0
        },
        {
          delegate: 'HDVkVT2SyjEMxv4QWSuymAkoRigthkAn3fQeiSb56QBeXfZ',
          proxyType: 'Any',
          delay: 0
        }
      ],
      67023329100
    ]
    */
    processProxyVal(chainID, addr, knownDelegates = [], decoratedVal) {
        //console.log(`parsed [${addr}]`, decoratedVal)
        let proxyRec = {
            address: addr,
            delegates: [],
            removed: [],
        }
        let foundDelegates = {}
        try {
            if (decoratedVal == '[[],0]') {
                //identity removed
                console.log(`[${addr}] removed`)
                proxyRec.removed = knownDelegates
                return [false, proxyRec]
            }
            let v = JSON.parse(decoratedVal)
            let delegatesArr = v[0]
            let reservedBal = paraTool.dechexToInt(v[1])
            for (const d of delegatesArr) {
                let delegateAddr = d['delegate']
                let delegatePub = paraTool.getPubKey(delegateAddr)
                let delay = paraTool.dechexToInt(d['delay'])
                let delegateStr = `${delegateAddr}|${delegatePub}|${d['proxyType']}|${delay}`
                proxyRec.delegates.push(delegateStr)
                foundDelegates[delegatePub] = 1
            }
            for (const kd of knownDelegates) {
                if (!foundDelegates[kd]) {
                    // has been removed
                    proxyRec.removed.push(kd)
                } else {
                    console.log(`kd ${kd} found for ${addr}`)
                }
            }
        } catch (e) {
            console.log(`processIdentityVal err decoratedVal=${decoratedVal}, err=`, e)
        }
        console.log(`[${addr}]`, proxyRec)
        return [true, proxyRec]
    }

}