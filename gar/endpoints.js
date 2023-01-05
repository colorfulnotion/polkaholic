/*
Use public registry from
https://github.com/polkadot-js/apps/blob/master/packages/apps-config/src/endpoints/productionRelayKusama.ts
https://github.com/polkadot-js/apps/blob/master/packages/apps-config/src/endpoints/productionRelayPolkadot.ts

Specifically, get these endpoints:
prodParasPolkadot, prodParasPolkadotCommon, (prodRelayPolkadot)
prodParasKusama, prodParasKusamaCommon, (prodRelayKusama)

Polkaholic currently maintain a list of public endpoints that we are crawling, which can be found at http://api.polkaholic.io/gar
*/

//temp: currently used as a starting point for the gar's public endpoints
const polkaholicKnownPublicEndpoints = {"polkadot-0":{"id":"polkadot","chainID":0,"paraID":0,"relaychain":"polkadot"},"kusama-0":{"id":"kusama","chainID":2,"paraID":2,"relaychain":"kusama"},"polkadot-1000":{"id":"statemint","chainID":1000,"paraID":1000,"relaychain":"polkadot"},"polkadot-2000":{"id":"acala","chainID":2000,"paraID":2000,"relaychain":"polkadot"},"polkadot-2002":{"id":"clover","chainID":2002,"paraID":2002,"relaychain":"polkadot"},"polkadot-2004":{"id":"moonbeam","chainID":2004,"paraID":2004,"relaychain":"polkadot"},"polkadot-2006":{"id":"astar","chainID":2006,"paraID":2006,"relaychain":"polkadot"},"polkadot-2011":{"id":"equilibrium","chainID":2011,"paraID":2011,"relaychain":"polkadot"},"polkadot-2012":{"id":"parallel","chainID":2012,"paraID":2012,"relaychain":"polkadot"},"polkadot-2013":{"id":"litentry","chainID":2013,"paraID":2013,"relaychain":"polkadot"},"polkadot-2019":{"id":"composable","chainID":2019,"paraID":2019,"relaychain":"polkadot"},"polkadot-2021":{"id":"efinity","chainID":2021,"paraID":2021,"relaychain":"polkadot"},"polkadot-2026":{"id":"nodle","chainID":2026,"paraID":2026,"relaychain":"polkadot"},"polkadot-2030":{"id":"bifrost-dot","chainID":2030,"paraID":2030,"relaychain":"polkadot"},"polkadot-2031":{"id":"centrifuge","chainID":2031,"paraID":2031,"relaychain":"polkadot"},"polkadot-2032":{"id":"interlay","chainID":2032,"paraID":2032,"relaychain":"polkadot"},"polkadot-2034":{"id":"hydradx","chainID":2034,"paraID":2034,"relaychain":"polkadot"},"polkadot-2035":{"id":"phala","chainID":2035,"paraID":2035,"relaychain":"polkadot"},"polkadot-2037":{"id":"unique","chainID":2037,"paraID":2037,"relaychain":"polkadot"},"polkadot-2039":{"id":"integritee-shell","chainID":2039,"paraID":2039,"relaychain":"polkadot"},"polkadot-2043":{"id":"origintrail","chainID":2043,"paraID":2043,"relaychain":"polkadot"},"polkadot-2046":{"id":"darwinia","chainID":2046,"paraID":2046,"relaychain":"polkadot"},"polkadot-2052":{"id":"kylin","chainID":2052,"paraID":2052,"relaychain":"polkadot"},"kusama-1000":{"id":"statemine","chainID":21000,"paraID":21000,"relaychain":"kusama"},"kusama-2000":{"id":"karura","chainID":22000,"paraID":22000,"relaychain":"kusama"},"kusama-2001":{"id":"bifrost-ksm","chainID":22001,"paraID":22001,"relaychain":"kusama"},"kusama-2004":{"id":"khala","chainID":22004,"paraID":22004,"relaychain":"kusama"},"kusama-2007":{"id":"shiden","chainID":22007,"paraID":22007,"relaychain":"kusama"},"kusama-2011":{"id":"sora","chainID":22011,"paraID":22011,"relaychain":"kusama"},"kusama-2012":{"id":"shadow","chainID":22012,"paraID":22012,"relaychain":"kusama"},"kusama-2015":{"id":"integritee","chainID":22015,"paraID":22015,"relaychain":"kusama"},"kusama-2023":{"id":"moonriver","chainID":22023,"paraID":22023,"relaychain":"kusama"},"kusama-2024":{"id":"genshiro","chainID":22024,"paraID":22024,"relaychain":"kusama"},"kusama-2048":{"id":"robonomics","chainID":22048,"paraID":22048,"relaychain":"kusama"},"kusama-2084":{"id":"calamari","chainID":22084,"paraID":22084,"relaychain":"kusama"},"kusama-2085":{"id":"parallel-heiko","chainID":22085,"paraID":22085,"relaychain":"kusama"},"kusama-2086":{"id":"spiritnet","chainID":22086,"paraID":22086,"relaychain":"kusama"},"kusama-2087":{"id":"picasso","chainID":22087,"paraID":22087,"relaychain":"kusama"},"kusama-2088":{"id":"altair","chainID":22088,"paraID":22088,"relaychain":"kusama"},"kusama-2090":{"id":"basilisk","chainID":22090,"paraID":22090,"relaychain":"kusama"},"kusama-2092":{"id":"kintsugi","chainID":22092,"paraID":22092,"relaychain":"kusama"},"kusama-2095":{"id":"quartz","chainID":22095,"paraID":22095,"relaychain":"kusama"},"kusama-2096":{"id":"bitcountrypioneer","chainID":22096,"paraID":22096,"relaychain":"kusama"},"kusama-2100":{"id":"subsocialx","chainID":22100,"paraID":22100,"relaychain":"kusama"},"kusama-2101":{"id":"zeitgeist","chainID":22101,"paraID":22101,"relaychain":"kusama"},"kusama-2102":{"id":"pichiu","chainID":22102,"paraID":22102,"relaychain":"kusama"},"kusama-2105":{"id":"crab","chainID":22105,"paraID":22105,"relaychain":"kusama"},"kusama-2106":{"id":"litmus","chainID":22106,"paraID":22106,"relaychain":"kusama"},"kusama-2110":{"id":"mangatax","chainID":22110,"paraID":22110,"relaychain":"kusama"},"kusama-2113":{"id":"kabocha","chainID":22113,"paraID":22113,"relaychain":"kusama"},"kusama-2114":{"id":"turing","chainID":22114,"paraID":22114,"relaychain":"kusama"},"kusama-2115":{"id":"dorafactory","chainID":22115,"paraID":22115,"relaychain":"kusama"},"kusama-2118":{"id":"listen","chainID":22118,"paraID":22118,"relaychain":"kusama"},"kusama-2119":{"id":"bajun","chainID":22119,"paraID":22119,"relaychain":"kusama"},"kusama-2121":{"id":"imbue","chainID":22121,"paraID":22121,"relaychain":"kusama"},"kusama-2222":{"id":"daoipci","chainID":22222,"paraID":22222,"relaychain":"kusama"}}

