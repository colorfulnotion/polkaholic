// https://github.com/polkadot-js/apps/blob/master/packages/apps-config/src/endpoints/productionRelayKusama.ts

function t(rpc, chainName, ns) {
    return rpc;
}
var kusamaEndpoints = [
      // (1) all system parachains (none available yet)
      // ...
      // (2) all common good parachains
      {
        info: 'statemine',
        paraId: 1000,
        text: t('rpc.kusama.statemine', 'Statemine', { ns: 'apps-config' }),
        providers: {
          Parity: 'wss://statemine-rpc.polkadot.io',
          OnFinality: 'wss://statemine.api.onfinality.io/public-ws',
          Dwellir: 'wss://statemine-rpc.dwellir.com'
        },
        teleport: [-1]
      },
      {
        info: 'encointer',
        homepage: 'https://encointer.org/',
        paraId: 1001,
        text: t('rpc.kusama.encointer', 'Encointer Network', { ns: 'apps-config' }),
        providers: {
          'Encointer Association': 'wss://kusama.api.encointer.org',
          OnFinality: 'wss://encointer.api.onfinality.io/public-ws'
        },
        teleport: [-1]
      },
      /// (3) parachains with id, see Rococo (info here maps to the actual "named icon")
      //
      // NOTE: Added alphabetical based on chain name
      {
        info: 'altair',
        homepage: 'https://centrifuge.io/altair',
        paraId: 2088,
        text: t('rpc.kusama.altair', 'Altair', { ns: 'apps-config' }),
        providers: {
          Centrifuge: 'wss://fullnode.altair.centrifuge.io',
          OnFinality: 'wss://altair.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'basilisk',
        homepage: 'https://bsx.fi',
        paraId: 2090,
        text: t('rpc.kusama.basilisk', 'Basilisk', { ns: 'apps-config' }),
        providers: {
          HydraDX: 'wss://rpc-01.basilisk.hydradx.io',
          OnFinality: 'wss://basilisk.api.onfinality.io/public-ws',
          Dwellir: 'wss://basilisk-rpc.dwellir.com'
        }
      },
      {
        info: 'bifrost',
        homepage: 'https://ksm.vtoken.io/?ref=polkadotjs',
        paraId: 2001,
        text: t('rpc.kusama.bifrost', 'Bifrost (Kusama)', { ns: 'apps-config' }),
        providers: {
          'Liebi 0': 'wss://bifrost-rpc.liebi.com/ws',
          'Liebi 1': 'wss://us.bifrost-rpc.liebi.com/ws',
          'Liebi 2': 'wss://eu.bifrost-rpc.liebi.com/ws',
          OnFinality: 'wss://bifrost-parachain.api.onfinality.io/public-ws',
          Dwellir: 'wss://bifrost-rpc.dwellir.com'
        }
      },
      {
        info: 'bitcountryPioneer',
        homepage: 'https://bit.country/?ref=polkadotjs',
        paraId: 2096,
        text: t('rpc.kusama.pioneerNetwork', 'Bit.Country Pioneer', { ns: 'apps-config' }),
        providers: {
          'Bit.Country': 'wss://pioneer-1-rpc.bit.country',
          OnFinality: 'wss://pioneer.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'calamari',
        homepage: 'https://www.calamari.network/',
        paraId: 2084,
        text: t('rpc.calamari.systems', 'Calamari', { ns: 'apps-config' }),
        providers: {
          'Manta Network': 'wss://ws.calamari.systems/',
          OnFinality: 'wss://calamari.api.onfinality.io/public-ws',
          Dwellir: 'wss://calamari-rpc.dwellir.com'
        }
      },
      {
        info: 'shadow',
        homepage: 'https://crust.network/',
        paraId: 2012,
        text: t('rpc.kusama.shadow', 'Crust Shadow', { ns: 'apps-config' }),
        providers: {
          Crust: 'wss://rpc-shadow.crust.network/'
        }
      },
      {
        info: 'crab',
        homepage: 'https://crab.network',
        paraId: 2105,
        text: t('rpc.kusama.crab', 'Darwinia Crab Parachain', { ns: 'apps-config' }),
        providers: {
          Crab: 'wss://crab-parachain-rpc.darwinia.network/'
        }
      },
      {
        info: 'dorafactory',
        isUnreachable: true,
        homepage: 'https://dorafactory.org/kusama/',
        paraId: 2115,
        text: t('rpc.dorafactory.org', 'Dora Factory', { ns: 'apps-config' }),
        providers: {
          DORA: 'wss://rpc.dorafactory.org'
        }
      },
      {
        info: 'genshiro',
        homepage: 'https://genshiro.equilibrium.io',
        isUnreachable: true, // https://github.com/polkadot-js/apps/pull/6761
        paraId: 2024,
        text: t('rpc.kusama.genshiro', 'Genshiro', { ns: 'apps-config' }),
        providers: {
          Equilibrium: 'wss://node.genshiro.io'
        }
      },
      {
        info: 'integritee',
        homepage: 'https://integritee.network',
        paraId: 2015,
        text: t('rpc.kusama.integritee', 'Integritee Network', { ns: 'apps-config' }),
        providers: {
          Integritee: 'wss://kusama.api.integritee.network'
        }
      },
      {
        info: 'kabocha',
        homepage: 'https://kabocha.network',
        paraId: 2113,
        text: t('rpc.kusama.kabocha', 'Kabocha', { ns: 'apps-config' }),
        providers: {
          JelliedOwl: 'wss://kabocha.jelliedowl.com'
        }
      },
      {
        info: 'karura',
        homepage: 'https://acala.network/karura/join-karura',
        paraId: 2000,
        text: t('rpc.kusama.karura', 'Karura', { ns: 'apps-config' }),
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
        text: t('rpc.kusama.khala', 'Khala Network', { ns: 'apps-config' }),
        providers: {
          Phala: 'wss://khala-api.phala.network/ws',
          OnFinality: 'wss://khala.api.onfinality.io/public-ws',
          Dwellir: 'wss://khala-rpc.dwellir.com'
        }
      },
      {
        info: 'kico',
        homepage: 'https://dico.io/',
        paraId: 2107,
        text: t('rpc.kusama.kico', 'KICO', { ns: 'apps-config' }),
        providers: {
          'DICO Foundation': 'wss://rpc.kico.dico.io',
          'DICO Foundation 2': 'wss://rpc.api.kico.dico.io'
        }
      },
      {
        info: 'kilt',
        homepage: 'https://www.kilt.io/',
        paraId: 2086,
        text: t('rpc.kusama.kilt', 'KILT Spiritnet', { ns: 'apps-config' }),
        providers: {
          'KILT Protocol': 'wss://spiritnet.kilt.io/',
          OnFinality: 'wss://spiritnet.api.onfinality.io/public-ws',
          Dwellir: 'wss://kilt-rpc.dwellir.com'
        }
      },
      {
        info: 'kintsugi',
        homepage: 'https://kintsugi.interlay.io/',
        paraId: 2092,
        text: t('rpc.kusama.kintsugi', 'Kintsugi BTC', { ns: 'apps-config' }),
        providers: {
          'Kintsugi Labs': 'wss://api-kusama.interlay.io/parachain',
          OnFinality: 'wss://kintsugi.api.onfinality.io/public-ws',
          Dwellir: 'wss://kintsugi-rpc.dwellir.com'
        }
      },
      {
        info: 'kpron',
        homepage: 'http://apron.network/',
        isUnreachable: true,
        paraId: 2019,
        text: t('rpc.kusama.kpron', 'Kpron', { ns: 'apps-config' }),
        providers: {
          Kpron: 'wss://kusama-kpron-rpc.apron.network/'
        }
      },
      {
        info: 'listen',
        homepage: 'https://listen.io/',
        paraId: 2118,
        text: t('rpc.kusama.listen', 'Listen Network', { ns: 'apps-config' }),
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
        text: t('rpc.kusama.litmus', 'Litmus', { ns: 'apps-config' }),
        providers: {
          Litentry: 'wss://rpc.litmus-parachain.litentry.io'
        }
      },
      {
        info: 'loomNetwork',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/5888
        homepage: 'https://loomx.io/',
        paraId: 2080,
        text: t('rpc.kusama.loomnetwork', 'Loom Network', { ns: 'apps-config' }),
        providers: {
          LoomNetwork: 'wss://kusama.dappchains.com'
        }
      },
      {
        info: 'mangata',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/7295
        homepage: 'https://mangata.finance',
        paraId: 2110,
        text: t('rpc.kusama.mangata', 'Mangata', { ns: 'apps-config' }),
        providers: {
          Mangata: 'wss://prod-kusama-collator-01.mangatafinance.cloud'
        }
      },
      {
        info: 'mars',
        homepage: 'https://www.aresprotocol.io/mars',
        paraId: 2008,
        text: t('rpc.kusama.mars', 'Mars', { ns: 'apps-config' }),
        providers: {
          AresProtocol: 'wss://wss.mars.aresprotocol.io'
        }
      },
      {
        info: 'moonriver',
        homepage: 'https://moonbeam.foundation/moonriver-crowdloan/',
        paraId: 2023,
        text: t('rpc.kusama.moonriver', 'Moonriver', { ns: 'apps-config' }),
        providers: {
          'Moonbeam Foundation': 'wss://wss.api.moonriver.moonbeam.network',
          OnFinality: 'wss://moonriver.api.onfinality.io/public-ws',
          Dwellir: 'wss://moonriver-rpc.dwellir.com'
          // Pinknode: 'wss://rpc.pinknode.io/moonriver/explorer' // https://github.com/polkadot-js/apps/issues/7058
        }
      },
      {
        info: 'heiko',
        homepage: 'https://parallel.fi',
        paraId: 2085,
        text: t('rpc.kusama.heiko', 'Parallel Heiko', { ns: 'apps-config' }),
        providers: {
          OnFinality: 'wss://parallel-heiko.api.onfinality.io/public-ws',
          Parallel: 'wss://heiko-rpc.parallel.fi'
        }
      },
      {
        info: 'picasso',
        homepage: 'https://picasso.composable.finance/',
        paraId: 2087,
        text: t('rpc.kusama.picasso', 'Picasso', { ns: 'apps-config' }),
        providers: {
          Composable: 'wss://picasso-rpc.composable.finance'
        }
      },
      {
        info: 'pichiu',
        homepage: 'https://kylin.network/',
        paraId: 2102,
        text: t('rpc.kusama.pichiu', 'Pichiu', { ns: 'apps-config' }),
        providers: {
          'Kylin Network': 'wss://kusama.kylin-node.co.uk'
        }
      },
      {
        info: 'polkasmith',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/6595
        homepage: 'https://polkasmith.polkafoundry.com/',
        paraId: 2009,
        text: t('rpc.kusama.polkasmith', 'PolkaSmith by PolkaFoundry', { ns: 'apps-config' }),
        providers: {
          PolkaSmith: 'wss://wss-polkasmith.polkafoundry.com'
        }
      },
      {
        info: 'quartz',
        homepage: 'https://unique.network/',
        paraId: 2095,
        text: t('quartz.unique.network', 'QUARTZ by UNIQUE', { ns: 'apps-config' }),
        providers: {
          Unique: 'wss://quartz.unique.network',
          OnFinality: 'wss://quartz.api.onfinality.io/public-ws',
          'Unique Europe': 'wss://eu-ws-quartz.unique.network',
          'Unique US': 'wss://us-ws-quartz.unique.network'
        }
      },
      {
        info: 'robonomics',
        homepage: 'http://robonomics.network/',
        paraId: 2048,
        text: t('rpc.kusama.robonomics', 'Robonomics', { ns: 'apps-config' }),
        providers: {
          Airalab: 'wss://kusama.rpc.robonomics.network/'
        }
      },
      {
        info: 'trustbase',
        isUnreachable: true, // no providers (yet)
        homepage: 'https://trustbase.network/',
        paraId: 2078,
        text: t('rpc.kusama.trustbase', 'TrustBase', { ns: 'apps-config' }),
        providers: {}
      },
      {
        info: 'sakura',
        homepage: 'https://clover.finance/',
        isUnreachable: true,
        paraId: 2016,
        text: t('rpc.kusama.sakura', 'Sakura', { ns: 'apps-config' }),
        providers: {
          Clover: 'wss://api-sakura.clover.finance'
        }
      },
      {
        info: 'shiden',
        homepage: 'https://shiden.plasmnet.io/',
        paraId: 2007,
        text: t('rpc.kusama.shiden', 'Shiden', { ns: 'apps-config' }),
        providers: {
          StakeTechnologies: 'wss://rpc.shiden.astar.network',
          OnFinality: 'wss://shiden.api.onfinality.io/public-ws',
          Pinknode: 'wss://rpc.pinknode.io/shiden/explorer',
          Dwellir: 'wss://shiden-rpc.dwellir.com'
        }
      },
      {
        info: 'shiden',
        homepage: 'https://shiden.plasmnet.io/',
        paraId: 2120,
        text: t('rpc.kusama.shiden', 'Shiden Crowdloan 2', { ns: 'apps-config' }),
        isUnreachable: true,
        providers: {
          StakeTechnologies: 'wss://rpc.shiden.astar.network'
        }
      },
      {
        info: 'sora_ksm',
        homepage: 'https://sora.org/',
        paraId: 2011,
        text: t('rpc.kusama.sora_ksm', 'SORA Kusama Parachain', { ns: 'apps-config' }),
        providers: {
          Soramitsu: 'wss://ws.parachain-collator-1.c1.sora2.soramitsu.co.jp'
        }
      },
      {
        info: 'subgame',
        homepage: 'http://subgame.org/',
        paraId: 2018,
        text: t('rpc.kusama.subgame', 'SubGame Gamma', { ns: 'apps-config' }),
        providers: {
          SubGame: 'wss://gamma.subgame.org/'
        }
      },
      {
        info: 'subsocialX',
        homepage: 'https://subsocial.network/',
        paraId: 2100,
        text: t('rpc.kusama.subsocial', 'SubsocialX', { ns: 'apps-config' }),
        providers: {
          Dappforce: 'wss://para.subsocial.network'
        }
      },
      {
        info: 'tanganika',
        homepage: 'https://www.datahighway.com/',
        paraId: 2116,
        text: t('rpc.kusama.tanganika', 'Tanganika', { ns: 'apps-config' }),
        providers: {
          DataHighway: 'wss://tanganika.datahighway.com'
        }
      },
      {
        info: 'turing',
        homepage: 'https://oak.tech',
        paraId: 2114,
        text: t('rpc.turing.oak', 'Turing Network', { ns: 'apps-config' }),
        providers: {
          OAK: 'wss://rpc.turing.oak.tech',
          OnFinality: 'wss://turing.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'unorthodox',
        homepage: 'https://standard.tech/',
        paraId: 2094,
        text: t('rpc.kusama.standard', 'Unorthodox', { ns: 'apps-config' }),
        providers: {
          'Standard Protocol': 'wss://rpc.kusama.standard.tech'
        }
      },
      {
        info: 'zeitgeist',
        homepage: 'https://zeitgeist.pm',
        paraId: 2101,
        text: t('rpc.kusama.zeitgeist', 'Zeitgeist', { ns: 'apps-config' }),
        providers: {
          ZeitgeistPM: 'wss://rpc-0.zeitgeist.pm',
          Dwellir: 'wss://zeitgeist-rpc.dwellir.com'
        }
      }
    ];

var polkadotEndpoints = [
      // (1) system parachains (none available yet)
      // ...
      // (2) all common good parachains
      {
        info: 'statemint',
        paraId: 1000,
        text: t('rpc.polkadot.statemint', 'Statemint', { ns: 'apps-config' }),
        providers: {
          Parity: 'wss://statemint-rpc.polkadot.io',
          OnFinality: 'wss://statemint.api.onfinality.io/public-ws',
          Dwellir: 'wss://statemint-rpc.dwellir.com'
        }
      },
      /// (3) parachains with id, see Rococo (info here maps to the actual "named icon")
      //
      // NOTE: Added alphabetical based on chain name
      {
        info: 'acala',
        homepage: 'https://acala.network/',
        paraId: 2000,
        text: t('rpc.polkadot.acala', 'Acala', { ns: 'apps-config' }),
        providers: {
          'Acala Foundation 0': 'wss://acala-rpc-0.aca-api.network',
          'Acala Foundation 1': 'wss://acala-rpc-1.aca-api.network',
          // 'Acala Foundation 2': 'wss://acala-rpc-2.aca-api.network/ws', // https://github.com/polkadot-js/apps/issues/6965
          'Acala Foundation 3': 'wss://acala-rpc-3.aca-api.network/ws',
          'Polkawallet 0': 'wss://acala.polkawallet.io',
          OnFinality: 'wss://acala-polkadot.api.onfinality.io/public-ws',
          Dwellir: 'wss://acala-rpc.dwellir.com'
        }
      },
      {
        info: 'odyssey',
        homepage: 'https://www.aresprotocol.io/',
        paraId: 2028,
        text: t('rpc.polkadot.odyssey', 'Ares Odyssey', { ns: 'apps-config' }),
        providers: {
          AresProtocol: 'wss://wss.odyssey.aresprotocol.io'
        }
      },
      {
        info: 'astar',
        homepage: 'https://astar.network',
        paraId: 2006,
        text: t('rpc.polkadot.astar', 'Astar', { ns: 'apps-config' }),
        providers: {
          Astar: 'wss://rpc.astar.network',
          OnFinality: 'wss://astar.api.onfinality.io/public-ws',
          Dwellir: 'wss://astar-rpc.dwellir.com'
        }
      },
      {
        info: 'bifrost',
        isUnreachable: true,
        homepage: 'https://crowdloan.bifrost.app',
        paraId: 2030,
        text: t('rpc.polkadot.bifrost', 'Bifrost', { ns: 'apps-config' }),
        providers: {
          Liebi: 'wss://bifrost-dot.liebi.com/ws'
        }
      },
      {
        info: 'centrifuge',
        homepage: 'https://centrifuge.io',
        paraId: 2031,
        text: t('rpc.polkadot.centrifuge', 'Centrifuge', { ns: 'apps-config' }),
        providers: {
          Centrifuge: 'wss://fullnode.parachain.centrifuge.io',
          OnFinality: 'wss://centrifuge-parachain.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'clover',
        homepage: 'https://clover.finance',
        paraId: 2002,
        text: t('rpc.polkadot.clover-para', 'Clover', { ns: 'apps-config' }),
        providers: {
          Clover: 'wss://rpc-para.clover.finance',
          OnFinality: 'wss://clover.api.onfinality.io/public-ws'
        }
      },
      {
        // this is also a duplicate as a Live and Testing network -
        // it is either/or, not and
        info: 'coinversation',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/6635
        homepage: 'http://www.coinversation.io/',
        paraId: 2027,
        text: t('rpc.polkadot.coinversation', 'Coinversation', { ns: 'apps-config' }),
        providers: {
          Coinversation: 'wss://rpc.coinversation.io/'
        }
      },
      {
        info: 'composableFinance',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/6721
        homepage: 'https://composable.finance/',
        paraId: 2019,
        text: t('rpc.polkadot.composable', 'Composable Finance', { ns: 'apps-config' }),
        providers: {
          Composable: 'wss://rpc.composable.finance'
        }
      },
      {
        info: 'crustParachain',
        homepage: 'https://crust.network',
        paraId: 2008,
        isUnreachable: true,
        text: t('rpc.polkadot.crust', 'Crust', { ns: 'apps-config' }),
        providers: {
          Crust: 'wss://rpc.crust.network'
        }
      },
      {
        info: 'darwinia',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/6530
        homepage: 'https://darwinia.network/',
        paraId: 2003,
        text: t('rpc.polkadot.darwinia', 'Darwinia', { ns: 'apps-config' }),
        providers: {
          Darwinia: 'wss://parachain-rpc.darwinia.network'
        }
      },
      {
        info: 'efinity',
        homepage: 'https://efinity.io',
        paraId: 2021,
        text: t('rpc.polkadot.efinity', 'Efinity', { ns: 'apps-config' }),
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
        text: t('rpc.polkadot.equilibrium', 'Equilibrium', { ns: 'apps-config' }),
        providers: {
          Equilibrium: 'wss://node.pol.equilibrium.io/'
        }
      },
      {
        info: 'geminis',
        isUnreachable: true,
        homepage: 'https://geminis.network/',
        paraId: 2038,
        text: t('rpc.polkadot.geminis', 'Geminis', { ns: 'apps-config' }),
        providers: {
          Geminis: 'wss://rpc.geminis.network'
        }
      },
      {
        info: 'hydra',
        homepage: 'https://hydradx.io/',
        paraId: 2034,
        text: t('rpc.polkadot.hydra', 'HydraDX', { ns: 'apps-config' }),
        providers: {
          'Galactic Council': 'wss://rpc-01.hydradx.io'
        }
      },
      {
        info: 'interlay',
        homepage: 'https://interlay.io/',
        paraId: 2032,
        text: t('rpc.polkadot.interlay', 'Interlay', { ns: 'apps-config' }),
        providers: {
          'Kintsugi Labs': 'wss://api.interlay.io/parachain',
          OnFinality: 'wss://interlay.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'kapex',
        homepage: 'https://totemaccounting.com/',
        paraId: 2007,
        text: t('rpc.polkadot.kapex', 'Kapex', { ns: 'apps-config' }),
        providers: {
          Totem: 'wss://k-ui.kapex.network'
        }
      },
      {
        info: 'litentry',
        homepage: 'https://crowdloan.litentry.com',
        paraId: 2013,
        isUnreachable: true,
        text: t('rpc.polkadot.litentry', 'Litentry', { ns: 'apps-config' }),
        providers: {
          Litentry: 'wss://parachain.litentry.io'
        }
      },
      {
        info: 'manta',
        isUnreachable: true, // https://github.com/polkadot-js/apps/issues/7018
        homepage: 'https://manta.network',
        paraId: 2015,
        text: t('rpc.polkadot.manta', 'Manta', { ns: 'apps-config' }),
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
        text: t('rpc.polkadot.moonbeam', 'Moonbeam', { ns: 'apps-config' }),
        providers: {
          'Moonbeam Foundation': 'wss://wss.api.moonbeam.network',
          OnFinality: 'wss://moonbeam.api.onfinality.io/public-ws',
          Dwellir: 'wss://moonbeam-rpc.dwellir.com'
        }
      },
      {
        info: 'nodle',
        homepage: 'https://nodle.com',
        paraId: 2026,
        text: t('rpc.polkadot.nodle', 'Nodle', { ns: 'apps-config' }),
        providers: {
          OnFinality: 'wss://nodle-parachain.api.onfinality.io/public-ws',
          Dwellir: 'wss://eden-rpc.dwellir.com'
        }
      },
      {
        info: 'origintrail-parachain',
        homepage: 'https://parachain.origintrail.io',
        isUnreachable: true,
        text: t('rpc.polkadot.origintrail', 'OriginTrail Parachain', { ns: 'apps-config' }),
        paraId: 2043,
        providers: {
          TraceLabs: 'wss://parachain-rpc.origin-trail.network'
        }
      },
      {
        info: 'parallel',
        homepage: 'https://parallel.fi',
        paraId: 2012,
        text: t('rpc.polkadot.parallel', 'Parallel', { ns: 'apps-config' }),
        providers: {
          OnFinality: 'wss://parallel.api.onfinality.io/public-ws',
          Parallel: 'wss://rpc.parallel.fi'
        }
      },
      {
        info: 'phala',
        homepage: 'https://phala.network',
        paraId: 2035,
        text: t('rpc.polkadot.phala', 'Phala Network', { ns: 'apps-config' }),
        providers: {
          Phala: 'wss://api.phala.network/ws'
        }
      },
      {
        info: 'polkadex',
        homepage: 'https://polkadex.trade/',
        paraId: 2040,
        text: t('rpc.polkadot.polkadex', 'Polkadex', { ns: 'apps-config' }),
        providers: {
          'Polkadex Team': 'wss://mainnet.polkadex.trade/',
          OnFinality: 'wss://polkadex.api.onfinality.io/public-ws'
        }
      },
      {
        info: 'subdao',
        homepage: 'https://subdao.network/',
        paraId: 2018,
        isUnreachable: true,
        text: t('rpc.polkadot.subdao', 'SubDAO', { ns: 'apps-config' }),
        providers: {
          SubDAO: 'wss://parachain-rpc.subdao.org'
        }
      },
      {
        info: 'subgame',
        homepage: 'http://subgame.org/',
        isUnreachable: true, // https://github.com/polkadot-js/apps/pull/6761
        paraId: 2017,
        text: t('rpc.polkadot.subgame', 'SubGame Gamma', { ns: 'apps-config' }),
        providers: {
          SubGame: 'wss://gamma.subgame.org/'
        }
      },
      {
        info: 'unique',
        homepage: 'https://unique.network/',
        paraId: 2037,
        text: t('ws.unique.network', 'Unique Network', { ns: 'apps-config' }),
        providers: {
          Unique: 'wss://ws.unique.network/'
        }
      }
    ];

    //todo production relay map


    function prepareEndpoints(){
      let parachainMap = {} // [relaychain-paraID] -> endpoints
      for (const ep of kusamaEndpoints){
        let k = `kusama-${ep.paraId}`
        let endpoint = {
          id: ep.info,
          relaychain: 'kusama',
          paraId: ep.paraId,
          website: ep.homepage,
          isUnreachable: ep.isUnreachable,
          rpc: ep.text,
          WSEndpoints: [],
        }
        for (const p of Object.keys(ep.providers)){
          endpoint.WSEndpoints.push(ep.providers[p])
        }
        parachainMap[k] = endpoint
      }
      for (const ep of polkadotEndpoints){
        let k = `polkadot-${ep.paraId}`

        let endpoint = {
          id: ep.info,
          relaychain: 'polkadot',
          paraId: ep.paraId,
          website: ep.homepage,
          isUnreachable: (ep.isUnreachable != undefined)? ep.isUnreachable: false,
          rpc: ep.text,
          WSEndpoints: [],
        }
        for (const p of Object.keys(ep.providers)){
          endpoint.WSEndpoints.push(ep.providers[p])
        }
        parachainMap[k] = endpoint
      }
      return parachainMap
    }

module.exports = {
    getKusamaEndpoints: function() {
        return kusamaEndpoints;
    },
    getPolkadotEndpoints: function() {
        return polkadotEndpoints;
    },
    getAllEndpoints: function() {
        return prepareEndpoints();
    },
};
