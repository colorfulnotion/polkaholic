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

const assetChainSeparator = "~"

module.exports = {

    // DebugLevel
    debugNoLog: 0,
    debugErrorOnly: 1,
    debugInfo: 2,
    debugVerbose: 3,
    debugTracing: 4,

    /*
    mysql> select chainID, id, chainName, crawling from chain where relaychain = 'polkadot' and crawling = 1;
    +---------+------------------+--------------------+----------+
    | chainID | id               | chainName          | crawling |
    +---------+------------------+--------------------+----------+
    |       0 | polkadot         | Polkadot           |        1 |
    |    1000 | statemint        | Statemint          |        1 |
    |    2000 | acala            | Acala              |        1 |
    |    2002 | clover           | Clover             |        1 |
    |    2004 | moonbeam         | Moonbeam           |        1 |
    |    2006 | astar            | Astar              |        1 |
    |    2011 | equilibrium      | Equilibrium        |        1 |
    |    2012 | parallel         | Parallel           |        1 |
    |    2013 | litentry         | Litentry           |        1 |
    |    2019 | composable       | Composable Finance |        1 |
    |    2021 | efinity          | Efinity            |        1 |
    |    2026 | nodle            | Nodle              |        1 |
    |    2030 | bifrost-dot      | Bifrost-Polkadot   |        1 |
    |    2031 | centrifuge       | Centrifuge         |        1 |
    |    2032 | interlay         | Interlay           |        1 |
    |    2034 | hydradx          | HydraDX            |        1 |
    |    2035 | phala            | Phala              |        1 |
    |    2037 | unique           | Unique             |        1 |
    |    2039 | integritee-shell | Integritee Shell   |        1 |
    |    2043 | origintrail      | Origin Trail       |        1 |
    |    2046 | darwinia         | Darwinia           |        1 |
    |    2052 | kylin            | Kylin              |        1 |
    +---------+------------------+--------------------+----------+

    mysql> select chainID, id, chainName, crawling from chain where relaychain = 'kusama' and crawling = 1;
    +---------+-------------------+---------------------+----------+
    | chainID | id                | chainName           | crawling |
    +---------+-------------------+---------------------+----------+
    |       2 | kusama            | Kusama              |        1 |
    |   21000 | statemine         | Statemine           |        1 |
    |   22000 | karura            | Karura              |        1 |
    |   22001 | bifrost-ksm       | Bifrost-Kusama      |        1 |
    |   22004 | khala             | Khala               |        1 |
    |   22007 | shiden            | Shiden              |        1 |
    |   22011 | sora              | Sora Kusama         |        1 |
    |   22012 | shadow            | Crust Shadow        |        1 |
    |   22015 | integritee        | Integritee          |        1 |
    |   22023 | moonriver         | Moonriver           |        1 |
    |   22024 | genshiro          | Genshiro            |        1 |
    |   22048 | robonomics        | Robonomics          |        1 |
    |   22084 | calamari          | Calamari            |        1 |
    |   22085 | parallel-heiko    | Parallel Heiko      |        1 |
    |   22086 | spiritnet         | KILT Spiritnet      |        1 |
    |   22087 | picasso           | Picasso             |        1 |
    |   22088 | altair            | Altair              |        1 |
    |   22090 | basilisk          | Basilisk            |        1 |
    |   22092 | kintsugi          | Kintsugi            |        1 |
    |   22095 | quartz            | Quartz              |        1 |
    |   22096 | bitcountrypioneer | Bit.Country Pioneer |        1 |
    |   22100 | subsocialx        | SubsocialX          |        1 |
    |   22101 | zeitgeist         | Zeitgeist           |        1 |
    |   22102 | pichiu            | Pichiu              |        1 |
    |   22105 | crab              | Darwinia Crab       |        1 |
    |   22106 | litmus            | Litmus              |        1 |
    |   22110 | mangatax          | Mangata             |        1 |
    |   22113 | kabocha           | Kabocha             |        1 |
    |   22114 | turing            | Turing              |        1 |
    |   22115 | dorafactory       | Dora Factory        |        1 |
    |   22118 | listen            | Listen              |        1 |
    |   22119 | bajun             | Bajun Network       |        1 |
    |   22121 | imbue             | Imbue Network       |        1 |
    |   22222 | daoipci           | DAO IPCI            |        1 |
    +---------+-------------------+---------------------+----------+

    */
    // Kusama parachains
    chainIDStatemine: 21000,
    chainIDEncointer: 21001,
    chainIDKarura: 22000,
    chainIDBifrostKSM: 22001,
    chainIDKhala: 22004,
    chainIDShiden: 22007,
    //chainIDMars: 22008,
    chainIDSora: 22011,
    chainIDCrustShadow: 22012,
    chainIDIntegritee: 22015,
    //chainIDSakura: 22016,
    //chainIDSubgameGamma: 22018,
    //chainIDKpron: 22019,
    //chainIDAltairDev: 22021,
    chainIDMoonriver: 22023,
    chainIDGenshiro: 22024,
    chainIDRobonomics: 22048,
    //chainIDRobonomicsDev: 22077,
    //chainIDTrustbase: 22078,
    //chainIDLoom: 22080,
    chainIDCalamari: 22084,
    chainIDHeiko: 22085,
    chainIDKilt: 22086,
    chainIDPicasso: 22087,
    chainIDAltair: 22088,
    chainIDBasilisk: 22090,
    chainIDKintsugi: 22092,
    //chainIDUnorthodox: 22094,
    chainIDQuartz: 22095,
    chainIDBitcountry: 22096,
    chainIDSubsocial: 22100,

    chainIDZeitgeist: 22101,
    chainIDPichiu: 22102,
    chainIDDarwiniaCrab: 22105,
    chainIDLitmus: 22106,
    chainIDKico: 22107,
    chainIDMangataX: 22110,
    chainIDKabocha: 22113,
    chainIDTuring: 22114,
    chainIDDoraFactory: 22115,
    chainIDTanganika: 22116,
    chainIDListen: 22118,
    chainIDBajun: 22119,
    chainIDImbue: 22121,
    //chainIDGM: 22123,
    chainIDAmplitude: 22124,
    chainIDTinkernet: 22125,

    // Polkadot parachains
    chainIDStatemint: 1000,
    chainIDAcala: 2000,
    chainIDClover: 2002,
    //chainIDdarwiniaBackup: 2003,
    chainIDMoonbeam: 2004,
    chainIDAstar: 2006,
    chainIDKapex: 2007,
    //chainIDCrust: 2008,
    chainIDEquilibrium: 2011,
    chainIDParallel: 2012,
    chainIDLitentry: 2013,
    //chainIDManta: 2015,
    //chainIDSubgame: 2017,
    //chainIDSubdao: 2018,
    chainIDComposable: 2019,
    chainIDEfinity: 2021,
    chainIDNodle: 2026,
    chainIDCoinversation: 2027,
    //chainIDAres: 2028,
    chainIDBifrostDOT: 2030,
    chainIDCentrifuge: 2031,
    chainIDInterlay: 2032,
    chainIDHydraDX: 2034,
    chainIDPhala: 2035,
    chainIDUnique: 2037,
    //chainIDGeminis: 2038,
    chainIDIntegriteeShell: 2039,
    chainIDPolkadex: 2040,
    chainIDOrigintrail: 2043,
    //chainIDDarwinia: 2046,
    //chainIDKylin: 2052,
    //chainIDOmnibtc: 2055,

    // other
    chainIDUniqueOther: 255,
    chainIDPontem: 105,
    chainIDLaminar: 11,
    chainIDMoonbaseAlpha: 61000,
    chainIDMoonbaseBeta: 60888,
    chainIDMoonbaseRelay: 60000,

    chainIDShibuya: 81000, //TODO: (Q:where is shibuya relay?)
    chainIDShibuyaRelay: 80000,

    // polkadot/kusama
    chainIDPolkadot: 0,
    chainIDKusama: 2,

    makeAssetChain: function(asset, k = 'relaychain-paraID') {
        return (asset + assetChainSeparator + k);
    },
};