function t(rpc, chainName, ns) {
    return rpc;
}

const KUSAMA_GENESIS  = '0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe'
const POLKADOT_GENESIS  = '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3'

const prodParasPolkadot = [
  {
    info: 'acala',
    homepage: 'https://acala.network/',
    paraId: 2000,
    text: 'Acala',
    providers: {
      'Acala Foundation 0': 'wss://acala-rpc-0.aca-api.network',
      'Acala Foundation 1': 'wss://acala-rpc-1.aca-api.network',
      // 'Acala Foundation 2': 'wss://acala-rpc-2.aca-api.network/ws', // https://github.com/polkadot-js/apps/issues/6965
      'Acala Foundation 3': 'wss://acala-rpc-3.aca-api.network/ws',
      'Polkawallet 0': 'wss://acala.polkawallet.io',
      OnFinality: 'wss://acala-polkadot.api.onfinality.io/public-ws',
      Dwellir: 'wss://acala-rpc.dwellir.com'
      // 'Automata 1RPC': 'wss://1rpc.io/aca' // https://github.com/polkadot-js/apps/issues/8648
    }
  },
  {
    info: 'ajuna',
    homepage: 'https://ajuna.io',
    paraId: 2051,
    text: 'Ajuna Network',
    providers: {
      AjunaNetwork: 'wss://rpc-parachain.ajuna.network'
    }
  },
  {
    info: 'odyssey',
    homepage: 'https://www.aresprotocol.io/',
    paraId: 2028,
    text: 'Ares Odyssey',
    providers: {
      AresProtocol: 'wss://wss.odyssey.aresprotocol.io'
    }
  },
  {
    info: 'astar',
    homepage: 'https://astar.network',
    paraId: 2006,
    text: 'Astar',
    providers: {
      Astar: 'wss://rpc.astar.network',
      Blast: 'wss://astar.public.blastapi.io',
      Dwellir: 'wss://astar-rpc.dwellir.com',
      OnFinality: 'wss://astar.api.onfinality.io/public-ws',
      RadiumBlock: 'wss://astar.public.curie.radiumblock.co/ws',
      Pinknode: 'wss://public-rpc.pinknode.io/astar',
      'Automata 1RPC': 'wss://1rpc.io/astr',
      // NOTE: Keep this as the last entry, nothing after it
      'light client': 'light://substrate-connect/polkadot/astar' // NOTE: Keep last
    }
  },
  {
    info: 'aventus',
    homepage: 'https://www.aventus.io/',
    paraId: 2056,
    text: 'Aventus',
    providers: { }
  },
  {
    info: 'bifrost',
    homepage: 'https://crowdloan.bifrost.app',
    paraId: 2030,
    text: 'Bifrost',
    providers: {
      Liebi: 'wss://hk.p.bifrost-rpc.liebi.com/ws',
      OnFinality: 'wss://bifrost-polkadot.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'bitgreen',
    homepage: 'https://www.bitgreen.org',
    text: 'Bitgreen',
    paraId: 2048,
    providers: {
      Bitgreen: 'wss://parachain.bitgreen.org'
    }
  },
  {
    info: 'centrifuge',
    homepage: 'https://centrifuge.io',
    paraId: 2031,
    text: 'Centrifuge',
    providers: {
      Centrifuge: 'wss://fullnode.parachain.centrifuge.io',
      OnFinality: 'wss://centrifuge-parachain.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'clover',
    homepage: 'https://clover.finance',
    paraId: 2002,
    text: 'Clover',
    providers: {
      Clover: 'wss://rpc-para.clover.finance'
      // OnFinality: 'wss://clover.api.onfinality.io/public-ws' // https://github.com/polkadot-js/apps/issues/8355, then enabled in https://github.com/polkadot-js/apps/pull/8413, then broken in https://github.com/polkadot-js/apps/issues/8421
    }
  },
  {
    info: 'coinversation',
    // this is also a duplicate as a Live and Testing network -
    // it is either/or, not and
    isUnreachable: true,
    homepage: 'http://www.coinversation.io/',
    paraId: 2027,
    text: 'Coinversation',
    providers: {
      // Coinversation: 'wss://rpc.coinversation.io/' // https://github.com/polkadot-js/apps/issues/6635
    }
  },
  {
    info: 'composableFinance',
    homepage: 'https://composable.finance/',
    paraId: 2019,
    text: 'Composable Finance',
    providers: {
      Composable: 'wss://rpc.composable.finance'
    }
  },
  {
    info: 'crustParachain',
    homepage: 'https://crust.network',
    paraId: 2008,
    isUnreachable: true,
    text: 'Crust',
    providers: {
      Crust: 'wss://rpc.crust.network'
    }
  },
  {
    info: 'darwinia',
    homepage: 'https://darwinia.network/',
    paraId: 2046,
    text: 'Darwinia',
    providers: {
      'Darwinia Network': 'wss://parachain-rpc.darwinia.network'
    }
  },
  {
    info: 'darwinia',
    homepage: 'https://darwinia.network/',
    paraId: 2003,
    text: 'Darwinia Backup',
    providers: {
      // 'Darwinia Network': 'wss://parachain-rpc.darwinia.network' // https://github.com/polkadot-js/apps/issues/6530
    }
  },
  {
    info: 'efinity',
    homepage: 'https://efinity.io',
    paraId: 2021,
    text: 'Efinity',
    providers: {
      Efinity: 'wss://rpc.efinity.io',
      Dwellir: 'wss://efinity-rpc.dwellir.com',
      OnFinality: 'wss://efinity.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'equilibrium',
    homepage: 'https://equilibrium.io/',
    paraId: 2011,
    text: 'Equilibrium',
    providers: {
      Equilibrium: 'wss://node.pol.equilibrium.io/',
      Dwellir: 'wss://equilibrium-rpc.dwellir.com'
    }
  },
  {
    info: 'frequency',
    homepage: 'https://frequency.xyz',
    paraId: 2091,
    text: 'Frequency',
    providers: {
      'Frequency 0': 'wss://0.rpc.frequency.xyz',
      'Frequency 1': 'wss://1.rpc.frequency.xyz'
    }
  },
  {
    info: 'geminis',
    isUnreachable: true,
    homepage: 'https://geminis.network/',
    paraId: 2038,
    text: 'Geminis',
    providers: {
      Geminis: 'wss://rpc.geminis.network'
    }
  },
  {
    info: 'hashed',
    homepage: 'https://hashed.network/',
    paraId: 2093,
    text: 'Hashed Network',
    providers: {
      'Hashed Systems': 'wss://c1.hashed.network'
    }
  },
  {
    info: 'hydra',
    homepage: 'https://hydradx.io/',
    paraId: 2034,
    text: 'HydraDX',
    providers: {
      'Galactic Council': 'wss://rpc.hydradx.cloud',
      Dwellir: 'wss://hydradx-rpc.dwellir.com'
      // OnFinality: 'wss://hydradx.api.onfinality.io/public-ws' // https://github.com/polkadot-js/apps/issues/8623
    }
  },
  {
    info: 'integritee',
    homepage: 'https://integritee.network',
    paraId: 2039,
    text: 'Integritee Shell',
    providers: {
      Integritee: 'wss://polkadot.api.integritee.network'
    }
  },
  {
    info: 'interlay',
    homepage: 'https://interlay.io/',
    paraId: 2032,
    text: 'Interlay',
    providers: {
      'Kintsugi Labs': 'wss://api.interlay.io/parachain',
      OnFinality: 'wss://interlay.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'kapex',
    homepage: 'https://totemaccounting.com/',
    paraId: 2007,
    text: 'Kapex',
    providers: {
      Totem: 'wss://k-ui.kapex.network'
    }
  },
  {
    info: 'kilt',
    homepage: 'https://www.kilt.io/',
    paraId: 2086,
    text: 'KILT Spiritnet',
    providers: {
      'KILT Protocol': 'wss://spiritnet.kilt.io/',
      OnFinality: 'wss://spiritnet.api.onfinality.io/public-ws',
      Dwellir: 'wss://kilt-rpc.dwellir.com'
    }
  },
  {
    info: 'kylin',
    homepage: 'https://kylin.network/',
    paraId: 2052,
    text: 'Kylin',
    providers: {
      'Kylin Network': 'wss://polkadot.kylin-node.co.uk'
    }
  },
  {
    info: 'litentry',
    homepage: 'https://crowdloan.litentry.com',
    paraId: 2013,
    text: 'Litentry',
    providers: {
      Litentry: 'wss://rpc.litentry-parachain.litentry.io',
      Dwellir: 'wss://litentry-rpc.dwellir.com'
    }
  },
  {
    info: 'manta',
    isUnreachable: true, // https://github.com/polkadot-js/apps/issues/7018
    homepage: 'https://manta.network',
    paraId: 2015,
    text: 'Manta',
    providers: {
      // 'Manta Kuhlii': 'wss://kuhlii.manta.systems', // https://github.com/polkadot-js/apps/issues/6930
      // 'Manta Munkiana': 'wss://munkiana.manta.systems', // https://github.com/polkadot-js/apps/issues/6871
      // 'Manta Pectinata': 'wss://pectinata.manta.systems' // https://github.com/polkadot-js/apps/issues/7018
    }
  },
  {
    info: 'moonbeam',
    homepage: 'https://moonbeam.network/networks/moonbeam/',
    paraId: 2004,
    text: 'Moonbeam',
    providers: {
      'Moonbeam Foundation': 'wss://wss.api.moonbeam.network',
      'Automata 1RPC': 'wss://1rpc.io/glmr',
      Blast: 'wss://moonbeam.public.blastapi.io',
      OnFinality: 'wss://moonbeam.api.onfinality.io/public-ws',
      Pinknode: 'wss://public-rpc.pinknode.io/moonbeam',
      UnitedBloc: 'wss://moonbeam.unitedbloc.com:3001'

    }
  },
  {
    info: 'nodle',
    homepage: 'https://nodle.com',
    paraId: 2026,
    text: 'Nodle',
    providers: {
      OnFinality: 'wss://nodle-parachain.api.onfinality.io/public-ws',
      Dwellir: 'wss://eden-rpc.dwellir.com',
      Pinknode: 'wss://public-rpc.pinknode.io/nodle'
    }
  },
  {
    info: 'oak',
    homepage: 'https://oak.tech',
    isUnreachable: true,
    paraId: 2090,
    text: 'OAK Network',
    providers: {
      OAK: 'wss://rpc.oak.tech'
    }
  },
  {
    info: 'omnibtc',
    isUnreachable: true,
    homepage: 'https://www.omnibtc.finance',
    text: 'OmniBTC',
    paraId: 2053,
    providers: {
      OmniBTC: 'wss://psc-parachain.coming.chat'
    }
  },
  {
    info: 'origintrail-parachain',
    homepage: 'https://parachain.origintrail.io',
    text: 'OriginTrail',
    paraId: 2043,
    providers: {
      TraceLabs: 'wss://parachain-rpc.origin-trail.network'
    }
  },
  {
    info: 'parallel',
    homepage: 'https://parallel.fi',
    paraId: 2012,
    text: 'Parallel',
    providers: {
      // OnFinality: 'wss://parallel.api.onfinality.io/public-ws', // https://github.com/polkadot-js/apps/issues/8355, then enabled in https://github.com/polkadot-js/apps/pull/8413, then broken in https://github.com/polkadot-js/apps/issues/8421
      Parallel: 'wss://rpc.parallel.fi'
    }
  },
  {
    info: 'pendulum',
    homepage: 'https://pendulumchain.org/',
    paraId: 2094,
    text: 'Pendulum',
    isUnreachable: true,
    providers: {
      PendulumChain: 'wss://rpc.pendulumchain.tech'
    }
  },
  {
    info: 'phala',
    homepage: 'https://phala.network',
    paraId: 2035,
    text: 'Phala Network',
    providers: {
      Phala: 'wss://api.phala.network/ws',
      OnFinality: 'wss://phala.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'polkadex',
    isUnreachable: true, // https://github.com/polkadot-js/apps/issues/7620
    homepage: 'https://polkadex.trade/',
    paraId: 2040,
    text: 'Polkadex',
    providers: {
      // 'Polkadex Team': 'wss://mainnet.polkadex.trade/', // https://github.com/polkadot-js/apps/issues/7620
      // OnFinality: 'wss://polkadex.api.onfinality.io/public-ws' // https://github.com/polkadot-js/apps/issues/7620
    }
  },
  {
    info: 'subdao',
    homepage: 'https://subdao.network/',
    paraId: 2018,
    isUnreachable: true,
    text: 'SubDAO',
    providers: {
      SubDAO: 'wss://parachain-rpc.subdao.org'
    }
  },
  {
    info: 'subgame',
    homepage: 'http://subgame.org/',
    paraId: 2017,
    text: 'SubGame Gamma',
    providers: {
      // SubGame: 'wss://gamma.subgame.org/' // https://github.com/polkadot-js/apps/pull/6761
    }
  },
  {
    info: 'unique',
    homepage: 'https://unique.network/',
    paraId: 2037,
    text: 'Unique Network',
    providers: {
      'Unique America': 'wss://us-ws.unique.network/',
      'Unique Asia': 'wss://asia-ws.unique.network/',
      'Unique Europe': 'wss://eu-ws.unique.network/'
    }
  }
];

const prodParasPolkadotCommon = [
  {
    info: 'statemint',
    paraId: 1000,
    text: 'Statemint',
    teleport: [-1],
    providers: {
      Parity: 'wss://statemint-rpc.polkadot.io',
      OnFinality: 'wss://statemint.api.onfinality.io/public-ws',
      Dwellir: 'wss://statemint-rpc.dwellir.com',
      'Dwellir Tunisia': 'wss://statemint-rpc-tn.dwellir.com',
      Pinknode: 'wss://public-rpc.pinknode.io/statemint',
      RadiumBlock: 'wss://statemint.public.curie.radiumblock.co/ws'
    }
  },
  {
    info: 'polkadotCollectives',
    paraId: 1001,
    text: 'Collectives',
    teleport: [-1],
    providers: {
      Parity: 'wss://polkadot-collectives-rpc.polkadot.io'
    }
  }
];

const prodRelayPolkadot = {
  dnslink: 'polkadot',
  genesisHash: POLKADOT_GENESIS,
  info: 'polkadot',
  text: 'Polkadot',
  providers: {
    Parity: 'wss://rpc.polkadot.io',
    OnFinality: 'wss://polkadot.api.onfinality.io/public-ws',
    Dwellir: 'wss://polkadot-rpc.dwellir.com',
    'Dwellir Tunisia': 'wss://polkadot-rpc-tn.dwellir.com',
    Pinknode: 'wss://public-rpc.pinknode.io/polkadot',
    RadiumBlock: 'wss://polkadot.public.curie.radiumblock.co/ws',
    // 'Geometry Labs': 'wss://polkadot.geometry.io/websockets', // https://github.com/polkadot-js/apps/pull/6746
    'Automata 1RPC': 'wss://1rpc.io/dot',
    'Dotters Net': 'wss://rpc.dotters.network/polkadot',
    // NOTE: Keep this as the last entry, nothing after it
    'light client': 'light://substrate-connect/polkadot' // NOTE: Keep last
  }
}

const prodParasKusama = [
  {
    info: 'altair',
    homepage: 'https://centrifuge.io/altair',
    paraId: 2088,
    text: 'Altair',
    providers: {
      Centrifuge: 'wss://fullnode.altair.centrifuge.io',
      OnFinality: 'wss://altair.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'amplitude',
    homepage: 'https://pendulumchain.org/amplitude',
    paraId: 2124,
    text: 'Amplitude',
    providers: {
      PendulumChain: 'wss://rpc-amplitude.pendulumchain.tech'
    }
  },
  {
    info: 'bajun',
    homepage: 'https://ajuna.io',
    paraId: 2119,
    text: 'Bajun Network',
    providers: {
      AjunaNetwork: 'wss://rpc-parachain.bajun.network',
      Dwellir: 'wss://bajun-rpc.dwellir.com',
      OnFinality: 'wss://bajun.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'basilisk',
    homepage: 'https://app.basilisk.cloud',
    paraId: 2090,
    text: 'Basilisk',
    providers: {
      Basilisk: 'wss://rpc.basilisk.cloud',
      Dwellir: 'wss://basilisk-rpc.dwellir.com'
    }
  },
  {
    info: 'bifrost',
    homepage: 'https://ksm.vtoken.io/?ref=polkadotjs',
    paraId: 2001,
    text: 'Bifrost',
    providers: {
      Liebi: 'wss://bifrost-rpc.liebi.com/ws',
      OnFinality: 'wss://bifrost-parachain.api.onfinality.io/public-ws',
      Dwellir: 'wss://bifrost-rpc.dwellir.com'
    }
  },
  {
    info: 'bitcountryPioneer',
    homepage: 'https://bit.country/?ref=polkadotjs',
    paraId: 2096,
    text: 'Bit.Country Pioneer',
    providers: {
      OnFinality: 'wss://pioneer.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'calamari',
    homepage: 'https://www.calamari.network/',
    paraId: 2084,
    text: 'Calamari',
    providers: {
      'Manta Network': 'wss://ws.calamari.systems/'
    }
  },
  {
    info: 'shadow',
    homepage: 'https://crust.network/',
    paraId: 2012,
    text: 'Crust Shadow',
    providers: {
      Crust: 'wss://rpc-shadow.crust.network/'
    }
  },
  {
    info: 'shadow',
    homepage: 'https://crust.network/',
    paraId: 2225,
    text: 'Crust Shadow 2',
    isUnreachable: true,
    providers: {
      // also duplicated right above (hence marked unreachable)
      // Crust: 'wss://rpc-shadow.crust.network/' // https://github.com/polkadot-js/apps/issues/8355
    }
  },
  {
    info: 'ipci',
    homepage: 'https://ipci.io',
    paraId: 2222,
    text: 'DAO IPCI',
    providers: {
      Airalab: 'wss://kusama.rpc.ipci.io'
    }
  },
  {
    info: 'crab',
    homepage: 'https://crab.network',
    paraId: 2105,
    text: 'Darwinia Crab',
    providers: {
      'Darwinia Network': 'wss://crab-parachain-rpc.darwinia.network/'
    }
  },
  {
    info: 'dorafactory',
    homepage: 'https://dorafactory.org/kusama/',
    paraId: 2115,
    text: 'Dora Factory',
    providers: {
      DORA: 'wss://kusama.dorafactory.org'
    }
  },
  {
    info: 'genshiro',
    homepage: 'https://genshiro.equilibrium.io',
    isUnreachable: true,
    paraId: 2024,
    text: 'Genshiro',
    providers: {
      Equilibrium: 'wss://node.genshiro.io'
    }
  },
  {
    info: 'genshiro',
    homepage: 'https://genshiro.equilibrium.io',
    isUnreachable: true,
    paraId: 2226,
    text: 'Genshiro crowdloan 2',
    providers: {
      Equilibrium: 'wss://node.genshiro.io'
    }
  },
  {
    info: 'gm',
    homepage: 'https://gmordie.com',
    paraId: 2123,
    text: 'GM',
    providers: {
      // GMorDieDAO: 'wss://kusama.gmordie.com', // https://github.com/polkadot-js/apps/issues/8457
      'bLd Nodes': 'wss://ws.gm.bldnodes.org',
      TerraBioDAO: 'wss://ws-node-gm.terrabiodao.org',
      Leemo: 'wss://leemo.gmordie.com',
      'GM Intern': 'wss://intern.gmordie.com',
      // NOTE: Keep this as the last entry, nothing after it
      'light client': 'light://substrate-connect/kusama/gm' // NOTE: Keep last
    }
  },
  {
    info: 'imbue',
    homepage: 'https://imbue.network',
    paraId: 2121,
    text: 'Imbue Network',
    providers: {
      'Imbue Network': 'wss://imbue-kusama.imbue.network'
    }
  },
  {
    info: 'integritee',
    homepage: 'https://integritee.network',
    paraId: 2015,
    text: 'Integritee Network',
    providers: {
      Integritee: 'wss://kusama.api.integritee.network',
      OnFinality: 'wss://integritee-kusama.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'tinker',
    homepage: 'https://invarch.network/tinkernet',
    paraId: 2125,
    text: 'InvArch Tinkernet',
    providers: {
      // 'InvArch Team': 'wss://tinker.invarch.network', // https://github.com/polkadot-js/apps/issues/8623
      OnFinality: 'wss://invarch-tinkernet.api.onfinality.io/public-ws',
      // NOTE: Keep this as the last entry, nothing after it
      'light client': 'light://substrate-connect/kusama/tinkernet' // NOTE: Keep last
    }
  },
  {
    info: 'kabocha',
    homepage: 'https://kabocha.network',
    paraId: 2113,
    text: 'Kabocha',
    providers: {
      JelliedOwl: 'wss://kabocha.jelliedowl.net'
    }
  },
  {
    info: 'karura',
    homepage: 'https://acala.network/karura/join-karura',
    paraId: 2000,
    text: 'Karura',
    providers: {
      'Acala Foundation 0': 'wss://karura-rpc-0.aca-api.network',
      'Acala Foundation 1': 'wss://karura-rpc-1.aca-api.network',
      'Acala Foundation 2': 'wss://karura-rpc-2.aca-api.network/ws',
      'Acala Foundation 3': 'wss://karura-rpc-3.aca-api.network/ws',
      'Polkawallet 0': 'wss://karura.polkawallet.io',
      OnFinality: 'wss://karura.api.onfinality.io/public-ws',
      Dwellir: 'wss://karura-rpc.dwellir.com'
    }
  },
  {
    info: 'khala',
    homepage: 'https://phala.network/',
    paraId: 2004,
    text: 'Khala Network',
    providers: {
      Phala: 'wss://khala-api.phala.network/ws',
      OnFinality: 'wss://khala.api.onfinality.io/public-ws',
      Dwellir: 'wss://khala-rpc.dwellir.com',
      Pinknode: 'wss://public-rpc.pinknode.io/khala'
    }
  },
  {
    info: 'kico',
    homepage: 'https://dico.io/',
    paraId: 2107,
    text: 'KICO',
    providers: {
      'DICO Foundation': 'wss://rpc.kico.dico.io'
      // 'DICO Foundation 2': 'wss://rpc.api.kico.dico.io' // https://github.com/polkadot-js/apps/issues/8203
    }
  },
  {
    info: 'kico 2',
    homepage: 'https://dico.io/',
    paraId: 2235,
    text: 'KICO 2',
    providers: {
      // 'DICO Foundation': 'wss://rpc.kico2.dico.io' // https://github.com/polkadot-js/apps/issues/8415
    }
  },
  {
    info: 'kintsugi',
    homepage: 'https://kintsugi.interlay.io/',
    paraId: 2092,
    text: 'Kintsugi BTC',
    providers: {
      'Kintsugi Labs': 'wss://api-kusama.interlay.io/parachain',
      OnFinality: 'wss://kintsugi.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'kpron',
    homepage: 'http://apron.network/',
    isUnreachable: true,
    paraId: 2019,
    text: 'Kpron',
    providers: {
      Kpron: 'wss://kusama-kpron-rpc.apron.network/'
    }
  },
  {
    info: 'listen',
    homepage: 'https://listen.io/',
    paraId: 2118,
    text: 'Listen Network',
    providers: {
      'Listen Foundation 1': 'wss://rpc.mainnet.listen.io',
      'Listen Foundation 2': 'wss://wss.mainnet.listen.io'
    }
  },
  {
    info: 'litmus',
    homepage: 'https://kusama-crowdloan.litentry.com',
    paraId: 2106,
    isUnreachable: false,
    text: 'Litmus',
    providers: {
      Litentry: 'wss://rpc.litmus-parachain.litentry.io'
    }
  },
  {
    info: 'loomNetwork',
    isUnreachable: true, // https://github.com/polkadot-js/apps/issues/5888
    homepage: 'https://loomx.io/',
    paraId: 2080,
    text: 'Loom Network',
    providers: {
      LoomNetwork: 'wss://kusama.dappchains.com'
    }
  },
  {
    info: 'luhn',
    homepage: 'https://luhn.network/',
    paraId: 2232,
    text: 'Luhn Network',
    providers: {
      'Hashed Systems': 'wss://c1.luhn.network'
    }
  },
  {
    info: 'mangata',
    homepage: 'https://mangata.finance',
    paraId: 2110,
    text: 'Mangata',
    providers: {
      Mangata: 'wss://prod-kusama-collator-01.mangatafinance.cloud',
      OnFinality: 'wss://mangata-x.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'mars',
    homepage: 'https://www.aresprotocol.io/mars',
    paraId: 2008,
    text: 'Mars',
    providers: {
      AresProtocol: 'wss://wss.mars.aresprotocol.io'
    }
  },
  {
    info: 'moonriver',
    homepage: 'https://moonbeam.network/networks/moonriver/',
    paraId: 2023,
    text: 'Moonriver',
    providers: {
      'Moonbeam Foundation': 'wss://wss.api.moonriver.moonbeam.network',
      Blast: 'wss://moonriver.public.blastapi.io',
      OnFinality: 'wss://moonriver.api.onfinality.io/public-ws',
      Pinknode: 'wss://public-rpc.pinknode.io/moonriver',
      UnitedBloc: 'wss://moonriver.unitedbloc.com:2001'
      // Pinknode: 'wss://rpc.pinknode.io/moonriver/explorer' // https://github.com/polkadot-js/apps/issues/7058
    }
  },
  {
    info: 'heiko',
    homepage: 'https://parallel.fi',
    paraId: 2085,
    text: 'Parallel Heiko',
    providers: {
      // OnFinality: 'wss://parallel-heiko.api.onfinality.io/public-ws', // https://github.com/polkadot-js/apps/issues/8355, then enabled in https://github.com/polkadot-js/apps/pull/8413, then broken in https://github.com/polkadot-js/apps/issues/8421
      Parallel: 'wss://heiko-rpc.parallel.fi'
    }
  },
  {
    info: 'heiko',
    homepage: 'https://parallel.fi',
    paraId: 2126,
    isUnreachable: true,
    text: 'Parallel Heiko 2',
    providers: {}
  },
  {
    info: 'picasso',
    homepage: 'https://picasso.composable.finance/',
    paraId: 2087,
    text: 'Picasso',
    providers: {
      Composable: 'wss://rpc.composablenodes.tech'
    }
  },
  {
    info: 'pichiu',
    homepage: 'https://kylin.network/',
    paraId: 2102,
    text: 'Pichiu',
    providers: {
      'Kylin Network': 'wss://kusama.kylin-node.co.uk',
      OnFinality: 'wss://pichiu.api.onfinality.io/public-ws'
    }
  },
  {
    info: 'polkasmith',
    isUnreachable: true, // https://github.com/polkadot-js/apps/issues/6595
    homepage: 'https://polkasmith.polkafoundry.com/',
    paraId: 2009,
    text: 'PolkaSmith by PolkaFoundry',
    providers: {
      PolkaSmith: 'wss://wss-polkasmith.polkafoundry.com'
    }
  },
  {
    info: 'quartz',
    homepage: 'https://unique.network/',
    paraId: 2095,
    text: 'QUARTZ by UNIQUE',
    providers: {
      'Unique America': 'wss://us-ws-quartz.unique.network',
      'Unique Asia': 'wss://asia-ws-quartz.unique.network',
      'Unique Europe': 'wss://eu-ws-quartz.unique.network'
      // OnFinality: 'wss://quartz.api.onfinality.io/public-ws' // https://github.com/polkadot-js/apps/issues/8436 re-added added previously removed, still unreachable
    }
  },
  {
    info: 'riodefi',
    homepage: 'https://riodefi.com',
    paraId: 2227,
    text: 'RioDeFi',
    providers: {
      RioProtocol: 'wss://rio-kusama.riocorenetwork.com'
    }
  },
  {
    info: 'robonomics',
    homepage: 'http://robonomics.network/',
    paraId: 2048,
    text: 'Robonomics',
    providers: {
      Airalab: 'wss://kusama.rpc.robonomics.network/',
      OnFinality: 'wss://robonomics.api.onfinality.io/public-ws',
      Samsara: 'wss://robonomics.0xsamsara.com',
      Leemo: 'wss://robonomics.leemo.me'
    }
  },
  {
    info: 'robonomics',
    homepage: 'http://robonomics.network/',
    paraId: 2240,
    text: 'Robonomics 2',
    isUnreachable: true,
    providers: {
      Airalab: 'wss://kusama.rpc.robonomics.network/',
      OnFinality: 'wss://robonomics.api.onfinality.io/public-ws',
      Samsara: 'wss://robonomics.0xsamsara.com',
      Leemo: 'wss://robonomics.leemo.me'
    }
  },
  {
    info: 'sakura',
    homepage: 'https://clover.finance/',
    isUnreachable: true,
    paraId: 2016,
    text: 'Sakura',
    providers: {
      Clover: 'wss://api-sakura.clover.finance'
    }
  },
  {
    info: 'shiden',
    homepage: 'https://shiden.astar.network/',
    paraId: 2007,
    text: 'Shiden',
    providers: {
      StakeTechnologies: 'wss://rpc.shiden.astar.network',
      Blast: 'wss://shiden.public.blastapi.io',
      Dwellir: 'wss://shiden-rpc.dwellir.com',
      OnFinality: 'wss://shiden.api.onfinality.io/public-ws',
      Pinknode: 'wss://public-rpc.pinknode.io/shiden',
      // NOTE: Keep this as the last entry, nothing after it
      'light client': 'light://substrate-connect/kusama/shiden' // NOTE: Keep last
    }
  },
  {
    info: 'shiden',
    homepage: 'https://shiden.astar.network/',
    paraId: 2120,
    text: 'Shiden Crowdloan 2',
    isUnreachable: true,
    providers: {
      StakeTechnologies: 'wss://rpc.shiden.astar.network'
    }
  },
  {
    info: 'snow',
    homepage: 'https://icenetwork.io/snow',
    paraId: 2129,
    text: 'SNOW Network',
    isUnreachable: false,
    providers: {
      IceNetwork: 'wss://snow-rpc.icenetwork.io'
    }
  },
  {
    info: 'sora_ksm',
    homepage: 'https://sora.org/',
    paraId: 2011,
    text: 'SORA',
    providers: {
      Soramitsu: 'wss://ws.parachain-collator-1.c1.sora2.soramitsu.co.jp'
    }
  },
  {
    info: 'subgame',
    isUnreachable: true, // https://github.com/polkadot-js/apps/issues/7982
    homepage: 'http://subgame.org/',
    paraId: 2018,
    text: 'SubGame Gamma',
    providers: {
      SubGame: 'wss://gamma.subgame.org/'
    }
  },
  {
    info: 'subsocialX',
    homepage: 'https://subsocial.network/',
    paraId: 2100,
    text: 'SubsocialX',
    providers: {
      'Dappforce 1': 'wss://para.f3joule.space',
      'Dappforce 2': 'wss://para.subsocial.network'
    }
  },
  {
    info: 'zero',
    homepage: 'https://zero.io',
    paraId: 2236,
    text: 'subzero',
    providers: {
      ZeroNetwork: 'wss://rpc-1.kusama.node.zero.io'
    }
  },
  {
    info: 'tanganika',
    homepage: 'https://www.datahighway.com/',
    paraId: 2116,
    text: 'Tanganika',
    providers: {
      DataHighway: 'wss://tanganika.datahighway.com'
    }
  },
  {
    info: 'trustbase',
    isUnreachable: true, // no providers (yet)
    homepage: 'https://trustbase.network/',
    paraId: 2078,
    text: 'TrustBase',
    providers: {}
  },
  {
    info: 'turing',
    homepage: 'https://oak.tech',
    paraId: 2114,
    text: 'Turing Network',
    providers: {
      OAK: 'wss://rpc.turing.oak.tech',
      Dwellir: 'wss://turing-rpc.dwellir.com'
    }
  },
  {
    info: 'unorthodox',
    homepage: 'https://standard.tech/',
    paraId: 2094,
    text: 'Unorthodox',
    providers: {
      // 'Standard Protocol': 'wss://rpc.kusama.standard.tech' // https://github.com/polkadot-js/apps/issues/8525
    }
  },
  {
    info: 'zeitgeist',
    homepage: 'https://zeitgeist.pm',
    paraId: 2101,
    text: 'Zeitgeist',
    providers: {
      // ZeitgeistPM: 'wss://rpc-0.zeitgeist.pm', // https://github.com/polkadot-js/apps/issues/7982
      Dwellir: 'wss://zeitgeist-rpc.dwellir.com',
      OnFinality: 'wss://zeitgeist.api.onfinality.io/public-ws'
    }
  }
];

const prodParasKusamaCommon = [
  {
    info: 'statemine',
    paraId: 1000,
    text: 'Statemine',
    providers: {
      Parity: 'wss://statemine-rpc.polkadot.io',
      OnFinality: 'wss://statemine.api.onfinality.io/public-ws',
      Dwellir: 'wss://statemine-rpc.dwellir.com',
      'Dwellir Tunisia': 'wss://statemine-rpc-tn.dwellir.com',
      Pinknode: 'wss://public-rpc.pinknode.io/statemine',
      RadiumBlock: 'wss://statemine.public.curie.radiumblock.co/ws'
    },
    teleport: [-1]
  },
  {
    info: 'encointer',
    homepage: 'https://encointer.org/',
    paraId: 1001,
    text: 'Encointer Network',
    providers: {
      'Encointer Association': 'wss://kusama.api.encointer.org'
      // OnFinality: 'wss://encointer.api.onfinality.io/public-ws' // https://github.com/polkadot-js/apps/issues/8553
    },
    teleport: [-1]
  }
];

const prodRelayKusama = {
  dnslink: 'kusama',
  genesisHash: KUSAMA_GENESIS,
  info: 'kusama',
  text: 'Kusama',
  providers: {
    Parity: 'wss://kusama-rpc.polkadot.io',
    OnFinality: 'wss://kusama.api.onfinality.io/public-ws',
    Dwellir: 'wss://kusama-rpc.dwellir.com',
    'Dwellir Tunisia': 'wss://kusama-rpc-tn.dwellir.com',
    RadiumBlock: 'wss://kusama.public.curie.radiumblock.co/ws',
    Pinknode: 'wss://public-rpc.pinknode.io/kusama',
    // 'Geometry Labs': 'wss://kusama.geometry.io/websockets', // https://github.com/polkadot-js/apps/pull/6746
    'Automata 1RPC': 'wss://1rpc.io/ksm',
    'Dotters Net': 'wss://rpc.dotters.network/kusama',
    // NOTE: Keep this as the last entry, nothing after it
    'light client': 'light://substrate-connect/kusama' // NOTE: Keep last
  }
}

//returning all endpoint, including parachain, common,
function prepareEndpoints(relaychain = 'polkadot'){
  let parachainMap = {} // [relaychain-paraID] -> endpoints
  let unsupportedMap = {} // list of unknown/unsupported parachain.
  let endpointList = []
  let knownPublicEndpointsMap = polkaholicKnownPublicEndpoints
  //console.log(`knownPublicEndpointsMap`, knownPublicEndpointsMap)
  switch (relaychain) {
      case 'kusama':
        endpointList = prodParasKusama.concat(prodParasKusamaCommon);
        endpointList.push(prodRelayKusama)
        break;
      case 'polkadot':
        endpointList = prodParasPolkadot.concat(prodParasPolkadotCommon);
        endpointList.push(prodRelayPolkadot)
        break;
      default:
        console.log(`unknown relaychain ${relaychain} option`)
  }

  for (const ep of endpointList){
    let k = `${relaychain}-${ep.paraId}`
    let chainID = ep.paraId
    //polkadot-relayChain/kusama-relaychain will have paraId = 0
    if (ep.info == 'polkadot'){
        k = `${relaychain}-0`
        ep.paraId = 0
        chainID = 0
    }else if (ep.info == 'kusama'){
        k = `${relaychain}-0`
        ep.paraId = 0
        chainID = 2
    }else if (relaychain == 'kusama'){
        chainID = ep.paraId+20000
    }
    let endpoint = {
      name: ep.text,
      id: ep.info,
      paraID: ep.paraId,
      chainID: chainID,
      //website: ep.homepage,
      isUnreachable: ep.isUnreachable,
      //rpc: ep.text,
      WSEndpoints: [],
      relaychain: relaychain,
    }
    for (const p of Object.keys(ep.providers)){
      endpoint.WSEndpoints.push(ep.providers[p])
    }
    if (knownPublicEndpointsMap[k] != undefined){
        parachainMap[k] = endpoint
    }else{
        unsupportedMap[k] = endpoint
    }
  }
  return [parachainMap, unsupportedMap]
}

module.exports = {
    getEndpointsByRelaychain: function(relaychain = 'polkadot') {
        return prepareEndpoints(relaychain);
    },
};
