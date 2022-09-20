(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@polkadot/util'), require('@polkadot/util-crypto')) :
  typeof define === 'function' && define.amd ? define(['exports', '@polkadot/util', '@polkadot/util-crypto'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.polkadotTypes = {}, global.polkadotUtil, global.polkadotUtilCrypto));
})(this, (function (exports, util, utilCrypto) { 'use strict';

  const global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window;

  const AllHashers = {
    Blake2_128: null,
    Blake2_256: null,
    Blake2_128Concat: null,
    Twox128: null,
    Twox256: null,
    Twox64Concat: null,
    Identity: null
  };

  const runtime$o = {
    Metadata: [{
      methods: {
        metadata: {
          description: 'Returns the metadata of a runtime',
          params: [],
          type: 'OpaqueMetadata'
        }
      },
      version: 1
    }]
  };

  const v9 = {
    ErrorMetadataV9: {
      name: 'Text',
      docs: 'Vec<Text>'
    },
    EventMetadataV9: {
      name: 'Text',
      args: 'Vec<Type>',
      docs: 'Vec<Text>'
    },
    FunctionArgumentMetadataV9: {
      name: 'Text',
      type: 'Type'
    },
    FunctionMetadataV9: {
      name: 'Text',
      args: 'Vec<FunctionArgumentMetadataV9>',
      docs: 'Vec<Text>'
    },
    MetadataV9: {
      modules: 'Vec<ModuleMetadataV9>'
    },
    ModuleConstantMetadataV9: {
      name: 'Text',
      type: 'Type',
      value: 'Bytes',
      docs: 'Vec<Text>'
    },
    ModuleMetadataV9: {
      name: 'Text',
      storage: 'Option<StorageMetadataV9>',
      calls: 'Option<Vec<FunctionMetadataV9>>',
      events: 'Option<Vec<EventMetadataV9>>',
      constants: 'Vec<ModuleConstantMetadataV9>',
      errors: 'Vec<ErrorMetadataV9>'
    },
    StorageEntryMetadataV9: {
      name: 'Text',
      modifier: 'StorageEntryModifierV9',
      type: 'StorageEntryTypeV9',
      fallback: 'Bytes',
      docs: 'Vec<Text>'
    },
    StorageEntryModifierV9: {
      _enum: ['Optional', 'Default', 'Required']
    },
    StorageEntryTypeV9: {
      _enum: {
        Plain: 'Type',
        Map: {
          hasher: 'StorageHasherV9',
          key: 'Type',
          value: 'Type',
          linked: 'bool'
        },
        DoubleMap: {
          hasher: 'StorageHasherV9',
          key1: 'Type',
          key2: 'Type',
          value: 'Type',
          key2Hasher: 'StorageHasherV9'
        }
      }
    },
    StorageHasherV9: {
      _enum: {
        Blake2_128: null,
        Blake2_256: null,
        Twox128: null,
        Twox256: null,
        Twox64Concat: null
      }
    },
    StorageMetadataV9: {
      prefix: 'Text',
      items: 'Vec<StorageEntryMetadataV9>'
    }
  };

  const v10 = {
    ErrorMetadataV10: 'ErrorMetadataV9',
    EventMetadataV10: 'EventMetadataV9',
    FunctionArgumentMetadataV10: 'FunctionArgumentMetadataV9',
    FunctionMetadataV10: 'FunctionMetadataV9',
    MetadataV10: {
      modules: 'Vec<ModuleMetadataV10>'
    },
    ModuleConstantMetadataV10: 'ModuleConstantMetadataV9',
    ModuleMetadataV10: {
      name: 'Text',
      storage: 'Option<StorageMetadataV10>',
      calls: 'Option<Vec<FunctionMetadataV10>>',
      events: 'Option<Vec<EventMetadataV10>>',
      constants: 'Vec<ModuleConstantMetadataV10>',
      errors: 'Vec<ErrorMetadataV10>'
    },
    StorageEntryModifierV10: 'StorageEntryModifierV9',
    StorageEntryMetadataV10: {
      name: 'Text',
      modifier: 'StorageEntryModifierV10',
      type: 'StorageEntryTypeV10',
      fallback: 'Bytes',
      docs: 'Vec<Text>'
    },
    StorageEntryTypeV10: {
      _enum: {
        Plain: 'Type',
        Map: {
          hasher: 'StorageHasherV10',
          key: 'Type',
          value: 'Type',
          linked: 'bool'
        },
        DoubleMap: {
          hasher: 'StorageHasherV10',
          key1: 'Type',
          key2: 'Type',
          value: 'Type',
          key2Hasher: 'StorageHasherV10'
        }
      }
    },
    StorageMetadataV10: {
      prefix: 'Text',
      items: 'Vec<StorageEntryMetadataV10>'
    },
    StorageHasherV10: {
      _enum: {
        Blake2_128: null,
        Blake2_256: null,
        Blake2_128Concat: null,
        Twox128: null,
        Twox256: null,
        Twox64Concat: null
      }
    }
  };

  const v11 = {
    ErrorMetadataV11: 'ErrorMetadataV10',
    EventMetadataV11: 'EventMetadataV10',
    ExtrinsicMetadataV11: {
      version: 'u8',
      signedExtensions: 'Vec<Text>'
    },
    FunctionArgumentMetadataV11: 'FunctionArgumentMetadataV10',
    FunctionMetadataV11: 'FunctionMetadataV10',
    MetadataV11: {
      modules: 'Vec<ModuleMetadataV11>',
      extrinsic: 'ExtrinsicMetadataV11'
    },
    ModuleConstantMetadataV11: 'ModuleConstantMetadataV10',
    ModuleMetadataV11: {
      name: 'Text',
      storage: 'Option<StorageMetadataV11>',
      calls: 'Option<Vec<FunctionMetadataV11>>',
      events: 'Option<Vec<EventMetadataV11>>',
      constants: 'Vec<ModuleConstantMetadataV11>',
      errors: 'Vec<ErrorMetadataV11>'
    },
    StorageEntryModifierV11: 'StorageEntryModifierV10',
    StorageEntryMetadataV11: {
      name: 'Text',
      modifier: 'StorageEntryModifierV11',
      type: 'StorageEntryTypeV11',
      fallback: 'Bytes',
      docs: 'Vec<Text>'
    },
    StorageEntryTypeV11: {
      _enum: {
        Plain: 'Type',
        Map: {
          hasher: 'StorageHasherV11',
          key: 'Type',
          value: 'Type',
          linked: 'bool'
        },
        DoubleMap: {
          hasher: 'StorageHasherV11',
          key1: 'Type',
          key2: 'Type',
          value: 'Type',
          key2Hasher: 'StorageHasherV11'
        }
      }
    },
    StorageMetadataV11: {
      prefix: 'Text',
      items: 'Vec<StorageEntryMetadataV11>'
    },
    StorageHasherV11: {
      _enum: AllHashers
    }
  };

  const v12 = {
    ErrorMetadataV12: 'ErrorMetadataV11',
    EventMetadataV12: 'EventMetadataV11',
    ExtrinsicMetadataV12: 'ExtrinsicMetadataV11',
    FunctionArgumentMetadataV12: 'FunctionArgumentMetadataV11',
    FunctionMetadataV12: 'FunctionMetadataV11',
    MetadataV12: {
      modules: 'Vec<ModuleMetadataV12>',
      extrinsic: 'ExtrinsicMetadataV12'
    },
    ModuleConstantMetadataV12: 'ModuleConstantMetadataV11',
    ModuleMetadataV12: {
      name: 'Text',
      storage: 'Option<StorageMetadataV12>',
      calls: 'Option<Vec<FunctionMetadataV12>>',
      events: 'Option<Vec<EventMetadataV12>>',
      constants: 'Vec<ModuleConstantMetadataV12>',
      errors: 'Vec<ErrorMetadataV12>',
      index: 'u8'
    },
    StorageEntryModifierV12: 'StorageEntryModifierV11',
    StorageEntryMetadataV12: 'StorageEntryMetadataV11',
    StorageEntryTypeV12: 'StorageEntryTypeV11',
    StorageMetadataV12: 'StorageMetadataV11',
    StorageHasherV12: 'StorageHasherV11'
  };

  const v13 = {
    ErrorMetadataV13: 'ErrorMetadataV12',
    EventMetadataV13: 'EventMetadataV12',
    ExtrinsicMetadataV13: 'ExtrinsicMetadataV12',
    FunctionArgumentMetadataV13: 'FunctionArgumentMetadataV12',
    FunctionMetadataV13: 'FunctionMetadataV12',
    MetadataV13: {
      modules: 'Vec<ModuleMetadataV13>',
      extrinsic: 'ExtrinsicMetadataV13'
    },
    ModuleConstantMetadataV13: 'ModuleConstantMetadataV12',
    ModuleMetadataV13: {
      name: 'Text',
      storage: 'Option<StorageMetadataV13>',
      calls: 'Option<Vec<FunctionMetadataV13>>',
      events: 'Option<Vec<EventMetadataV13>>',
      constants: 'Vec<ModuleConstantMetadataV13>',
      errors: 'Vec<ErrorMetadataV13>',
      index: 'u8'
    },
    StorageEntryModifierV13: 'StorageEntryModifierV12',
    StorageEntryMetadataV13: {
      name: 'Text',
      modifier: 'StorageEntryModifierV13',
      type: 'StorageEntryTypeV13',
      fallback: 'Bytes',
      docs: 'Vec<Text>'
    },
    StorageEntryTypeV13: {
      _enum: {
        Plain: 'Type',
        Map: {
          hasher: 'StorageHasherV13',
          key: 'Type',
          value: 'Type',
          linked: 'bool'
        },
        DoubleMap: {
          hasher: 'StorageHasherV13',
          key1: 'Type',
          key2: 'Type',
          value: 'Type',
          key2Hasher: 'StorageHasherV13'
        },
        NMap: {
          keyVec: 'Vec<Type>',
          hashers: 'Vec<StorageHasherV13>',
          value: 'Type'
        }
      }
    },
    StorageMetadataV13: {
      prefix: 'Text',
      items: 'Vec<StorageEntryMetadataV13>'
    },
    StorageHasherV13: 'StorageHasherV12'
  };

  const Si1Variant = {
    name: 'Text',
    fields: 'Vec<Si1Field>',
    index: 'u8',
    docs: 'Vec<Text>'
  };
  const v1$1 = {
    Si1Field: {
      name: 'Option<Text>',
      type: 'Si1LookupTypeId',
      typeName: 'Option<Text>',
      docs: 'Vec<Text>'
    },
    Si1LookupTypeId: 'Compact<u32>',
    Si1Path: 'Si0Path',
    Si1Type: {
      path: 'Si1Path',
      params: 'Vec<Si1TypeParameter>',
      def: 'Si1TypeDef',
      docs: 'Vec<Text>'
    },
    Si1TypeDef: {
      _enum: {
        Composite: 'Si1TypeDefComposite',
        Variant: 'Si1TypeDefVariant',
        Sequence: 'Si1TypeDefSequence',
        Array: 'Si1TypeDefArray',
        Tuple: 'Si1TypeDefTuple',
        Primitive: 'Si1TypeDefPrimitive',
        Compact: 'Si1TypeDefCompact',
        BitSequence: 'Si1TypeDefBitSequence',
        HistoricMetaCompat: 'Type'
      }
    },
    Si1TypeDefArray: {
      len: 'u32',
      type: 'Si1LookupTypeId'
    },
    Si1TypeDefBitSequence: {
      bitStoreType: 'Si1LookupTypeId',
      bitOrderType: 'Si1LookupTypeId'
    },
    Si1TypeDefCompact: {
      type: 'Si1LookupTypeId'
    },
    Si1TypeDefComposite: {
      fields: 'Vec<Si1Field>'
    },
    Si1TypeDefPrimitive: 'Si0TypeDefPrimitive',
    Si1TypeDefSequence: {
      type: 'Si1LookupTypeId'
    },
    Si1TypeDefTuple: 'Vec<Si1LookupTypeId>',
    Si1TypeParameter: {
      name: 'Text',
      type: 'Option<Si1LookupTypeId>'
    },
    Si1TypeDefVariant: {
      variants: 'Vec<Si1Variant>'
    },
    Si1Variant
  };

  const v14 = {
    PortableTypeV14: {
      id: 'Si1LookupTypeId',
      type: 'Si1Type'
    },
    ErrorMetadataV14: util.objectSpread({}, Si1Variant, {
      args: 'Vec<Type>'
    }),
    EventMetadataV14: util.objectSpread({}, Si1Variant, {
      args: 'Vec<Type>'
    }),
    FunctionArgumentMetadataV14: {
      name: 'Text',
      type: 'Type',
      typeName: 'Option<Type>'
    },
    FunctionMetadataV14: util.objectSpread({}, Si1Variant, {
      args: 'Vec<FunctionArgumentMetadataV14>'
    }),
    ExtrinsicMetadataV14: {
      type: 'SiLookupTypeId',
      version: 'u8',
      signedExtensions: 'Vec<SignedExtensionMetadataV14>'
    },
    MetadataV14: {
      lookup: 'PortableRegistry',
      pallets: 'Vec<PalletMetadataV14>',
      extrinsic: 'ExtrinsicMetadataV14',
      type: 'SiLookupTypeId'
    },
    PalletCallMetadataV14: {
      type: 'SiLookupTypeId'
    },
    PalletConstantMetadataV14: {
      name: 'Text',
      type: 'SiLookupTypeId',
      value: 'Bytes',
      docs: 'Vec<Text>'
    },
    PalletErrorMetadataV14: {
      type: 'SiLookupTypeId'
    },
    PalletEventMetadataV14: {
      type: 'SiLookupTypeId'
    },
    PalletMetadataV14: {
      name: 'Text',
      storage: 'Option<PalletStorageMetadataV14>',
      calls: 'Option<PalletCallMetadataV14>',
      events: 'Option<PalletEventMetadataV14>',
      constants: 'Vec<PalletConstantMetadataV14>',
      errors: 'Option<PalletErrorMetadataV14>',
      index: 'u8'
    },
    PalletStorageMetadataV14: {
      prefix: 'Text',
      items: 'Vec<StorageEntryMetadataV14>'
    },
    SignedExtensionMetadataV14: {
      identifier: 'Text',
      type: 'SiLookupTypeId',
      additionalSigned: 'SiLookupTypeId'
    },
    StorageEntryMetadataV14: {
      name: 'Text',
      modifier: 'StorageEntryModifierV14',
      type: 'StorageEntryTypeV14',
      fallback: 'Bytes',
      docs: 'Vec<Text>'
    },
    StorageEntryModifierV14: 'StorageEntryModifierV13',
    StorageEntryTypeV14: {
      _enum: {
        Plain: 'SiLookupTypeId',
        Map: {
          hashers: 'Vec<StorageHasherV14>',
          key: 'SiLookupTypeId',
          value: 'SiLookupTypeId'
        }
      }
    },
    StorageHasherV14: 'StorageHasherV13'
  };

  const definitions$14 = {
    rpc: {},
    runtime: runtime$o,
    types: util.objectSpread({}, v9, v10, v11, v12, v13, v14, {
      ErrorMetadataLatest: 'ErrorMetadataV14',
      EventMetadataLatest: 'EventMetadataV14',
      ExtrinsicMetadataLatest: 'ExtrinsicMetadataV14',
      FunctionArgumentMetadataLatest: 'FunctionArgumentMetadataV14',
      FunctionMetadataLatest: 'FunctionMetadataV14',
      MetadataLatest: 'MetadataV14',
      PalletCallMetadataLatest: 'PalletCallMetadataV14',
      PalletConstantMetadataLatest: 'PalletConstantMetadataV14',
      PalletErrorMetadataLatest: 'PalletErrorMetadataV14',
      PalletEventMetadataLatest: 'PalletEventMetadataV14',
      PalletMetadataLatest: 'PalletMetadataV14',
      PalletStorageMetadataLatest: 'PalletStorageMetadataV14',
      PortableType: 'PortableTypeV14',
      SignedExtensionMetadataLatest: 'SignedExtensionMetadataV14',
      StorageEntryMetadataLatest: 'StorageEntryMetadataV14',
      StorageEntryModifierLatest: 'StorageEntryModifierV14',
      StorageEntryTypeLatest: 'StorageEntryTypeV14',
      StorageHasher: 'StorageHasherV14',
      OpaqueMetadata: 'Opaque<Bytes>',
      MetadataAll: {
        _enum: {
          V0: 'DoNotConstruct<MetadataV0>',
          V1: 'DoNotConstruct<MetadataV1>',
          V2: 'DoNotConstruct<MetadataV2>',
          V3: 'DoNotConstruct<MetadataV3>',
          V4: 'DoNotConstruct<MetadataV4>',
          V5: 'DoNotConstruct<MetadataV5>',
          V6: 'DoNotConstruct<MetadataV6>',
          V7: 'DoNotConstruct<MetadataV7>',
          V8: 'DoNotConstruct<MetadataV8>',
          V9: 'MetadataV9',
          V10: 'MetadataV10',
          V11: 'MetadataV11',
          V12: 'MetadataV12',
          V13: 'MetadataV13',
          V14: 'MetadataV14'
        }
      }
    })
  };

  const CORE_V1_TO_V4 = {
    execute_block: {
      description: 'Execute the given block.',
      params: [{
        name: 'block',
        type: 'Block'
      }],
      type: 'Null'
    }
  };
  const CORE_V1_TO_V2 = {
    version: {
      description: 'Returns the version of the runtime.',
      params: [],
      type: 'RuntimeVersionPre3'
    }
  };
  const CORE_V2_TO_V4 = {
    initialize_block: {
      description: 'Initialize a block with the given header.',
      params: [{
        name: 'header',
        type: 'Header'
      }],
      type: 'Null'
    }
  };
  const runtime$n = {
    Core: [{
      methods: util.objectSpread({
        version: {
          description: 'Returns the version of the runtime.',
          params: [],
          type: 'RuntimeVersion'
        }
      }, CORE_V1_TO_V4, CORE_V2_TO_V4),
      version: 4
    }, {
      methods: util.objectSpread({
        version: {
          description: 'Returns the version of the runtime.',
          params: [],
          type: 'RuntimeVersionPre4'
        }
      }, CORE_V1_TO_V4, CORE_V2_TO_V4),
      version: 3
    }, {
      methods: util.objectSpread({}, CORE_V1_TO_V2, CORE_V1_TO_V4, CORE_V2_TO_V4),
      version: 2
    }, {
      methods: util.objectSpread({
        initialise_block: {
          description: 'Initialize a block with the given header.',
          params: [{
            name: 'header',
            type: 'Header'
          }],
          type: 'Null'
        }
      }, CORE_V1_TO_V2, CORE_V1_TO_V4),
      version: 1
    }]
  };

  const numberTypes = {
    Fixed64: 'Int<64, Fixed64>',
    FixedI64: 'Int<64, FixedI64>',
    FixedU64: 'UInt<64, FixedU64>',
    Fixed128: 'Int<128, Fixed128>',
    FixedI128: 'Int<128, FixedI128>',
    FixedU128: 'UInt<128, FixedU128>',
    I32F32: 'Int<64, I32F32>',
    U32F32: 'UInt<64, U32F32>',
    PerU16: 'UInt<16, PerU16>',
    Perbill: 'UInt<32, Perbill>',
    Percent: 'UInt<8, Percent>',
    Permill: 'UInt<32, Permill>',
    Perquintill: 'UInt<64, Perquintill>'
  };
  const knownOrigins = {
    Council: 'CollectiveOrigin',
    System: 'SystemOrigin',
    TechnicalCommittee: 'CollectiveOrigin',
    Xcm: 'XcmOrigin',
    XcmPallet: 'XcmOrigin',
    Authority: 'AuthorityOrigin',
    GeneralCouncil: 'CollectiveOrigin'
  };
  const definitions$13 = {
    rpc: {},
    runtime: runtime$n,
    types: util.objectSpread({}, numberTypes, {
      AccountId: 'AccountId32',
      AccountId20: 'GenericEthereumAccountId',
      AccountId32: 'GenericAccountId32',
      AccountId33: 'GenericAccountId33',
      AccountIdOf: 'AccountId',
      AccountIndex: 'GenericAccountIndex',
      Address: 'MultiAddress',
      AssetId: 'u32',
      Balance: 'UInt<128, Balance>',
      BalanceOf: 'Balance',
      Block: 'GenericBlock',
      BlockNumber: 'u32',
      BlockNumberFor: 'BlockNumber',
      BlockNumberOf: 'BlockNumber',
      Call: 'GenericCall',
      CallHash: 'Hash',
      CallHashOf: 'CallHash',
      ChangesTrieConfiguration: {
        digestInterval: 'u32',
        digestLevels: 'u32'
      },
      ChangesTrieSignal: {
        _enum: {
          NewConfiguration: 'Option<ChangesTrieConfiguration>'
        }
      },
      ConsensusEngineId: 'GenericConsensusEngineId',
      CodecHash: 'Hash',
      CrateVersion: {
        major: 'u16',
        minor: 'u8',
        patch: 'u8'
      },
      Digest: {
        logs: 'Vec<DigestItem>'
      },
      DigestItem: {
        _enum: {
          Other: 'Bytes',
          AuthoritiesChange: 'Vec<AuthorityId>',
          ChangesTrieRoot: 'Hash',
          SealV0: 'SealV0',
          Consensus: 'Consensus',
          Seal: 'Seal',
          PreRuntime: 'PreRuntime',
          ChangesTrieSignal: 'ChangesTrieSignal',
          RuntimeEnvironmentUpdated: 'Null'
        }
      },
      ExtrinsicsWeight: {
        normal: 'Weight',
        operational: 'Weight'
      },
      H32: '[u8; 4; H32]',
      H64: '[u8; 8; H64]',
      H128: '[u8; 16; H128]',
      H160: '[u8; 20; H160]',
      H256: '[u8; 32; H256]',
      H512: '[u8; 64; H512]',
      H1024: '[u8; 128; H1024]',
      H2048: '[u8; 256; H2048]',
      Hash: 'H256',
      Header: {
        parentHash: 'Hash',
        number: 'Compact<BlockNumber>',
        stateRoot: 'Hash',
        extrinsicsRoot: 'Hash',
        digest: 'Digest'
      },
      HeaderPartial: {
        parentHash: 'Hash',
        number: 'BlockNumber'
      },
      IndicesLookupSource: 'GenericLookupSource',
      Index: 'u32',
      Justification: '(ConsensusEngineId, EncodedJustification)',
      EncodedJustification: 'Bytes',
      Justifications: 'Vec<Justification>',
      KeyValue: '(StorageKey, StorageData)',
      KeyTypeId: 'u32',
      LockIdentifier: '[u8; 8]',
      LookupSource: 'MultiAddress',
      LookupTarget: 'AccountId',
      ModuleId: 'LockIdentifier',
      MultiAddress: 'GenericMultiAddress',
      MultiSigner: {
        _enum: {
          Ed25519: '[u8; 32]',
          Sr25519: '[u8; 32]',
          Ecdsa: '[u8; 33]'
        }
      },
      Moment: 'UInt<64, Moment>',
      OpaqueCall: 'Bytes',
      Origin: 'DoNotConstruct<Origin>',
      OriginCaller: {
        _enum: {
          System: 'SystemOrigin'
        }
      },
      PalletId: 'LockIdentifier',
      PalletsOrigin: 'OriginCaller',
      PalletVersion: {
        major: 'u16',
        minor: 'u8',
        patch: 'u8'
      },
      Pays: {
        _enum: ['Yes', 'No']
      },
      Phantom: 'Null',
      PhantomData: 'Null',
      Releases: {
        _enum: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10']
      },
      RuntimeDbWeight: {
        read: 'Weight',
        write: 'Weight'
      },
      SignedBlock: 'SignedBlockWithJustifications',
      SignedBlockWithJustification: {
        block: 'Block',
        justification: 'Option<EncodedJustification>'
      },
      SignedBlockWithJustifications: {
        block: 'Block',
        justifications: 'Option<Justifications>'
      },
      Slot: 'u64',
      SlotDuration: 'u64',
      StorageData: 'Bytes',
      StorageInfo: {
        palletName: 'Bytes',
        storage_name: 'Bytes',
        prefix: 'Bytes',
        maxValues: 'Option<u32>',
        maxSize: 'Option<u32>'
      },
      StorageProof: {
        trieNodes: 'Vec<Bytes>'
      },
      TransactionPriority: 'u64',
      TransactionLongevity: 'u64',
      TransactionTag: 'Bytes',
      TransactionInfo: {
        _alias: {
          dataSize: 'size'
        },
        chunkRoot: 'H256',
        contentHash: 'H256',
        dataSize: 'u32',
        blockChunks: 'u32'
      },
      TransactionStorageProof: {
        chunk: 'Vec<u8>',
        proof: 'Vec<Vec<u8>>'
      },
      ValidatorId: 'AccountId',
      ValidatorIdOf: 'ValidatorId',
      Weight: 'u64',
      WeightMultiplier: 'Fixed64',
      PreRuntime: '(ConsensusEngineId, Bytes)',
      SealV0: '(u64, Signature)',
      Seal: '(ConsensusEngineId, Bytes)',
      Consensus: '(ConsensusEngineId, Bytes)'
    })
  };

  const v0$1 = {
    Si0Field: {
      name: 'Option<Text>',
      type: 'Si0LookupTypeId',
      typeName: 'Option<Text>',
      docs: 'Vec<Text>'
    },
    Si0LookupTypeId: 'u32',
    Si0Path: 'Vec<Text>',
    Si0Type: {
      path: 'Si0Path',
      params: 'Vec<Si0LookupTypeId>',
      def: 'Si0TypeDef'
    },
    Si0TypeDef: {
      _enum: {
        Composite: 'Si0TypeDefComposite',
        Variant: 'Si0TypeDefVariant',
        Sequence: 'Si0TypeDefSequence',
        Array: 'Si0TypeDefArray',
        Tuple: 'Si0TypeDefTuple',
        Primitive: 'Si0TypeDefPrimitive',
        Compact: 'Si0TypeDefCompact',
        Phantom: 'Si0TypeDefPhantom',
        BitSequence: 'Si0TypeDefBitSequence'
      }
    },
    Si0TypeDefArray: {
      len: 'u32',
      type: 'Si0LookupTypeId'
    },
    Si0TypeDefBitSequence: {
      bitStoreType: 'Si0LookupTypeId',
      bitOrderType: 'Si0LookupTypeId'
    },
    Si0TypeDefCompact: {
      type: 'Si0LookupTypeId'
    },
    Si0TypeDefComposite: {
      fields: 'Vec<Si0Field>'
    },
    Si0TypeDefPhantom: 'Null',
    Si0TypeDefVariant: {
      variants: 'Vec<Si0Variant>'
    },
    Si0TypeDefPrimitive: {
      _enum: ['Bool', 'Char', 'Str', 'U8', 'U16', 'U32', 'U64', 'U128', 'U256', 'I8', 'I16', 'I32', 'I64', 'I128', 'I256']
    },
    Si0TypeDefSequence: {
      type: 'Si0LookupTypeId'
    },
    Si0TypeDefTuple: 'Vec<Si0LookupTypeId>',
    Si0TypeParameter: {
      name: 'Text',
      type: 'Option<Si0LookupTypeId>'
    },
    Si0Variant: {
      name: 'Text',
      fields: 'Vec<Si0Field>',
      index: 'Option<u8>',
      discriminant: 'Option<u64>',
      docs: 'Vec<Text>'
    }
  };

  const definitions$12 = {
    rpc: {},
    types: util.objectSpread({}, v0$1, v1$1, {
      SiField: 'Si1Field',
      SiLookupTypeId: 'Si1LookupTypeId',
      SiPath: 'Si1Path',
      SiType: 'Si1Type',
      SiTypeDef: 'Si1TypeDef',
      SiTypeDefArray: 'Si1TypeDefArray',
      SiTypeDefBitSequence: 'Si1TypeDefBitSequence',
      SiTypeDefCompact: 'Si1TypeDefCompact',
      SiTypeDefComposite: 'Si1TypeDefComposite',
      SiTypeDefPrimitive: 'Si1TypeDefPrimitive',
      SiTypeDefSequence: 'Si1TypeDefSequence',
      SiTypeDefTuple: 'Si1TypeDefTuple',
      SiTypeParameter: 'Si1TypeParameter',
      SiTypeDefVariant: 'Si1TypeDefVariant',
      SiVariant: 'Si1Variant'
    })
  };

  const definitions$11 = {
    rpc: {},
    types: {
      AssetApprovalKey: {
        owner: 'AccountId',
        delegate: 'AccountId'
      },
      AssetApproval: {
        amount: 'TAssetBalance',
        deposit: 'TAssetDepositBalance'
      },
      AssetBalance: {
        balance: 'TAssetBalance',
        isFrozen: 'bool',
        isSufficient: 'bool'
      },
      AssetDestroyWitness: {
        accounts: 'Compact<u32>',
        sufficients: 'Compact<u32>',
        approvals: 'Compact<u32>'
      },
      AssetDetails: {
        owner: 'AccountId',
        issuer: 'AccountId',
        admin: 'AccountId',
        freezer: 'AccountId',
        supply: 'TAssetBalance',
        deposit: 'TAssetDepositBalance',
        minBalance: 'TAssetBalance',
        isSufficient: 'bool',
        accounts: 'u32',
        sufficients: 'u32',
        approvals: 'u32',
        isFrozen: 'bool'
      },
      AssetMetadata: {
        deposit: 'TAssetDepositBalance',
        name: 'Vec<u8>',
        symbol: 'Vec<u8>',
        decimals: 'u8',
        isFrozen: 'bool'
      },
      TAssetBalance: 'u64',
      TAssetDepositBalance: 'BalanceOf'
    }
  };

  const definitions$10 = {
    rpc: {},
    types: {
      UncleEntryItem: {
        _enum: {
          InclusionHeight: 'BlockNumber',
          Uncle: '(Hash, Option<AccountId>)'
        }
      }
    }
  };

  const runtime$m = {
    AuraApi: [{
      methods: {
        authorities: {
          description: 'Return the current set of authorities.',
          params: [],
          type: 'Vec<AuthorityId>'
        },
        slot_duration: {
          description: 'Returns the slot duration for Aura.',
          params: [],
          type: 'SlotDuration'
        }
      },
      version: 1
    }]
  };

  const definitions$$ = {
    rpc: {},
    runtime: runtime$m,
    types: {
      RawAuraPreDigest: {
        slotNumber: 'u64'
      }
    }
  };

  const rpc$g = {
    epochAuthorship: {
      description: 'Returns data about which slots (primary or secondary) can be claimed in the current epoch with the keys in the keystore',
      params: [],
      type: 'HashMap<AuthorityId, EpochAuthorship>'
    }
  };

  const V1_V2_SHARED = {
    current_epoch: {
      description: 'Returns information regarding the current epoch.',
      params: [],
      type: 'Epoch'
    },
    current_epoch_start: {
      description: 'Returns the slot that started the current epoch.',
      params: [],
      type: 'Slot'
    },
    generate_key_ownership_proof: {
      description: 'Generates a proof of key ownership for the given authority in the current epoch.',
      params: [{
        name: 'slot',
        type: 'Slot'
      }, {
        name: 'authorityId',
        type: 'AuthorityId'
      }],
      type: 'Option<OpaqueKeyOwnershipProof>'
    },
    next_epoch: {
      description: 'Returns information regarding the next epoch (which was already previously announced).',
      params: [],
      type: 'Epoch'
    },
    submit_report_equivocation_unsigned_extrinsic: {
      description: 'Submits an unsigned extrinsic to report an equivocation.',
      params: [{
        name: 'equivocationProof',
        type: 'BabeEquivocationProof'
      }, {
        name: 'keyOwnerProof',
        type: 'OpaqueKeyOwnershipProof'
      }],
      type: 'Option<Null>'
    }
  };
  const runtime$l = {
    BabeApi: [{
      methods: util.objectSpread({
        configuration: {
          description: 'Return the genesis configuration for BABE. The configuration is only read on genesis.',
          params: [],
          type: 'BabeGenesisConfiguration'
        }
      }, V1_V2_SHARED),
      version: 2
    }, {
      methods: util.objectSpread({
        configuration: {
          description: 'Return the configuration for BABE. Version 1.',
          params: [],
          type: 'BabeGenesisConfigurationV1'
        }
      }, V1_V2_SHARED),
      version: 1
    }]
  };

  const definitions$_ = {
    rpc: rpc$g,
    runtime: runtime$l,
    types: {
      AllowedSlots: {
        _enum: ['PrimarySlots', 'PrimaryAndSecondaryPlainSlots', 'PrimaryAndSecondaryVRFSlots']
      },
      BabeAuthorityWeight: 'u64',
      BabeEpochConfiguration: {
        c: '(u64, u64)',
        allowedSlots: 'AllowedSlots'
      },
      BabeBlockWeight: 'u32',
      BabeEquivocationProof: {
        offender: 'AuthorityId',
        slotNumber: 'SlotNumber',
        firstHeader: 'Header',
        secondHeader: 'Header'
      },
      BabeGenesisConfiguration: {
        slotDuration: 'u64',
        epochLength: 'u64',
        c: '(u64, u64)',
        genesisAuthorities: 'Vec<(AuthorityId, BabeAuthorityWeight)>',
        randomness: 'Randomness',
        allowedSlots: 'AllowedSlots'
      },
      BabeGenesisConfigurationV1: {
        slotDuration: 'u64',
        epochLength: 'u64',
        c: '(u64, u64)',
        genesisAuthorities: 'Vec<(AuthorityId, BabeAuthorityWeight)>',
        randomness: 'Randomness',
        secondarySlots: 'bool'
      },
      BabeWeight: 'u64',
      MaybeRandomness: 'Option<Randomness>',
      MaybeVrf: 'Option<VrfData>',
      Epoch: {
        epochIndex: 'u64',
        startSlot: 'Slot',
        duration: 'u64',
        authorities: 'Vec<(AuthorityId, BabeAuthorityWeight)>',
        randomness: 'Hash',
        config: 'BabeEpochConfiguration'
      },
      EpochAuthorship: {
        primary: 'Vec<u64>',
        secondary: 'Vec<u64>',
        secondary_vrf: 'Vec<u64>'
      },
      NextConfigDescriptor: {
        _enum: {
          V0: 'Null',
          V1: 'NextConfigDescriptorV1'
        }
      },
      NextConfigDescriptorV1: {
        c: '(u64, u64)',
        allowedSlots: 'AllowedSlots'
      },
      OpaqueKeyOwnershipProof: 'Bytes',
      Randomness: 'Hash',
      RawBabePreDigest: {
        _enum: {
          Phantom: 'Null',
          Primary: 'RawBabePreDigestPrimary',
          SecondaryPlain: 'RawBabePreDigestSecondaryPlain',
          SecondaryVRF: 'RawBabePreDigestSecondaryVRF'
        }
      },
      RawBabePreDigestPrimary: {
        authorityIndex: 'u32',
        slotNumber: 'SlotNumber',
        vrfOutput: 'VrfOutput',
        vrfProof: 'VrfProof'
      },
      RawBabePreDigestSecondaryPlain: {
        authorityIndex: 'u32',
        slotNumber: 'SlotNumber'
      },
      RawBabePreDigestSecondaryVRF: {
        authorityIndex: 'u32',
        slotNumber: 'SlotNumber',
        vrfOutput: 'VrfOutput',
        vrfProof: 'VrfProof'
      },
      RawBabePreDigestTo159: {
        _enum: {
          Primary: 'RawBabePreDigestPrimaryTo159',
          Secondary: 'RawBabePreDigestSecondaryTo159'
        }
      },
      RawBabePreDigestPrimaryTo159: {
        authorityIndex: 'u32',
        slotNumber: 'SlotNumber',
        weight: 'BabeBlockWeight',
        vrfOutput: 'VrfOutput',
        vrfProof: 'VrfProof'
      },
      RawBabePreDigestSecondaryTo159: {
        authorityIndex: 'u32',
        slotNumber: 'SlotNumber',
        weight: 'BabeBlockWeight'
      },
      RawBabePreDigestCompat: {
        _enum: {
          Zero: 'u32',
          One: 'u32',
          Two: 'u32',
          Three: 'u32'
        }
      },
      SlotNumber: 'u64',
      VrfData: '[u8; 32]',
      VrfOutput: '[u8; 32]',
      VrfProof: '[u8; 64]'
    }
  };

  const definitions$Z = {
    rpc: {},
    types: {
      AccountData: {
        free: 'Balance',
        reserved: 'Balance',
        miscFrozen: 'Balance',
        feeFrozen: 'Balance'
      },
      BalanceLockTo212: {
        id: 'LockIdentifier',
        amount: 'Balance',
        until: 'BlockNumber',
        reasons: 'WithdrawReasons'
      },
      BalanceLock: {
        id: 'LockIdentifier',
        amount: 'Balance',
        reasons: 'Reasons'
      },
      BalanceStatus: {
        _enum: ['Free', 'Reserved']
      },
      Reasons: {
        _enum: ['Fee', 'Misc', 'All']
      },
      ReserveData: {
        id: 'ReserveIdentifier',
        amount: 'Balance'
      },
      ReserveIdentifier: '[u8; 8]',
      VestingSchedule: {
        offset: 'Balance',
        perBlock: 'Balance',
        startingBlock: 'BlockNumber'
      },
      WithdrawReasons: {
        _set: {
          TransactionPayment: 0b00000001,
          Transfer: 0b00000010,
          Reserve: 0b00000100,
          Fee: 0b00001000,
          Tip: 0b00010000
        }
      }
    }
  };

  const rpc$f = {
    getFinalizedHead: {
      description: 'Returns hash of the latest BEEFY finalized block as seen by this client.',
      params: [],
      type: 'H256'
    },
    subscribeJustifications: {
      description: 'Returns the block most recently finalized by BEEFY, alongside side its justification.',
      params: [],
      pubsub: ['justifications', 'subscribeJustifications', 'unsubscribeJustifications'],
      type: 'BeefySignedCommitment'
    }
  };

  const runtime$k = {
    BeefyApi: [{
      methods: {
        validator_set: {
          description: 'Return the current active BEEFY validator set',
          params: [],
          type: 'Option<ValidatorSet>'
        }
      },
      version: 1
    }],
    BeefyMmrApi: [{
      methods: {
        authority_set_proof: {
          description: 'Return the currently active BEEFY authority set proof.',
          params: [],
          type: 'BeefyAuthoritySet'
        },
        next_authority_set_proof: {
          description: 'Return the next/queued BEEFY authority set proof.',
          params: [],
          type: 'BeefyNextAuthoritySet'
        }
      },
      version: 1
    }]
  };

  const definitions$Y = {
    rpc: rpc$f,
    runtime: runtime$k,
    types: {
      BeefyAuthoritySet: {
        id: 'u64',
        len: 'u32',
        root: 'H256'
      },
      BeefyCommitment: {
        payload: 'BeefyPayload',
        blockNumber: 'BlockNumber',
        validatorSetId: 'ValidatorSetId'
      },
      BeefyId: '[u8; 33]',
      BeefySignedCommitment: {
        commitment: 'BeefyCommitment',
        signatures: 'Vec<Option<EcdsaSignature>>'
      },
      BeefyNextAuthoritySet: {
        id: 'u64',
        len: 'u32',
        root: 'H256'
      },
      BeefyPayload: 'Vec<(BeefyPayloadId, Bytes)>',
      BeefyPayloadId: '[u8;2]',
      MmrRootHash: 'H256',
      ValidatorSetId: 'u64',
      ValidatorSet: {
        validators: 'Vec<AuthorityId>',
        id: 'ValidatorSetId'
      }
    }
  };

  const runtime$j = {
    Benchmark: [{
      methods: {
        benchmark_metadata: {
          description: 'Get the benchmark metadata available for this runtime.',
          params: [{
            name: 'extra',
            type: 'bool'
          }],
          type: '(Vec<BenchmarkList>, Vec<StorageInfo>)'
        },
        dispatch_benchmark: {
          description: 'Dispatch the given benchmark.',
          params: [{
            name: 'config',
            type: 'BenchmarkConfig'
          }],
          type: 'Result<Vec<BenchmarkBatch>, Text>'
        }
      },
      version: 1
    }]
  };

  const definitions$X = {
    rpc: {},
    runtime: runtime$j,
    types: {
      BenchmarkBatch: {
        pallet: 'Text',
        instance: 'Text',
        benchmark: 'Text',
        results: 'Vec<BenchmarkResult>'
      },
      BenchmarkConfig: {
        pallet: 'Bytes',
        benchmark: 'Bytes',
        selectedComponents: 'Vec<(BenchmarkParameter, u32)>',
        verify: 'bool',
        internalRepeats: 'u32'
      },
      BenchmarkList: {
        pallet: 'Bytes',
        instance: 'Bytes',
        benchmarks: 'Vec<BenchmarkMetadata>'
      },
      BenchmarkMetadata: {
        name: 'Bytes',
        components: 'Vec<(BenchmarkParameter, u32, u32)>'
      },
      BenchmarkParameter: {
        _enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
      },
      BenchmarkResult: {
        components: 'Vec<(BenchmarkParameter, u32)>',
        extrinsicTime: 'u128',
        storageRootTime: 'u128',
        reads: 'u32',
        repeatReads: 'u32',
        writes: 'u32',
        repeatWrites: 'u32',
        proofSize: 'u32',
        benchKeys: 'Vec<(Vec<u8>, u32, u32, bool)>'
      }
    }
  };

  const BB_V2_TO_V4 = {
    random_seed: {
      description: 'Generate a random seed.',
      params: [],
      type: 'Hash'
    }
  };
  const BB_V2_TO_V5 = {
    apply_extrinsic: {
      description: 'Apply the given extrinsic.',
      params: [{
        name: 'extrinsic',
        type: 'Extrinsic'
      }],
      type: 'ApplyExtrinsicResultPre6'
    }
  };
  const BB_V2_TO_V6 = {
    check_inherents: {
      description: 'Check that the inherents are valid.',
      params: [{
        name: 'block',
        type: 'Block'
      }, {
        name: 'data',
        type: 'InherentData'
      }],
      type: 'CheckInherentsResult'
    },
    inherent_extrinsics: {
      description: 'Generate inherent extrinsics.',
      params: [{
        name: 'inherent',
        type: 'InherentData'
      }],
      type: 'Vec<Extrinsic>'
    }
  };
  const BB_V3_TO_V6 = {
    finalize_block: {
      description: 'Finish the current block.',
      params: [],
      type: 'Header'
    }
  };
  const runtime$i = {
    BlockBuilder: [{
      methods: util.objectSpread({
        apply_extrinsic: {
          description: 'Apply the given extrinsic.',
          params: [{
            name: 'extrinsic',
            type: 'Extrinsic'
          }],
          type: 'ApplyExtrinsicResult'
        }
      }, BB_V2_TO_V6, BB_V3_TO_V6),
      version: 6
    }, {
      methods: util.objectSpread({
      }, BB_V2_TO_V5, BB_V2_TO_V6, BB_V3_TO_V6),
      version: 5
    }, {
      methods: util.objectSpread({
      }, BB_V2_TO_V4, BB_V2_TO_V5, BB_V2_TO_V6, BB_V3_TO_V6),
      version: 4
    }, {
      methods: util.objectSpread({
      }, BB_V2_TO_V4, BB_V2_TO_V6, BB_V3_TO_V6),
      version: 3
    }, {
      methods: util.objectSpread({
        finalise_block: {
          description: 'Finish the current block.',
          params: [],
          type: 'Header'
        }
      }, BB_V2_TO_V4, BB_V2_TO_V6),
      version: 2
    }]
  };

  const definitions$W = {
    rpc: {},
    runtime: runtime$i,
    types: {
      CheckInherentsResult: {
        okay: 'bool',
        fatalError: 'bool',
        errors: 'InherentData'
      },
      InherentData: {
        data: 'BTreeMap<InherentIdentifier, Bytes>'
      },
      InherentIdentifier: '[u8; 8]'
    }
  };

  const definitions$V = {
    rpc: {},
    types: {
      CollectiveOrigin: {
        _enum: {
          Members: '(MemberCount, MemberCount)',
          Member: 'AccountId'
        }
      },
      MemberCount: 'u32',
      ProposalIndex: 'u32',
      VotesTo230: {
        index: 'ProposalIndex',
        threshold: 'MemberCount',
        ayes: 'Vec<AccountId>',
        nays: 'Vec<AccountId>'
      },
      Votes: {
        index: 'ProposalIndex',
        threshold: 'MemberCount',
        ayes: 'Vec<AccountId>',
        nays: 'Vec<AccountId>',
        end: 'BlockNumber'
      }
    }
  };

  const definitions$U = {
    rpc: {},
    types: {
      AuthorityId: 'AccountId',
      RawVRFOutput: '[u8; 32]'
    }
  };

  const rpc$e = {
    call: {
      description: 'Executes a call to a contract',
      params: [{
        name: 'callRequest',
        type: 'ContractCallRequest'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'ContractExecResult'
    },
    getStorage: {
      description: 'Returns the value under a specified storage key in a contract',
      params: [{
        name: 'address',
        type: 'AccountId'
      }, {
        name: 'key',
        type: 'H256'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Option<Bytes>'
    },
    instantiate: {
      description: 'Instantiate a new contract',
      params: [{
        name: 'request',
        type: 'InstantiateRequest'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'ContractInstantiateResult'
    },
    rentProjection: {
      description: 'Returns the projected time a given contract will be able to sustain paying its rent',
      params: [{
        name: 'address',
        type: 'AccountId'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Option<BlockNumber>'
    },
    uploadCode: {
      description: 'Upload new code without instantiating a contract from it',
      endpoint: 'contracts_upload_code',
      params: [{
        name: 'uploadRequest',
        type: 'CodeUploadRequest'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'CodeUploadResult'
    }
  };

  const runtime$h = {
    ContractsApi: [{
      methods: {
        call: {
          description: 'Perform a call from a specified account to a given contract.',
          params: [{
            name: 'origin',
            type: 'AccountId'
          }, {
            name: 'dest',
            type: 'AccountId'
          }, {
            name: 'value',
            type: 'Balance'
          }, {
            name: 'gasLimit',
            type: 'u64'
          }, {
            name: 'storageDepositLimit',
            type: 'Option<Balance>'
          }, {
            name: 'inputData',
            type: 'Vec<u8>'
          }],
          type: 'ContractExecResult'
        },
        get_storage: {
          description: 'Query a given storage key in a given contract.',
          params: [{
            name: 'address',
            type: 'AccountId'
          }, {
            name: 'key',
            type: 'Bytes'
          }],
          type: 'Option<Bytes>'
        },
        instantiate: {
          description: 'Instantiate a new contract.',
          params: [{
            name: 'origin',
            type: 'AccountId'
          }, {
            name: 'value',
            type: 'Balance'
          }, {
            name: 'gasLimit',
            type: 'u64'
          }, {
            name: 'storageDepositLimit',
            type: 'Option<Balance>'
          }, {
            name: 'code',
            type: 'Bytes'
          }, {
            name: 'data',
            type: 'Bytes'
          }, {
            name: 'salt',
            type: 'Bytes'
          }],
          type: 'ContractInstantiateResult'
        },
        upload_code: {
          description: 'Upload new code without instantiating a contract from it.',
          params: [{
            name: 'origin',
            type: 'AccountId'
          }, {
            name: 'code',
            type: 'Bytes'
          }, {
            name: 'storageDepositLimit',
            type: 'Option<Balance>'
          }],
          type: 'CodeUploadResult'
        }
      },
      version: 1
    }]
  };

  const definitions$T = {
    rpc: rpc$e,
    runtime: runtime$h,
    types: {
      AliveContractInfo: {
        trieId: 'TrieId',
        storageSize: 'u32',
        pairCount: 'u32',
        codeHash: 'CodeHash',
        rentAllowance: 'Balance',
        rentPaid: 'Balance',
        deductBlock: 'BlockNumber',
        lastWrite: 'Option<BlockNumber>',
        _reserved: 'Option<Null>'
      },
      CodeHash: 'Hash',
      CodeSource: {
        _enum: {
          Upload: 'Bytes',
          Existing: 'Hash'
        }
      },
      CodeUploadRequest: {
        origin: 'AccountId',
        code: 'Bytes',
        storageDepositLimit: 'Option<Balance>'
      },
      CodeUploadResult: 'Result<CodeUploadResultValue, DispatchError>',
      CodeUploadResultValue: {
        codeHash: 'CodeHash',
        deposit: 'Balance'
      },
      ContractCallRequest: {
        origin: 'AccountId',
        dest: 'AccountId',
        value: 'Balance',
        gasLimit: 'u64',
        storageDepositLimit: 'Option<Balance>',
        inputData: 'Bytes'
      },
      ContractExecResultSuccessTo255: {
        status: 'u8',
        data: 'Raw'
      },
      ContractExecResultTo255: {
        _enum: {
          Success: 'ContractExecResultSuccessTo255',
          Error: 'Null'
        }
      },
      ContractExecResultSuccessTo260: {
        flags: 'ContractReturnFlags',
        data: 'Bytes',
        gasConsumed: 'u64'
      },
      ContractExecResultTo260: {
        _enum: {
          Success: 'ContractExecResultSuccessTo260',
          Error: 'Null'
        }
      },
      ContractExecResultOk: {
        flags: 'ContractReturnFlags',
        data: 'Bytes'
      },
      ContractExecResultResult: 'Result<ContractExecResultOk, DispatchError>',
      ContractExecResultTo267: {
        gasConsumed: 'u64',
        debugMessage: 'Text',
        result: 'ContractExecResultResult'
      },
      ContractExecResult: {
        gasConsumed: 'u64',
        gasRequired: 'u64',
        storageDeposit: 'StorageDeposit',
        debugMessage: 'Text',
        result: 'ContractExecResultResult'
      },
      ContractInfo: {
        _enum: {
          Alive: 'AliveContractInfo',
          Tombstone: 'TombstoneContractInfo'
        }
      },
      ContractCallFlags: {
        _set: {
          _bitLength: 32,
          ForwardInput: 0b00000001,
          CloneInput: 0b00000010,
          TailCall: 0b00000100,
          AllowReentry: 0b00001000
        }
      },
      ContractReturnFlags: {
        _set: {
          _bitLength: 32,
          Revert: 0x00000001
        }
      },
      ContractStorageKey: '[u8; 32]',
      DeletedContract: {
        pairCount: 'u32',
        trieId: 'TrieId'
      },
      ExecReturnValue: {
        flags: 'ContractReturnFlags',
        data: 'Bytes'
      },
      Gas: 'u64',
      HostFnWeightsTo264: {
        caller: 'Weight',
        address: 'Weight',
        gasLeft: 'Weight',
        balance: 'Weight',
        valueTransferred: 'Weight',
        minimumBalance: 'Weight',
        tombstoneDeposit: 'Weight',
        rentAllowance: 'Weight',
        blockNumber: 'Weight',
        now: 'Weight',
        weightToFee: 'Weight',
        gas: 'Weight',
        input: 'Weight',
        inputPerByte: 'Weight',
        return: 'Weight',
        returnPerByte: 'Weight',
        terminate: 'Weight',
        restoreTo: 'Weight',
        restoreToPerDelta: 'Weight',
        random: 'Weight',
        depositEvent: 'Weight',
        depositEventPerTopic: 'Weight',
        depositEventPerByte: 'Weight',
        setRentAllowance: 'Weight',
        setStorage: 'Weight',
        setStoragePerByte: 'Weight',
        clearStorage: 'Weight',
        getStorage: 'Weight',
        getStoragePerByte: 'Weight',
        transfer: 'Weight',
        call: 'Weight',
        callTransferSurcharge: 'Weight',
        callPerInputByte: 'Weight',
        callPerOutputByte: 'Weight',
        instantiate: 'Weight',
        instantiatePerInputByte: 'Weight',
        instantiatePerOutputByte: 'Weight',
        hashSha2256: 'Weight',
        hashSha2256PerByte: 'Weight',
        hashKeccak256: 'Weight',
        hashKeccak256PerByte: 'Weight',
        hashBlake2256: 'Weight',
        hashBlake2256PerByte: 'Weight',
        hashBlake2128: 'Weight',
        hashBlake2128PerByte: 'Weight'
      },
      HostFnWeights: {
        caller: 'Weight',
        address: 'Weight',
        gasLeft: 'Weight',
        balance: 'Weight',
        valueTransferred: 'Weight',
        minimumBalance: 'Weight',
        tombstoneDeposit: 'Weight',
        rentAllowance: 'Weight',
        blockNumber: 'Weight',
        now: 'Weight',
        weightToFee: 'Weight',
        gas: 'Weight',
        input: 'Weight',
        inputPerByte: 'Weight',
        return: 'Weight',
        returnPerByte: 'Weight',
        terminate: 'Weight',
        terminatePerCodeByte: 'Weight',
        restoreTo: 'Weight',
        restoreToPerCallerCodeByte: 'Weight',
        restoreToPerTombstoneCodeByte: 'Weight',
        restoreToPerDelta: 'Weight',
        random: 'Weight',
        depositEvent: 'Weight',
        depositEventPerTopic: 'Weight',
        depositEventPerByte: 'Weight',
        setRentAllowance: 'Weight',
        setStorage: 'Weight',
        setStoragePerByte: 'Weight',
        clearStorage: 'Weight',
        getStorage: 'Weight',
        getStoragePerByte: 'Weight',
        transfer: 'Weight',
        call: 'Weight',
        callPerCodeByte: 'Weight',
        callTransferSurcharge: 'Weight',
        callPerInputByte: 'Weight',
        callPerOutputByte: 'Weight',
        instantiate: 'Weight',
        instantiatePerCodeByte: 'Weight',
        instantiatePerInputByte: 'Weight',
        instantiatePerOutputByte: 'Weight',
        instantiatePerSaltByte: 'Weight',
        hashSha2256: 'Weight',
        hashSha2256PerByte: 'Weight',
        hashKeccak256: 'Weight',
        hashKeccak256PerByte: 'Weight',
        hashBlake2256: 'Weight',
        hashBlake2256PerByte: 'Weight',
        hashBlake2128: 'Weight',
        hashBlake2128PerByte: 'Weight',
        rentParams: 'Weight'
      },
      InstantiateRequestV1: {
        origin: 'AccountId',
        value: 'Balance',
        gasLimit: 'Gas',
        code: 'Bytes',
        data: 'Bytes',
        salt: 'Bytes'
      },
      InstantiateRequestV2: {
        _fallback: 'InstantiateRequestV1',
        origin: 'AccountId',
        value: 'Balance',
        gasLimit: 'Gas',
        storageDepositLimit: 'Option<Balance>',
        code: 'Bytes',
        data: 'Bytes',
        salt: 'Bytes'
      },
      InstantiateRequest: {
        _fallback: 'InstantiateRequestV2',
        origin: 'AccountId',
        value: 'Balance',
        gasLimit: 'Gas',
        storageDepositLimit: 'Option<Balance>',
        code: 'CodeSource',
        data: 'Bytes',
        salt: 'Bytes'
      },
      ContractInstantiateResultTo267: 'Result<InstantiateReturnValueTo267, Null>',
      ContractInstantiateResultTo299: 'Result<InstantiateReturnValueOk, Null>',
      ContractInstantiateResult: {
        _fallback: 'ContractInstantiateResultTo299',
        gasConsumed: 'u64',
        gasRequired: 'u64',
        storageDeposit: 'StorageDeposit',
        debugMessage: 'Text',
        result: 'InstantiateReturnValue'
      },
      InstantiateReturnValueTo267: {
        result: 'ExecReturnValue',
        accountId: 'AccountId',
        rentProjection: 'Option<RentProjection>'
      },
      InstantiateReturnValueOk: {
        result: 'ExecReturnValue',
        accountId: 'AccountId'
      },
      InstantiateReturnValue: 'Result<InstantiateReturnValueOk, DispatchError>',
      InstructionWeights: {
        i64const: 'u32',
        i64load: 'u32',
        i64store: 'u32',
        select: 'u32',
        rIf: 'u32',
        br: 'u32',
        brIf: 'u32',
        brIable: 'u32',
        brIablePerEntry: 'u32',
        call: 'u32',
        callIndirect: 'u32',
        callIndirectPerParam: 'u32',
        localGet: 'u32',
        localSet: 'u32',
        local_tee: 'u32',
        globalGet: 'u32',
        globalSet: 'u32',
        memoryCurrent: 'u32',
        memoryGrow: 'u32',
        i64clz: 'u32',
        i64ctz: 'u32',
        i64popcnt: 'u32',
        i64eqz: 'u32',
        i64extendsi32: 'u32',
        i64extendui32: 'u32',
        i32wrapi64: 'u32',
        i64eq: 'u32',
        i64ne: 'u32',
        i64lts: 'u32',
        i64ltu: 'u32',
        i64gts: 'u32',
        i64gtu: 'u32',
        i64les: 'u32',
        i64leu: 'u32',
        i64ges: 'u32',
        i64geu: 'u32',
        i64add: 'u32',
        i64sub: 'u32',
        i64mul: 'u32',
        i64divs: 'u32',
        i64divu: 'u32',
        i64rems: 'u32',
        i64remu: 'u32',
        i64and: 'u32',
        i64or: 'u32',
        i64xor: 'u32',
        i64shl: 'u32',
        i64shrs: 'u32',
        i64shru: 'u32',
        i64rotl: 'u32',
        i64rotr: 'u32'
      },
      LimitsTo264: {
        eventTopics: 'u32',
        stackHeight: 'u32',
        globals: 'u32',
        parameters: 'u32',
        memoryPages: 'u32',
        tableSize: 'u32',
        brTableSize: 'u32',
        subjectLen: 'u32',
        codeSize: 'u32'
      },
      Limits: {
        eventTopics: 'u32',
        stackHeight: 'u32',
        globals: 'u32',
        parameters: 'u32',
        memoryPages: 'u32',
        tableSize: 'u32',
        brTableSize: 'u32',
        subjectLen: 'u32'
      },
      PrefabWasmModule: {
        scheduleVersion: 'Compact<u32>',
        initial: 'Compact<u32>',
        maximum: 'Compact<u32>',
        refcount: 'Compact<u64>',
        _reserved: 'Option<Null>',
        code: 'Bytes',
        originalCodeLen: 'u32'
      },
      RentProjection: {
        _enum: {
          EvictionAt: 'BlockNumber',
          NoEviction: 'Null'
        }
      },
      ScheduleTo212: {
        version: 'u32',
        putCodePerByteCost: 'Gas',
        growMemCost: 'Gas',
        regularOpCost: 'Gas',
        returnDataPerByteCost: 'Gas',
        eventDataPerByteCost: 'Gas',
        eventPerTopicCost: 'Gas',
        eventBaseCost: 'Gas',
        sandboxDataReadCost: 'Gas',
        sandboxDataWriteCost: 'Gas',
        maxEventTopics: 'u32',
        maxStackHeight: 'u32',
        maxMemoryPages: 'u32',
        enablePrintln: 'bool',
        maxSubjectLen: 'u32'
      },
      ScheduleTo258: {
        version: 'u32',
        putCodePerByteCost: 'Gas',
        growMemCost: 'Gas',
        regularOpCost: 'Gas',
        returnDataPerByteCost: 'Gas',
        eventDataPerByteCost: 'Gas',
        eventPerTopicCost: 'Gas',
        eventBaseCost: 'Gas',
        sandboxDataReadCost: 'Gas',
        sandboxDataWriteCost: 'Gas',
        transferCost: 'Gas',
        maxEventTopics: 'u32',
        maxStackHeight: 'u32',
        maxMemoryPages: 'u32',
        enablePrintln: 'bool',
        maxSubjectLen: 'u32'
      },
      ScheduleTo264: {
        version: 'u32',
        enablePrintln: 'bool',
        limits: 'LimitsTo264',
        instructionWeights: 'InstructionWeights',
        hostFnWeights: 'HostFnWeightsTo264'
      },
      Schedule: {
        version: 'u32',
        enablePrintln: 'bool',
        limits: 'Limits',
        instructionWeights: 'InstructionWeights',
        hostFnWeights: 'HostFnWeights'
      },
      SeedOf: 'Hash',
      StorageDeposit: {
        _enum: {
          Refund: 'Balance',
          Charge: 'Balance'
        }
      },
      TombstoneContractInfo: 'Hash',
      TrieId: 'Bytes'
    }
  };

  const AllConvictions = [
  'None',
  'Locked1x',
  'Locked2x',
  'Locked3x',
  'Locked4x',
  'Locked5x',
  'Locked6x'];
  const definitions$S = {
    rpc: {},
    types: {
      AccountVote: {
        _enum: {
          Standard: 'AccountVoteStandard',
          Split: 'AccountVoteSplit'
        }
      },
      AccountVoteSplit: {
        aye: 'Balance',
        nay: 'Balance'
      },
      AccountVoteStandard: {
        vote: 'Vote',
        balance: 'Balance'
      },
      Conviction: {
        _enum: AllConvictions
      },
      Delegations: {
        votes: 'Balance',
        capital: 'Balance'
      },
      PreimageStatus: {
        _enum: {
          Missing: 'BlockNumber',
          Available: 'PreimageStatusAvailable'
        }
      },
      PreimageStatusAvailable: {
        data: 'Bytes',
        provider: 'AccountId',
        deposit: 'Balance',
        since: 'BlockNumber',
        expiry: 'Option<BlockNumber>'
      },
      PriorLock: '(BlockNumber, Balance)',
      PropIndex: 'u32',
      Proposal: 'Call',
      ProxyState: {
        _enum: {
          Open: 'AccountId',
          Active: 'AccountId'
        }
      },
      ReferendumIndex: 'u32',
      ReferendumInfoTo239: {
        end: 'BlockNumber',
        proposalHash: 'Hash',
        threshold: 'VoteThreshold',
        delay: 'BlockNumber'
      },
      ReferendumInfo: {
        _enum: {
          Ongoing: 'ReferendumStatus',
          Finished: 'ReferendumInfoFinished'
        }
      },
      ReferendumInfoFinished: {
        approved: 'bool',
        end: 'BlockNumber'
      },
      ReferendumStatus: {
        end: 'BlockNumber',
        proposalHash: 'Hash',
        threshold: 'VoteThreshold',
        delay: 'BlockNumber',
        tally: 'Tally'
      },
      Tally: {
        ayes: 'Balance',
        nays: 'Balance',
        turnout: 'Balance'
      },
      Voting: {
        _enum: {
          Direct: 'VotingDirect',
          Delegating: 'VotingDelegating'
        }
      },
      VotingDirect: {
        votes: 'Vec<VotingDirectVote>',
        delegations: 'Delegations',
        prior: 'PriorLock'
      },
      VotingDirectVote: '(ReferendumIndex, AccountVote)',
      VotingDelegating: {
        balance: 'Balance',
        target: 'AccountId',
        conviction: 'Conviction',
        delegations: 'Delegations',
        prior: 'PriorLock'
      }
    }
  };

  const rpc$d = {
    getBlockStats: {
      description: 'Reexecute the specified `block_hash` and gather statistics while doing so',
      params: [{
        isHistoric: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Option<BlockStats>'
    }
  };

  const definitions$R = {
    rpc: rpc$d,
    types: {
      BlockStats: {
        witnessLen: 'u64',
        witnessCompactLen: 'u64',
        blockLen: 'u64',
        blockNumExtrinsics: 'u64'
      }
    }
  };

  const runtime$g = {
    AuthorityDiscoveryApi: [{
      methods: {
        authorities: {
          description: 'Retrieve authority identifiers of the current and next authority set.',
          params: [],
          type: 'Vec<AuthorityId>'
        }
      },
      version: 1
    }]
  };

  const definitions$Q = {
    rpc: {},
    runtime: runtime$g,
    types: {}
  };

  const definitions$P = {
    rpc: {},
    types: {
      ApprovalFlag: 'u32',
      DefunctVoter: {
        who: 'AccountId',
        voteCount: 'Compact<u32>',
        candidateCount: 'Compact<u32>'
      },
      Renouncing: {
        _enum: {
          Member: 'Null',
          RunnerUp: 'Null',
          Candidate: 'Compact<u32>'
        }
      },
      SetIndex: 'u32',
      Vote: 'GenericVote',
      VoteIndex: 'u32',
      VoterInfo: {
        lastActive: 'VoteIndex',
        lastWin: 'VoteIndex',
        pot: 'Balance',
        stake: 'Balance'
      },
      VoteThreshold: {
        _enum: ['Super Majority Approve', 'Super Majority Against', 'Simple Majority']
      }
    }
  };

  const rpc$c = {
    createBlock: {
      description: 'Instructs the manual-seal authorship task to create a new block',
      params: [{
        name: 'createEmpty',
        type: 'bool'
      }, {
        name: 'finalize',
        type: 'bool'
      }, {
        isOptional: true,
        name: 'parentHash',
        type: 'BlockHash'
      }],
      type: 'CreatedBlock'
    },
    finalizeBlock: {
      description: 'Instructs the manual-seal authorship task to finalize a block',
      params: [{
        name: 'hash',
        type: 'BlockHash'
      }, {
        isOptional: true,
        name: 'justification',
        type: 'Justification'
      }],
      type: 'bool'
    }
  };

  const definitions$O = {
    rpc: rpc$c,
    types: {
      CreatedBlock: {
        _alias: {
          blockHash: 'hash'
        },
        blockHash: 'BlockHash',
        aux: 'ImportedAux'
      },
      ImportedAux: {
        headerOnly: 'bool',
        clearJustificationRequests: 'bool',
        needsJustification: 'bool',
        badJustification: 'bool',
        needsFinalityProof: 'bool',
        isNewBest: 'bool'
      }
    }
  };

  const definitions$N = {
    rpc: {},
    types: {
      EvmAccount: {
        nonce: 'u256',
        balance: 'u256'
      },
      EvmCallInfo: {
        exitReason: 'ExitReason',
        value: 'Bytes',
        usedGas: 'U256',
        logs: 'Vec<EvmLog>'
      },
      EvmCreateInfo: {
        exitReason: 'ExitReason',
        value: 'H160',
        usedGas: 'U256',
        logs: 'Vec<EvmLog>'
      },
      EvmLog: {
        address: 'H160',
        topics: 'Vec<H256>',
        data: 'Bytes'
      },
      EvmVicinity: {
        gasPrice: 'u256',
        origin: 'H160'
      },
      ExitError: {
        _enum: {
          StackUnderflow: 'Null',
          StackOverflow: 'Null',
          InvalidJump: 'Null',
          InvalidRange: 'Null',
          DesignatedInvalid: 'Null',
          CallTooDeep: 'Null',
          CreateCollision: 'Null',
          CreateContractLimit: 'Null',
          OutOfOffset: 'Null',
          OutOfGas: 'Null',
          OutOfFund: 'Null',
          PCUnderflow: 'Null',
          CreateEmpty: 'Null',
          Other: 'Text'
        }
      },
      ExitFatal: {
        _enum: {
          NotSupported: 'Null',
          UnhandledInterrupt: 'Null',
          CallErrorAsFatal: 'ExitError',
          Other: 'Text'
        }
      },
      ExitReason: {
        _enum: {
          Succeed: 'ExitSucceed',
          Error: 'ExitError',
          Revert: 'ExitRevert',
          Fatal: 'ExitFatal'
        }
      },
      ExitRevert: {
        _enum: ['Reverted']
      },
      ExitSucceed: {
        _enum: ['Stopped', 'Returned', 'Suicided']
      }
    }
  };

  const definitions$M = {
    rpc: {},
    types: {
      Extrinsic: 'GenericExtrinsic',
      ExtrinsicEra: 'GenericExtrinsicEra',
      ExtrinsicPayload: 'GenericExtrinsicPayload',
      ExtrinsicSignature: 'MultiSignature',
      ExtrinsicV4: 'GenericExtrinsicV4',
      ExtrinsicPayloadV4: 'GenericExtrinsicPayloadV4',
      ExtrinsicSignatureV4: 'GenericExtrinsicSignatureV4',
      ExtrinsicUnknown: 'GenericExtrinsicUnknown',
      ExtrinsicPayloadUnknown: 'GenericExtrinsicPayloadUnknown',
      Era: 'ExtrinsicEra',
      ImmortalEra: 'GenericImmortalEra',
      MortalEra: 'GenericMortalEra',
      AnySignature: 'H512',
      MultiSignature: {
        _enum: {
          Ed25519: 'Ed25519Signature',
          Sr25519: 'Sr25519Signature',
          Ecdsa: 'EcdsaSignature'
        }
      },
      Signature: 'H512',
      SignerPayload: 'GenericSignerPayload',
      EcdsaSignature: '[u8; 65]',
      Ed25519Signature: 'H512',
      Sr25519Signature: 'H512'
    }
  };

  const definitions$L = {
    rpc: {},
    types: {
      AssetOptions: {
        initalIssuance: 'Compact<Balance>',
        permissions: 'PermissionLatest'
      },
      Owner: {
        _enum: {
          None: 'Null',
          Address: 'AccountId'
        }
      },
      PermissionsV1: {
        update: 'Owner',
        mint: 'Owner',
        burn: 'Owner'
      },
      PermissionVersions: {
        _enum: {
          V1: 'PermissionsV1'
        }
      },
      PermissionLatest: 'PermissionsV1'
    }
  };

  const definitions$K = {
    rpc: {},
    types: {
      ActiveGilt: {
        proportion: 'Perquintill',
        amount: 'Balance',
        who: 'AccountId',
        expiry: 'BlockNumber'
      },
      ActiveGiltsTotal: {
        frozen: 'Balance',
        proportion: 'Perquintill',
        index: 'ActiveIndex',
        target: 'Perquintill'
      },
      ActiveIndex: 'u32',
      GiltBid: {
        amount: 'Balance',
        who: 'AccountId'
      }
    }
  };

  const rpc$b = {
    proveFinality: {
      description: 'Prove finality for the given block number, returning the Justification for the last block in the set.',
      params: [{
        name: 'blockNumber',
        type: 'BlockNumber'
      }],
      type: 'Option<EncodedFinalityProofs>'
    },
    roundState: {
      description: 'Returns the state of the current best round state as well as the ongoing background rounds',
      params: [],
      type: 'ReportedRoundStates'
    },
    subscribeJustifications: {
      description: 'Subscribes to grandpa justifications',
      params: [],
      pubsub: ['justifications', 'subscribeJustifications', 'unsubscribeJustifications'],
      type: 'JustificationNotification'
    }
  };

  const GRANDPA_V2_V3 = {
    generate_key_ownership_proof: {
      description: 'Generates a proof of key ownership for the given authority in the given set.',
      params: [{
        name: 'setId',
        type: 'SetId'
      }, {
        name: 'authorityId',
        type: 'AuthorityId'
      }],
      type: 'Option<OpaqueKeyOwnershipProof>'
    },
    grandpa_authorities: {
      description: 'Get the current GRANDPA authorities and weights. This should not change except for when changes are scheduled and the corresponding delay has passed.',
      params: [],
      type: 'AuthorityList'
    },
    submit_report_equivocation_unsigned_extrinsic: {
      description: 'Submits an unsigned extrinsic to report an equivocation.',
      params: [{
        name: 'equivocationProof',
        type: 'GrandpaEquivocationProof'
      }, {
        name: 'keyOwnerProof',
        type: 'OpaqueKeyOwnershipProof'
      }],
      type: 'Option<Null>'
    }
  };
  const runtime$f = {
    GrandpaApi: [{
      methods: util.objectSpread({
        current_set_id: {
          description: 'Get current GRANDPA authority set id.',
          params: [],
          type: 'SetId'
        }
      }, GRANDPA_V2_V3),
      version: 3
    }, {
      methods: GRANDPA_V2_V3,
      version: 2
    }]
  };

  const definitions$J = {
    rpc: rpc$b,
    runtime: runtime$f,
    types: {
      AuthorityIndex: 'u64',
      AuthorityList: 'Vec<NextAuthority>',
      AuthoritySet: {
        currentAuthorities: 'AuthorityList',
        setId: 'u64',
        pendingStandardChanges: 'ForkTreePendingChange',
        pendingForcedChanges: 'Vec<PendingChange>',
        authoritySetChanges: 'AuthoritySetChanges'
      },
      ForkTreePendingChange: {
        roots: 'Vec<ForkTreePendingChangeNode>',
        bestFinalizedNumber: 'Option<BlockNumber>'
      },
      ForkTreePendingChangeNode: {
        hash: 'BlockHash',
        number: 'BlockNumber',
        data: 'PendingChange',
        children: 'Vec<ForkTreePendingChangeNode>'
      },
      AuthoritySetChange: '(U64, BlockNumber)',
      AuthoritySetChanges: 'Vec<AuthoritySetChange>',
      AuthorityWeight: 'u64',
      DelayKind: {
        _enum: {
          Finalized: 'Null',
          Best: 'DelayKindBest'
        }
      },
      DelayKindBest: {
        medianLastFinalized: 'BlockNumber'
      },
      EncodedFinalityProofs: 'Bytes',
      GrandpaEquivocation: {
        _enum: {
          Prevote: 'GrandpaEquivocationValue',
          Precommit: 'GrandpaEquivocationValue'
        }
      },
      GrandpaEquivocationProof: {
        setId: 'SetId',
        equivocation: 'GrandpaEquivocation'
      },
      GrandpaEquivocationValue: {
        roundNumber: 'u64',
        identity: 'AuthorityId',
        first: '(GrandpaPrevote, AuthoritySignature)',
        second: '(GrandpaPrevote, AuthoritySignature)'
      },
      GrandpaPrevote: {
        targetHash: 'Hash',
        targetNumber: 'BlockNumber'
      },
      GrandpaCommit: {
        targetHash: 'BlockHash',
        targetNumber: 'BlockNumber',
        precommits: 'Vec<GrandpaSignedPrecommit>'
      },
      GrandpaPrecommit: {
        targetHash: 'BlockHash',
        targetNumber: 'BlockNumber'
      },
      GrandpaSignedPrecommit: {
        precommit: 'GrandpaPrecommit',
        signature: 'AuthoritySignature',
        id: 'AuthorityId'
      },
      GrandpaJustification: {
        round: 'u64',
        commit: 'GrandpaCommit',
        votesAncestries: 'Vec<Header>'
      },
      JustificationNotification: 'Bytes',
      KeyOwnerProof: 'MembershipProof',
      NextAuthority: '(AuthorityId, AuthorityWeight)',
      PendingChange: {
        nextAuthorities: 'AuthorityList',
        delay: 'BlockNumber',
        canonHeight: 'BlockNumber',
        canonHash: 'BlockHash',
        delayKind: 'DelayKind'
      },
      PendingPause: {
        scheduledAt: 'BlockNumber',
        delay: 'BlockNumber'
      },
      PendingResume: {
        scheduledAt: 'BlockNumber',
        delay: 'BlockNumber'
      },
      Precommits: {
        currentWeight: 'u32',
        missing: 'BTreeSet<AuthorityId>'
      },
      Prevotes: {
        currentWeight: 'u32',
        missing: 'BTreeSet<AuthorityId>'
      },
      ReportedRoundStates: {
        setId: 'u32',
        best: 'RoundState',
        background: 'Vec<RoundState>'
      },
      RoundState: {
        round: 'u32',
        totalWeight: 'u32',
        thresholdWeight: 'u32',
        prevotes: 'Prevotes',
        precommits: 'Precommits'
      },
      SetId: 'u64',
      StoredPendingChange: {
        scheduledAt: 'BlockNumber',
        delay: 'BlockNumber',
        nextAuthorities: 'AuthorityList'
      },
      StoredState: {
        _enum: {
          Live: 'Null',
          PendingPause: 'PendingPause',
          Paused: 'Null',
          PendingResume: 'PendingResume'
        }
      }
    }
  };

  const definitions$I = {
    rpc: {},
    types: {
      IdentityFields: {
        _set: {
          _bitLength: 64,
          Display: 0b00000000000000000000000000000001,
          Legal: 0b00000000000000000000000000000010,
          Web: 0b00000000000000000000000000000100,
          Riot: 0b00000000000000000000000000001000,
          Email: 0b00000000000000000000000000010000,
          PgpFingerprint: 0b00000000000000000000000000100000,
          Image: 0b00000000000000000000000001000000,
          Twitter: 0b00000000000000000000000010000000
        }
      },
      IdentityInfoAdditional: '(Data, Data)',
      IdentityInfoTo198: {
        additional: 'Vec<IdentityInfoAdditional>',
        display: 'Data',
        legal: 'Data',
        web: 'Data',
        riot: 'Data',
        email: 'Data',
        pgpFingerprint: 'Option<H160>',
        image: 'Data'
      },
      IdentityInfo: {
        _fallback: 'IdentityInfoTo198',
        additional: 'Vec<IdentityInfoAdditional>',
        display: 'Data',
        legal: 'Data',
        web: 'Data',
        riot: 'Data',
        email: 'Data',
        pgpFingerprint: 'Option<H160>',
        image: 'Data',
        twitter: 'Data'
      },
      IdentityJudgement: {
        _enum: {
          Unknown: 'Null',
          FeePaid: 'Balance',
          Reasonable: 'Null',
          KnownGood: 'Null',
          OutOfDate: 'Null',
          LowQuality: 'Null',
          Erroneous: 'Null'
        }
      },
      RegistrationJudgement: '(RegistrarIndex, IdentityJudgement)',
      RegistrationTo198: {
        judgements: 'Vec<RegistrationJudgement>',
        deposit: 'Balance',
        info: 'IdentityInfoTo198'
      },
      Registration: {
        _fallback: 'RegistrationTo198',
        judgements: 'Vec<RegistrationJudgement>',
        deposit: 'Balance',
        info: 'IdentityInfo'
      },
      RegistrarIndex: 'u32',
      RegistrarInfo: {
        account: 'AccountId',
        fee: 'Balance',
        fields: 'IdentityFields'
      }
    }
  };

  const definitions$H = {
    rpc: {},
    types: {
      AuthIndex: 'u32',
      AuthoritySignature: 'Signature',
      Heartbeat: {
        blockNumber: 'BlockNumber',
        networkState: 'OpaqueNetworkState',
        sessionIndex: 'SessionIndex',
        authorityIndex: 'AuthIndex',
        validatorsLen: 'u32'
      },
      HeartbeatTo244: {
        blockNumber: 'BlockNumber',
        networkState: 'OpaqueNetworkState',
        sessionIndex: 'SessionIndex',
        authorityIndex: 'AuthIndex'
      },
      OpaqueMultiaddr: 'Opaque<Bytes>',
      OpaquePeerId: 'Opaque<Bytes>',
      OpaqueNetworkState: {
        peerId: 'OpaquePeerId',
        externalAddresses: 'Vec<OpaqueMultiaddr>'
      }
    }
  };

  const definitions$G = {
    rpc: {},
    types: {
      CallIndex: '(u8, u8)',
      LotteryConfig: {
        price: 'Balance',
        start: 'BlockNumber',
        length: 'BlockNumber',
        delay: 'BlockNumber',
        repeat: 'bool'
      }
    }
  };

  const rpc$a = {
    generateBatchProof: {
      description: 'Generate MMR proof for the given leaf indices.',
      params: [{
        name: 'leafIndices',
        type: 'Vec<u64>'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'MmrLeafProof'
    },
    generateProof: {
      description: 'Generate MMR proof for given leaf index.',
      params: [{
        name: 'leafIndex',
        type: 'u64'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'MmrLeafBatchProof'
    }
  };

  const runtime$e = {
    MmrApi: [{
      methods: {
        generate_batch_proof: {
          description: 'Generate MMR proof for a series of leaves under given indices.',
          params: [{
            name: 'leafIndices',
            type: 'Vec<MmrLeafIndex>'
          }],
          type: 'Result<(Vec<MmrEncodableOpaqueLeaf>, MmrBatchProof), MmrError>'
        },
        generate_proof: {
          description: 'Generate MMR proof for a leaf under given index.',
          params: [{
            name: 'leafIndex',
            type: 'MmrLeafIndex'
          }],
          type: 'Result<(MmrEncodableOpaqueLeaf, MmrProof), MmrError>'
        },
        mmr_root: {
          description: 'Return the on-chain MMR root hash.',
          params: [],
          type: 'Result<Hash, MmrError>'
        },
        verify_batch_proof: {
          description: 'Verify MMR proof against on-chain MMR for a batch of leaves.',
          params: [{
            name: 'leaves',
            type: 'Vec<MmrEncodableOpaqueLeaf>'
          }, {
            name: 'proof',
            type: 'MmrBatchProof'
          }],
          type: 'Result<(), MmrError>'
        },
        verify_batch_proof_stateless: {
          description: 'Verify MMR proof against given root hash or a batch of leaves.',
          params: [{
            name: 'root',
            type: 'Hash'
          }, {
            name: 'leaves',
            type: 'Vec<MmrEncodableOpaqueLeaf>'
          }, {
            name: 'proof',
            type: 'MmrBatchProof'
          }],
          type: 'Result<(), MmrError>'
        },
        verify_proof: {
          description: 'Verify MMR proof against on-chain MMR.',
          params: [{
            name: 'leaf',
            type: 'MmrEncodableOpaqueLeaf'
          }, {
            name: 'proof',
            type: 'MmrProof'
          }],
          type: 'Result<(), MmrError>'
        },
        verify_proof_stateless: {
          description: 'Verify MMR proof against given root hash.',
          params: [{
            name: 'root',
            type: 'Hash'
          }, {
            name: 'leaf',
            type: 'MmrEncodableOpaqueLeaf'
          }, {
            name: 'proof',
            type: 'MmrProof'
          }],
          type: 'Result<(), MmrError>'
        }
      },
      version: 1
    }]
  };

  const definitions$F = {
    rpc: rpc$a,
    runtime: runtime$e,
    types: {
      MmrBatchProof: {
        leafIndices: 'Vec<MmrLeafIndex>',
        leafCount: 'MmrNodeIndex',
        items: 'Vec<Hash>'
      },
      MmrEncodableOpaqueLeaf: 'Bytes',
      MmrError: {
        _enum: ['Push', 'GetRoot', 'Commit', 'GenerateProof', 'Verify', 'LeafNotFound', ' PalletNotIncluded', 'InvalidLeafIndex']
      },
      MmrLeafBatchProof: {
        blockHash: 'BlockHash',
        leaves: 'Bytes',
        proof: 'Bytes'
      },
      MmrLeafIndex: 'u64',
      MmrLeafProof: {
        blockHash: 'BlockHash',
        leaf: 'Bytes',
        proof: 'Bytes'
      },
      MmrNodeIndex: 'u64',
      MmrProof: {
        leafIndex: 'MmrLeafIndex',
        leafCount: 'MmrNodeIndex',
        items: 'Vec<Hash>'
      }
    }
  };

  const runtime$d = {
    NominationPoolsApi: [{
      methods: {
        pending_rewards: {
          description: 'Returns the pending rewards for the given member.',
          params: [{
            name: 'member',
            type: 'AccountId'
          }],
          type: 'Balance'
        }
      },
      version: 1
    }]
  };

  const definitions$E = {
    rpc: {},
    runtime: runtime$d,
    types: {
      NpApiError: {
        _enum: ['MemberNotFound', 'OverflowInPendingRewards']
      }
    }
  };

  const definitions$D = {
    rpc: {},
    types: {
      DeferredOffenceOf: '(Vec<OffenceDetails>, Vec<Perbill>, SessionIndex)',
      Kind: '[u8; 16]',
      OffenceDetails: {
        offender: 'Offender',
        reporters: 'Vec<Reporter>'
      },
      Offender: 'IdentificationTuple',
      OpaqueTimeSlot: 'Bytes',
      ReportIdOf: 'Hash',
      Reporter: 'AccountId'
    }
  };

  const runtime$c = {
    DifficultyApi: [{
      methods: {
        difficulty: {
          description: 'Return the target difficulty of the next block.',
          params: [],
          type: 'Raw'
        }
      },
      version: 1
    }],
    TimestampApi: [{
      methods: {
        timestamp: {
          description: 'API necessary for timestamp-based difficulty adjustment algorithms.',
          params: [],
          type: 'Moment'
        }
      },
      version: 1
    }]
  };

  const definitions$C = {
    rpc: {},
    runtime: runtime$c,
    types: {}
  };

  const definitions$B = {
    rpc: {},
    types: {
      ProxyDefinition: {
        delegate: 'AccountId',
        proxyType: 'ProxyType',
        delay: 'BlockNumber'
      },
      ProxyType: {
        _enum: ['Any', 'NonTransfer', 'Governance', 'Staking']
      },
      ProxyAnnouncement: {
        real: 'AccountId',
        callHash: 'Hash',
        height: 'BlockNumber'
      }
    }
  };

  const definitions$A = {
    rpc: {},
    types: {
      ActiveRecovery: {
        created: 'BlockNumber',
        deposit: 'Balance',
        friends: 'Vec<AccountId>'
      },
      RecoveryConfig: {
        delayPeriod: 'BlockNumber',
        deposit: 'Balance',
        friends: 'Vec<AccountId>',
        threshold: 'u16'
      }
    }
  };

  const definitions$z = {
    rpc: {},
    types: {
      Period: '(BlockNumber, u32)',
      Priority: 'u8',
      SchedulePeriod: 'Period',
      SchedulePriority: 'Priority',
      Scheduled: {
        maybeId: 'Option<Bytes>',
        priority: 'SchedulePriority',
        call: 'Call',
        maybePeriodic: 'Option<SchedulePeriod>',
        origin: 'PalletsOrigin'
      },
      ScheduledTo254: {
        maybeId: 'Option<Bytes>',
        priority: 'SchedulePriority',
        call: 'Call',
        maybePeriodic: 'Option<SchedulePeriod>'
      },
      TaskAddress: '(BlockNumber, u32)'
    }
  };

  const runtime$b = {
    SessionKeys: [{
      methods: {
        decode_session_keys: {
          description: 'Decode the given public session keys.',
          params: [{
            name: 'encoded',
            type: 'Bytes'
          }],
          type: 'Option<Vec<(Bytes, KeyTypeId)>>'
        },
        generate_session_keys: {
          description: 'Generate a set of session keys with optionally using the given seed.',
          params: [{
            name: 'seed',
            type: 'Option<Bytes>'
          }],
          type: 'Bytes'
        }
      },
      version: 1
    }]
  };

  const keyTypes = {
    BeefyKey: '[u8; 33]',
    Keys: 'SessionKeys4',
    SessionKeys1: '(AccountId)',
    SessionKeys2: '(AccountId, AccountId)',
    SessionKeys3: '(AccountId, AccountId, AccountId)',
    SessionKeys4: '(AccountId, AccountId, AccountId, AccountId)',
    SessionKeys5: '(AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys6: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys6B: '(AccountId, AccountId, AccountId, AccountId, AccountId, BeefyKey)',
    SessionKeys7: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys7B: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, BeefyKey)',
    SessionKeys8: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys8B: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, BeefyKey)',
    SessionKeys9: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys9B: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, BeefyKey)',
    SessionKeys10: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId)',
    SessionKeys10B: '(AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, AccountId, BeefyKey)'
  };
  const definitions$y = {
    rpc: {},
    runtime: runtime$b,
    types: util.objectSpread({}, keyTypes, {
      FullIdentification: 'Exposure',
      IdentificationTuple: '(ValidatorId, FullIdentification)',
      MembershipProof: {
        session: 'SessionIndex',
        trieNodes: 'Vec<Bytes>',
        validatorCount: 'ValidatorCount'
      },
      SessionIndex: 'u32',
      ValidatorCount: 'u32'
    })
  };

  const definitions$x = {
    rpc: {},
    types: {
      Bid: {
        who: 'AccountId',
        kind: 'BidKind',
        value: 'Balance'
      },
      BidKind: {
        _enum: {
          Deposit: 'Balance',
          Vouch: '(AccountId, Balance)'
        }
      },
      SocietyJudgement: {
        _enum: ['Rebid', 'Reject', 'Approve']
      },
      SocietyVote: {
        _enum: ['Skeptic', 'Reject', 'Approve']
      },
      StrikeCount: 'u32',
      VouchingStatus: {
        _enum: ['Vouching', 'Banned']
      }
    }
  };

  const deprecated = {
    Points: 'u32',
    EraPoints: {
      total: 'Points',
      individual: 'Vec<Points>'
    }
  };
  const phragmen = {
    CompactAssignments: 'CompactAssignmentsWith16',
    CompactAssignmentsWith16: {
      votes1: 'Vec<(NominatorIndexCompact, ValidatorIndexCompact)>',
      votes2: 'Vec<(NominatorIndexCompact, CompactScoreCompact, ValidatorIndexCompact)>',
      votes3: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 2], ValidatorIndexCompact)>',
      votes4: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 3], ValidatorIndexCompact)>',
      votes5: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 4], ValidatorIndexCompact)>',
      votes6: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 5], ValidatorIndexCompact)>',
      votes7: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 6], ValidatorIndexCompact)>',
      votes8: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 7], ValidatorIndexCompact)>',
      votes9: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 8], ValidatorIndexCompact)>',
      votes10: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 9], ValidatorIndexCompact)>',
      votes11: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 10], ValidatorIndexCompact)>',
      votes12: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 11], ValidatorIndexCompact)>',
      votes13: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 12], ValidatorIndexCompact)>',
      votes14: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 13], ValidatorIndexCompact)>',
      votes15: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 14], ValidatorIndexCompact)>',
      votes16: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 15], ValidatorIndexCompact)>'
    },
    CompactAssignmentsWith24: {
      votes1: 'Vec<(NominatorIndexCompact, ValidatorIndexCompact)>',
      votes2: 'Vec<(NominatorIndexCompact, CompactScoreCompact, ValidatorIndexCompact)>',
      votes3: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 2], ValidatorIndexCompact)>',
      votes4: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 3], ValidatorIndexCompact)>',
      votes5: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 4], ValidatorIndexCompact)>',
      votes6: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 5], ValidatorIndexCompact)>',
      votes7: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 6], ValidatorIndexCompact)>',
      votes8: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 7], ValidatorIndexCompact)>',
      votes9: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 8], ValidatorIndexCompact)>',
      votes10: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 9], ValidatorIndexCompact)>',
      votes11: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 10], ValidatorIndexCompact)>',
      votes12: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 11], ValidatorIndexCompact)>',
      votes13: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 12], ValidatorIndexCompact)>',
      votes14: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 13], ValidatorIndexCompact)>',
      votes15: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 14], ValidatorIndexCompact)>',
      votes16: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 15], ValidatorIndexCompact)>',
      votes17: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 16], ValidatorIndexCompact)>',
      votes18: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 17], ValidatorIndexCompact)>',
      votes19: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 18], ValidatorIndexCompact)>',
      votes20: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 19], ValidatorIndexCompact)>',
      votes21: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 20], ValidatorIndexCompact)>',
      votes22: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 21], ValidatorIndexCompact)>',
      votes23: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 22], ValidatorIndexCompact)>',
      votes24: 'Vec<(NominatorIndexCompact, [CompactScoreCompact; 23], ValidatorIndexCompact)>'
    },
    CompactAssignmentsTo265: 'CompactAssignmentsWith16',
    CompactAssignmentsTo257: {
      votes1: 'Vec<(NominatorIndex, [CompactScore; 0], ValidatorIndex)>',
      votes2: 'Vec<(NominatorIndex, [CompactScore; 1], ValidatorIndex)>',
      votes3: 'Vec<(NominatorIndex, [CompactScore; 2], ValidatorIndex)>',
      votes4: 'Vec<(NominatorIndex, [CompactScore; 3], ValidatorIndex)>',
      votes5: 'Vec<(NominatorIndex, [CompactScore; 4], ValidatorIndex)>',
      votes6: 'Vec<(NominatorIndex, [CompactScore; 5], ValidatorIndex)>',
      votes7: 'Vec<(NominatorIndex, [CompactScore; 6], ValidatorIndex)>',
      votes8: 'Vec<(NominatorIndex, [CompactScore; 7], ValidatorIndex)>',
      votes9: 'Vec<(NominatorIndex, [CompactScore; 8], ValidatorIndex)>',
      votes10: 'Vec<(NominatorIndex, [CompactScore; 9], ValidatorIndex)>',
      votes11: 'Vec<(NominatorIndex, [CompactScore; 10], ValidatorIndex)>',
      votes12: 'Vec<(NominatorIndex, [CompactScore; 11], ValidatorIndex)>',
      votes13: 'Vec<(NominatorIndex, [CompactScore; 12], ValidatorIndex)>',
      votes14: 'Vec<(NominatorIndex, [CompactScore; 13], ValidatorIndex)>',
      votes15: 'Vec<(NominatorIndex, [CompactScore; 14], ValidatorIndex)>',
      votes16: 'Vec<(NominatorIndex, [CompactScore; 15], ValidatorIndex)>'
    },
    CompactScore: '(ValidatorIndex, OffchainAccuracy)',
    CompactScoreCompact: '(ValidatorIndexCompact, OffchainAccuracyCompact)',
    ElectionCompute: {
      _enum: ['OnChain', 'Signed', 'Unsigned']
    },
    ElectionPhase: {
      _enum: {
        Off: null,
        Signed: null,
        Unsigned: '(bool, BlockNumber)',
        Emergency: null
      }
    },
    ElectionResult: {
      compute: 'ElectionCompute',
      slotStake: 'Balance',
      electedStashes: 'Vec<AccountId>',
      exposures: 'Vec<(AccountId, Exposure)>'
    },
    ElectionScore: '[u128; 3]',
    ElectionSize: {
      validators: 'Compact<ValidatorIndex>',
      nominators: 'Compact<NominatorIndex>'
    },
    ElectionStatus: {
      _enum: {
        Close: 'Null',
        Open: 'BlockNumber'
      }
    },
    ExtendedBalance: 'u128',
    RawSolution: 'RawSolutionWith16',
    RawSolutionWith16: {
      compact: 'CompactAssignmentsWith16',
      score: 'ElectionScore',
      round: 'u32'
    },
    RawSolutionWith24: {
      compact: 'CompactAssignmentsWith24',
      score: 'ElectionScore',
      round: 'u32'
    },
    RawSolutionTo265: 'RawSolutionWith16',
    ReadySolution: {
      supports: 'SolutionSupports',
      score: 'ElectionScore',
      compute: 'ElectionCompute'
    },
    RoundSnapshot: {
      voters: 'Vec<(AccountId, VoteWeight, Vec<AccountId>)>',
      targets: 'Vec<AccountId>'
    },
    SeatHolder: {
      who: 'AccountId',
      stake: 'Balance',
      deposit: 'Balance'
    },
    SignedSubmission: {
      _fallback: 'SignedSubmissionTo276',
      who: 'AccountId',
      deposit: 'Balance',
      solution: 'RawSolution',
      reward: 'Balance'
    },
    SignedSubmissionTo276: {
      who: 'AccountId',
      deposit: 'Balance',
      solution: 'RawSolution'
    },
    SignedSubmissionOf: 'SignedSubmission',
    SolutionOrSnapshotSize: {
      voters: 'Compact<u32>',
      targets: 'Compact<u32>'
    },
    SolutionSupport: {
      total: 'ExtendedBalance',
      voters: 'Vec<(AccountId, ExtendedBalance)>'
    },
    SolutionSupports: 'Vec<(AccountId, SolutionSupport)>',
    Supports: 'SolutionSupports',
    SubmissionIndicesOf: 'BTreeMap<ElectionScore, u32>',
    Voter: {
      votes: 'Vec<AccountId>',
      stake: 'Balance',
      deposit: 'Balance'
    },
    VoteWeight: 'u64'
  };
  const definitions$w = {
    rpc: {},
    types: util.objectSpread({}, deprecated, phragmen, {
      ActiveEraInfo: {
        index: 'EraIndex',
        start: 'Option<Moment>'
      },
      EraIndex: 'u32',
      EraRewardPoints: {
        total: 'RewardPoint',
        individual: 'BTreeMap<AccountId, RewardPoint>'
      },
      EraRewards: {
        total: 'u32',
        rewards: 'Vec<u32>'
      },
      Exposure: {
        total: 'Compact<Balance>',
        own: 'Compact<Balance>',
        others: 'Vec<IndividualExposure>'
      },
      Forcing: {
        _enum: ['NotForcing', 'ForceNew', 'ForceNone', 'ForceAlways']
      },
      IndividualExposure: {
        who: 'AccountId',
        value: 'Compact<Balance>'
      },
      KeyType: 'AccountId',
      MomentOf: 'Moment',
      Nominations: {
        targets: 'Vec<AccountId>',
        submittedIn: 'EraIndex',
        suppressed: 'bool'
      },
      NominatorIndex: 'u32',
      NominatorIndexCompact: 'Compact<NominatorIndex>',
      OffchainAccuracy: 'PerU16',
      OffchainAccuracyCompact: 'Compact<OffchainAccuracy>',
      PhragmenScore: '[u128; 3]',
      Points: 'u32',
      RewardDestination: {
        _enum: {
          Staked: 'Null',
          Stash: 'Null',
          Controller: 'Null',
          Account: 'AccountId',
          None: 'Null'
        }
      },
      RewardPoint: 'u32',
      SlashJournalEntry: {
        who: 'AccountId',
        amount: 'Balance',
        ownSlash: 'Balance'
      },
      SlashingSpansTo204: {
        spanIndex: 'SpanIndex',
        lastStart: 'EraIndex',
        prior: 'Vec<EraIndex>'
      },
      SlashingSpans: {
        spanIndex: 'SpanIndex',
        lastStart: 'EraIndex',
        lastNonzeroSlash: 'EraIndex',
        prior: 'Vec<EraIndex>'
      },
      SpanIndex: 'u32',
      SpanRecord: {
        slashed: 'Balance',
        paidOut: 'Balance'
      },
      StakingLedgerTo223: {
        stash: 'AccountId',
        total: 'Compact<Balance>',
        active: 'Compact<Balance>',
        unlocking: 'Vec<UnlockChunk>'
      },
      StakingLedgerTo240: {
        _fallback: 'StakingLedgerTo223',
        stash: 'AccountId',
        total: 'Compact<Balance>',
        active: 'Compact<Balance>',
        unlocking: 'Vec<UnlockChunk>',
        lastReward: 'Option<EraIndex>'
      },
      StakingLedger: {
        stash: 'AccountId',
        total: 'Compact<Balance>',
        active: 'Compact<Balance>',
        unlocking: 'Vec<UnlockChunk>',
        claimedRewards: 'Vec<EraIndex>'
      },
      UnappliedSlashOther: '(AccountId, Balance)',
      UnappliedSlash: {
        validator: 'AccountId',
        own: 'Balance',
        others: 'Vec<UnappliedSlashOther>',
        reporters: 'Vec<AccountId>',
        payout: 'Balance'
      },
      UnlockChunk: {
        value: 'Compact<Balance>',
        era: 'Compact<BlockNumber>'
      },
      ValidatorIndex: 'u16',
      ValidatorIndexCompact: 'Compact<ValidatorIndex>',
      ValidatorPrefs: 'ValidatorPrefsWithBlocked',
      ValidatorPrefsWithCommission: {
        commission: 'Compact<Perbill>'
      },
      ValidatorPrefsWithBlocked: {
        commission: 'Compact<Perbill>',
        blocked: 'bool'
      },
      ValidatorPrefsTo196: {
        validatorPayment: 'Compact<Balance>'
      },
      ValidatorPrefsTo145: {
        unstakeThreshold: 'Compact<u32>',
        validatorPayment: 'Compact<Balance>'
      }
    })
  };

  const definitions$v = {
    rpc: {},
    types: {
      WeightToFeeCoefficient: {
        coeffInteger: 'Balance',
        coeffFrac: 'Perbill',
        negative: 'bool',
        degree: 'u8'
      }
    }
  };

  const rpc$9 = {
    genSyncSpec: {
      description: 'Returns the json-serialized chainspec running the node, with a sync state.',
      endpoint: 'sync_state_genSyncSpec',
      params: [{
        name: 'raw',
        type: 'bool'
      }],
      type: 'Json'
    }
  };

  const definitions$u = {
    rpc: rpc$9,
    types: {}
  };

  const rpc$8 = {
    accountNextIndex: {
      alias: ['account_nextIndex'],
      description: 'Retrieves the next accountIndex as available on the node',
      params: [{
        name: 'accountId',
        type: 'AccountId'
      }],
      type: 'Index'
    },
    addLogFilter: {
      description: 'Adds the supplied directives to the current log filter',
      params: [{
        name: 'directives',
        type: 'Text'
      }],
      type: 'Null'
    },
    addReservedPeer: {
      description: 'Adds a reserved peer',
      params: [{
        name: 'peer',
        type: 'Text'
      }],
      type: 'Text'
    },
    chain: {
      description: 'Retrieves the chain',
      params: [],
      type: 'Text'
    },
    chainType: {
      description: 'Retrieves the chain type',
      params: [],
      type: 'ChainType'
    },
    dryRun: {
      alias: ['system_dryRunAt'],
      description: 'Dry run an extrinsic at a given block',
      params: [{
        name: 'extrinsic',
        type: 'Bytes'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'ApplyExtrinsicResult'
    },
    health: {
      description: 'Return health status of the node',
      noErrorLog: true,
      params: [],
      type: 'Health'
    },
    localListenAddresses: {
      description: 'The addresses include a trailing /p2p/ with the local PeerId, and are thus suitable to be passed to addReservedPeer or as a bootnode address for example',
      params: [],
      type: 'Vec<Text>'
    },
    localPeerId: {
      description: 'Returns the base58-encoded PeerId of the node',
      params: [],
      type: 'Text'
    },
    name: {
      description: 'Retrieves the node name',
      params: [],
      type: 'Text'
    },
    networkState: {
      alias: ['system_unstable_networkState'],
      description: 'Returns current state of the network',
      params: [],
      type: 'NetworkState'
    },
    nodeRoles: {
      description: 'Returns the roles the node is running as',
      params: [],
      type: 'Vec<NodeRole>'
    },
    peers: {
      description: 'Returns the currently connected peers',
      params: [],
      type: 'Vec<PeerInfo>'
    },
    properties: {
      description: 'Get a custom set of properties as a JSON object, defined in the chain spec',
      params: [],
      type: 'ChainProperties'
    },
    removeReservedPeer: {
      description: 'Remove a reserved peer',
      params: [{
        name: 'peerId',
        type: 'Text'
      }],
      type: 'Text'
    },
    reservedPeers: {
      description: 'Returns the list of reserved peers',
      params: [],
      type: 'Vec<Text>'
    },
    resetLogFilter: {
      description: 'Resets the log filter to Substrate defaults',
      params: [],
      type: 'Null'
    },
    syncState: {
      description: 'Returns the state of the syncing of the node',
      params: [],
      type: 'SyncState'
    },
    version: {
      description: 'Retrieves the version of the node',
      params: [],
      type: 'Text'
    }
  };

  const runtime$a = {
    AccountNonceApi: [{
      methods: {
        account_nonce: {
          description: 'The API to query account nonce (aka transaction index)',
          params: [{
            name: 'accountId',
            type: 'AccountId'
          }],
          type: 'Index'
        }
      },
      version: 1
    }]
  };

  const definitions$t = {
    rpc: rpc$8,
    runtime: runtime$a,
    types: {
      AccountInfo: 'AccountInfoWithTripleRefCount',
      AccountInfoWithRefCountU8: {
        nonce: 'Index',
        refcount: 'u8',
        data: 'AccountData'
      },
      AccountInfoWithRefCount: {
        _fallback: 'AccountInfoWithRefCountU8',
        nonce: 'Index',
        refcount: 'RefCount',
        data: 'AccountData'
      },
      AccountInfoWithDualRefCount: {
        _fallback: 'AccountInfoWithRefCount',
        nonce: 'Index',
        consumers: 'RefCount',
        providers: 'RefCount',
        data: 'AccountData'
      },
      AccountInfoWithProviders: 'AccountInfoWithDualRefCount',
      AccountInfoWithTripleRefCount: {
        _fallback: 'AccountInfoWithDualRefCount',
        nonce: 'Index',
        consumers: 'RefCount',
        providers: 'RefCount',
        sufficients: 'RefCount',
        data: 'AccountData'
      },
      ApplyExtrinsicResult: 'Result<DispatchOutcome, TransactionValidityError>',
      ApplyExtrinsicResultPre6: 'Result<DispatchOutcomePre6, TransactionValidityError>',
      ArithmeticError: {
        _enum: ['Underflow', 'Overflow', 'DivisionByZero']
      },
      BlockLength: {
        max: 'PerDispatchClassU32'
      },
      BlockWeights: {
        baseBlock: 'Weight',
        maxBlock: 'Weight',
        perClass: 'PerDispatchClassWeightsPerClass'
      },
      ChainProperties: 'GenericChainProperties',
      ChainType: {
        _enum: {
          Development: 'Null',
          Local: 'Null',
          Live: 'Null',
          Custom: 'Text'
        }
      },
      ConsumedWeight: 'PerDispatchClassWeight',
      DigestOf: 'Digest',
      DispatchClass: {
        _enum: ['Normal', 'Operational', 'Mandatory']
      },
      DispatchError: {
        _enum: {
          Other: 'Null',
          CannotLookup: 'Null',
          BadOrigin: 'Null',
          Module: 'DispatchErrorModule',
          ConsumerRemaining: 'Null',
          NoProviders: 'Null',
          TooManyConsumers: 'Null',
          Token: 'TokenError',
          Arithmetic: 'ArithmeticError',
          Transactional: 'TransactionalError'
        }
      },
      DispatchErrorPre6: {
        _enum: {
          Other: 'Null',
          CannotLookup: 'Null',
          BadOrigin: 'Null',
          Module: 'DispatchErrorModulePre6',
          ConsumerRemaining: 'Null',
          NoProviders: 'Null',
          TooManyConsumers: 'Null',
          Token: 'TokenError',
          Arithmetic: 'ArithmeticError',
          Transactional: 'TransactionalError'
        }
      },
      DispatchErrorPre6First: {
        _enum: {
          Other: 'Null',
          CannotLookup: 'Null',
          BadOrigin: 'Null',
          Module: 'DispatchErrorModulePre6',
          ConsumerRemaining: 'Null',
          NoProviders: 'Null',
          Token: 'TokenError',
          Arithmetic: 'ArithmeticError',
          Transactional: 'TransactionalError'
        }
      },
      DispatchErrorModuleU8: {
        index: 'u8',
        error: 'u8'
      },
      DispatchErrorModuleU8a: {
        index: 'u8',
        error: '[u8; 4]'
      },
      DispatchErrorModule: 'DispatchErrorModuleU8a',
      DispatchErrorModulePre6: 'DispatchErrorModuleU8',
      DispatchErrorTo198: {
        module: 'Option<u8>',
        error: 'u8'
      },
      DispatchInfo: {
        weight: 'Weight',
        class: 'DispatchClass',
        paysFee: 'Pays'
      },
      DispatchInfoTo190: {
        weight: 'Weight',
        class: 'DispatchClass'
      },
      DispatchInfoTo244: {
        weight: 'Weight',
        class: 'DispatchClass',
        paysFee: 'bool'
      },
      DispatchOutcome: 'Result<(), DispatchError>',
      DispatchOutcomePre6: 'Result<(), DispatchErrorPre6>',
      DispatchResult: 'Result<(), DispatchError>',
      DispatchResultOf: 'DispatchResult',
      DispatchResultTo198: 'Result<(), Text>',
      Event: 'GenericEvent',
      EventId: '[u8; 2]',
      EventIndex: 'u32',
      EventRecord: {
        phase: 'Phase',
        event: 'Event',
        topics: 'Vec<Hash>'
      },
      Health: {
        peers: 'u64',
        isSyncing: 'bool',
        shouldHavePeers: 'bool'
      },
      InvalidTransaction: {
        _enum: {
          Call: 'Null',
          Payment: 'Null',
          Future: 'Null',
          Stale: 'Null',
          BadProof: 'Null',
          AncientBirthBlock: 'Null',
          ExhaustsResources: 'Null',
          Custom: 'u8',
          BadMandatory: 'Null',
          MandatoryDispatch: 'Null',
          BadSigner: 'Null'
        }
      },
      Key: 'Bytes',
      LastRuntimeUpgradeInfo: {
        specVersion: 'Compact<u32>',
        specName: 'Text'
      },
      NetworkState: {
        peerId: 'Text',
        listenedAddresses: 'Vec<Text>',
        externalAddresses: 'Vec<Text>',
        connectedPeers: 'HashMap<Text, Peer>',
        notConnectedPeers: 'HashMap<Text, NotConnectedPeer>',
        averageDownloadPerSec: 'u64',
        averageUploadPerSec: 'u64',
        peerset: 'NetworkStatePeerset'
      },
      NetworkStatePeerset: {
        messageQueue: 'u64',
        nodes: 'HashMap<Text, NetworkStatePeersetInfo>'
      },
      NetworkStatePeersetInfo: {
        connected: 'bool',
        reputation: 'i32'
      },
      NodeRole: {
        _enum: {
          Full: 'Null',
          LightClient: 'Null',
          Authority: 'Null',
          UnknownRole: 'u8'
        }
      },
      NotConnectedPeer: {
        knownAddresses: 'Vec<Text>',
        latestPingTime: 'Option<PeerPing>',
        versionString: 'Option<Text>'
      },
      Peer: {
        enabled: 'bool',
        endpoint: 'PeerEndpoint',
        knownAddresses: 'Vec<Text>',
        latestPingTime: 'PeerPing',
        open: 'bool',
        versionString: 'Text'
      },
      PeerEndpoint: {
        listening: 'PeerEndpointAddr'
      },
      PeerEndpointAddr: {
        _alias: {
          localAddr: 'local_addr',
          sendBackAddr: 'send_back_addr'
        },
        localAddr: 'Text',
        sendBackAddr: 'Text'
      },
      PeerPing: {
        nanos: 'u64',
        secs: 'u64'
      },
      PeerInfo: {
        peerId: 'Text',
        roles: 'Text',
        protocolVersion: 'u32',
        bestHash: 'Hash',
        bestNumber: 'BlockNumber'
      },
      PerDispatchClassU32: {
        normal: 'u32',
        operational: 'u32',
        mandatory: 'u32'
      },
      PerDispatchClassWeight: {
        normal: 'Weight',
        operational: 'Weight',
        mandatory: 'Weight'
      },
      PerDispatchClassWeightsPerClass: {
        normal: 'WeightPerClass',
        operational: 'WeightPerClass',
        mandatory: 'WeightPerClass'
      },
      Phase: {
        _enum: {
          ApplyExtrinsic: 'u32',
          Finalization: 'Null',
          Initialization: 'Null'
        }
      },
      RawOrigin: {
        _enum: {
          Root: 'Null',
          Signed: 'AccountId',
          None: 'Null'
        }
      },
      RefCount: 'u32',
      RefCountTo259: 'u8',
      SyncState: {
        startingBlock: 'BlockNumber',
        currentBlock: 'BlockNumber',
        highestBlock: 'Option<BlockNumber>'
      },
      SystemOrigin: 'RawOrigin',
      TokenError: {
        _enum: ['NoFunds', 'WouldDie', 'BelowMinimum', 'CannotCreate', 'UnknownAsset', 'Frozen', 'Unsupported',
        'Underflow', 'Overflow']
      },
      TransactionValidityError: {
        _enum: {
          Invalid: 'InvalidTransaction',
          Unknown: 'UnknownTransaction'
        }
      },
      TransactionalError: {
        _enum: ['LimitReached', 'NoLayer']
      },
      UnknownTransaction: {
        _enum: {
          CannotLookup: 'Null',
          NoUnsignedValidator: 'Null',
          Custom: 'u8'
        }
      },
      WeightPerClass: {
        baseExtrinsic: 'Weight',
        maxExtrinsic: 'Option<Weight>',
        maxTotal: 'Option<Weight>',
        reserved: 'Option<Weight>'
      }
    }
  };

  const definitions$s = {
    rpc: {},
    types: {
      Bounty: {
        proposer: 'AccountId',
        value: 'Balance',
        fee: 'Balance',
        curatorDeposit: 'Balance',
        bond: 'Balance',
        status: 'BountyStatus'
      },
      BountyIndex: 'u32',
      BountyStatus: {
        _enum: {
          Proposed: 'Null',
          Approved: 'Null',
          Funded: 'Null',
          CuratorProposed: 'BountyStatusCuratorProposed',
          Active: 'BountyStatusActive',
          PendingPayout: 'BountyStatusPendingPayout'
        }
      },
      BountyStatusActive: {
        curator: 'AccountId',
        updateDue: 'BlockNumber'
      },
      BountyStatusCuratorProposed: {
        curator: 'AccountId'
      },
      BountyStatusPendingPayout: {
        curator: 'AccountId',
        beneficiary: 'AccountId',
        unlockAt: 'BlockNumber'
      },
      OpenTip: {
        reason: 'Hash',
        who: 'AccountId',
        finder: 'AccountId',
        deposit: 'Balance',
        closes: 'Option<BlockNumber>',
        tips: 'Vec<OpenTipTip>',
        findersFee: 'bool'
      },
      OpenTipTo225: {
        reason: 'Hash',
        who: 'AccountId',
        finder: 'Option<OpenTipFinderTo225>',
        closes: 'Option<BlockNumber>',
        tips: 'Vec<OpenTipTip>'
      },
      OpenTipFinderTo225: '(AccountId, Balance)',
      OpenTipTip: '(AccountId, Balance)',
      TreasuryProposal: {
        proposer: 'AccountId',
        value: 'Balance',
        beneficiary: 'AccountId',
        bond: 'Balance'
      }
    }
  };

  const definitions$r = {
    rpc: {},
    types: {
      Multiplier: 'Fixed128'
    }
  };

  const runtime$9 = {
    TaggedTransactionQueue: [{
      methods: {
        validate_transaction: {
          description: 'Validate the transaction.',
          params: [{
            name: 'source',
            type: 'TransactionSource'
          }, {
            name: 'tx',
            type: 'Extrinsic'
          }, {
            name: 'blockHash',
            type: 'BlockHash'
          }],
          type: 'TransactionValidity'
        }
      },
      version: 3
    }, {
      methods: {
        validate_transaction: {
          description: 'Validate the transaction.',
          params: [{
            name: 'source',
            type: 'TransactionSource'
          }, {
            name: 'tx',
            type: 'Extrinsic'
          }],
          type: 'TransactionValidity'
        }
      },
      version: 2
    }, {
      methods: {
        validate_transaction: {
          description: 'Validate the transaction.',
          params: [{
            name: 'tx',
            type: 'Extrinsic'
          }],
          type: 'TransactionValidity'
        }
      },
      version: 1
    }]
  };

  const definitions$q = {
    rpc: {},
    runtime: runtime$9,
    types: {
      TransactionSource: {
        _enum: ['InBlock', 'Local', 'External']
      },
      TransactionValidity: 'Result<ValidTransaction, TransactionValidityError>',
      ValidTransaction: {
        priority: 'TransactionPriority',
        requires: 'Vec<TransactionTag>',
        provides: 'Vec<TransactionTag>',
        longevity: 'TransactionLongevity',
        propagate: 'bool'
      }
    }
  };

  const definitions$p = {
    rpc: {},
    types: {
      ClassId: 'u32',
      InstanceId: 'u32',
      DepositBalance: 'Balance',
      DepositBalanceOf: 'Balance',
      ClassDetails: {
        owner: 'AccountId',
        issuer: 'AccountId',
        admin: 'AccountId',
        freezer: 'AccountId',
        totalDeposit: 'DepositBalance',
        freeHolding: 'bool',
        instances: 'u32',
        instanceMetadatas: 'u32',
        attributes: 'u32',
        isFrozen: 'bool'
      },
      DestroyWitness: {
        instances: 'Compact<u32>',
        instanceMetadatas: 'Compact<u32>',
        attributes: 'Compact<u32>'
      },
      InstanceDetails: {
        owner: 'AccountId',
        approved: 'Option<AccountId>',
        isFrozen: 'bool',
        deposit: 'DepositBalance'
      },
      ClassMetadata: {
        deposit: 'DepositBalance',
        data: 'Vec<u8>',
        isFrozen: 'bool'
      },
      InstanceMetadata: {
        deposit: 'DepositBalance',
        data: 'Vec<u8>',
        isFrozen: 'bool'
      }
    }
  };

  const definitions$o = {
    rpc: {},
    types: {
      Multisig: {
        when: 'Timepoint',
        deposit: 'Balance',
        depositor: 'AccountId',
        approvals: 'Vec<AccountId>'
      },
      Timepoint: {
        height: 'BlockNumber',
        index: 'u32'
      }
    }
  };

  const definitions$n = {
    rpc: {},
    types: {
      VestingInfo: {
        locked: 'Balance',
        perBlock: 'Balance',
        startingBlock: 'BlockNumber'
      }
    }
  };

  const definitions$m = {
    rpc: {},
    types: {
      BlockAttestations: {
        receipt: 'CandidateReceipt',
        valid: 'Vec<AccountId>',
        invalid: 'Vec<AccountId>'
      },
      IncludedBlocks: {
        actualNumber: 'BlockNumber',
        session: 'SessionIndex',
        randomSeed: 'H256',
        activeParachains: 'Vec<ParaId>',
        paraBlocks: 'Vec<Hash>'
      },
      MoreAttestations: {}
    }
  };

  const definitions$l = {
    rpc: {},
    types: {
      BridgedBlockHash: 'H256',
      BridgedBlockNumber: 'BlockNumber',
      BridgedHeader: 'Header',
      BridgeMessageId: '(LaneId, MessageNonce)',
      CallOrigin: {
        _enum: {
          SourceRoot: 'Null',
          TargetAccount: '(AccountId, MultiSigner, MultiSignature)',
          SourceAccount: 'AccountId'
        }
      },
      ChainId: '[u8; 4]',
      DeliveredMessages: {
        begin: 'MessageNonce',
        end: 'MessageNonce',
        dispatchResults: 'BitVec'
      },
      DispatchFeePayment: {
        _enum: ['AtSourceChain', 'AtTargetChain']
      },
      InboundLaneData: {
        relayers: 'Vec<UnrewardedRelayer>',
        lastConfirmedNonce: 'MessageNonce'
      },
      InboundRelayer: 'AccountId',
      InitializationData: {
        header: 'Header',
        authorityList: 'AuthorityList',
        setId: 'SetId',
        isHalted: 'bool'
      },
      LaneId: '[u8; 4]',
      MessageData: {
        payload: 'Bytes',
        fee: 'Balance'
      },
      MessagesDeliveryProofOf: {
        bridgedHeaderHash: 'BlockHash',
        storageProof: 'Vec<Bytes>',
        lane: 'LaneId'
      },
      MessageKey: {
        laneId: 'LaneId',
        nonce: 'MessageNonce'
      },
      MessageNonce: 'u64',
      MessagesProofOf: {
        bridgedHeaderHash: 'BridgedBlockHash',
        storageProof: 'Vec<Bytes>',
        lane: 'LaneId',
        noncesStart: 'MessageNonce',
        noncesEnd: 'MessageNonce'
      },
      OperatingMode: {
        _enum: ['Normal', 'RejectingOutboundMessages', 'Halted']
      },
      OutboundLaneData: {
        oldestUnprunedNonce: 'MessageNonce',
        latestReceivedNonce: 'MessageNonce',
        latestGeneratedNonce: 'MessageNonce'
      },
      OutboundMessageFee: 'Balance',
      OutboundPayload: {
        specVersion: 'u32',
        weight: 'Weight',
        origin: 'CallOrigin',
        dispatchFeePayment: 'DispatchFeePayment',
        call: 'Bytes'
      },
      Parameter: 'Null',
      RelayerId: 'AccountId',
      UnrewardedRelayer: {
        relayer: 'RelayerId',
        messages: 'DeliveredMessages'
      },
      UnrewardedRelayersState: {
        unrewardedRelayer_Entries: 'MessageNonce',
        messagesInOldestEntry: 'MessageNonce',
        totalMessages: 'MessageNonce'
      }
    }
  };

  const definitions$k = {
    rpc: {},
    types: {
      StatementKind: {
        _enum: ['Regular', 'Saft']
      }
    }
  };

  const definitions$j = {
    rpc: {},
    types: {
      FundIndex: 'u32',
      LastContribution: {
        _enum: {
          Never: 'Null',
          PreEnding: 'u32',
          Ending: 'BlockNumber'
        }
      },
      FundInfo: {
        depositor: 'AccountId',
        verifier: 'Option<MultiSigner>',
        deposit: 'Balance',
        raised: 'Balance',
        end: 'BlockNumber',
        cap: 'Balance',
        lastContribution: 'LastContribution',
        firstPeriod: 'LeasePeriod',
        lastPeriod: 'LeasePeriod',
        trieIndex: 'TrieIndex'
      },
      TrieIndex: 'u32'
    }
  };

  const runtime$8 = {
    CollectCollationInfo: [{
      methods: {
        collect_collation_info: {
          description: 'Collect information about a collation.',
          params: [{
            name: 'header',
            type: 'Header'
          }],
          type: 'CollationInfo'
        }
      },
      version: 2
    }, {
      methods: {
        collect_collation_info: {
          description: 'Collect information about a collation.',
          params: [],
          type: 'CollationInfoV1'
        }
      },
      version: 1
    }]
  };

  const dmpQueue = {
    CollationInfo: {
      upwardMessages: 'Vec<UpwardMessage>',
      horizontalMessages: 'Vec<OutboundHrmpMessage>',
      newValidationCode: 'Option<ValidationCode>',
      processedDownwardMessages: 'u32',
      hrmpWatermark: 'RelayBlockNumber',
      headData: 'HeadData'
    },
    CollationInfoV1: {
      upwardMessages: 'Vec<UpwardMessage>',
      horizontalMessages: 'Vec<OutboundHrmpMessage>',
      newValidationCode: 'Option<ValidationCode>',
      processedDownwardMessages: 'u32',
      hrmpWatermark: 'RelayBlockNumber'
    },
    ConfigData: {
      maxIndividual: 'Weight'
    },
    MessageId: '[u8; 32]',
    OverweightIndex: 'u64',
    PageCounter: 'u32',
    PageIndexData: {
      beginUsed: 'PageCounter',
      endUsed: 'PageCounter',
      overweightCount: 'OverweightIndex'
    }
  };
  const definitions$i = {
    rpc: {},
    runtime: runtime$8,
    types: dmpQueue
  };

  const finalityV1 = {
    methods: {
      best_finalized: {
        description: 'Returns number and hash of the best finalized header known to the bridge module.',
        params: [],
        type: '(BlockNumber, Hash)'
      }
    },
    version: 1
  };
  const runtime$7 = {
    KusamaFinalityApi: [finalityV1],
    PolkadotFinalityApi: [finalityV1],
    RococoFinalityApi: [finalityV1],
    WestendFinalityApi: [finalityV1]
  };

  const definitions$h = {
    rpc: {},
    runtime: runtime$7,
    types: {}
  };

  const hrmpTypes = {
    HrmpChannel: {
      maxCapacity: 'u32',
      maxTotalSize: 'u32',
      maxMessageSize: 'u32',
      msgCount: 'u32',
      totalSize: 'u32',
      mqcHead: 'Option<Hash>',
      senderDeposit: 'Balance',
      recipientDeposit: 'Balance'
    },
    HrmpChannelId: {
      sender: 'u32',
      receiver: 'u32'
    },
    HrmpOpenChannelRequest: {
      confirmed: 'bool',
      age: 'SessionIndex',
      senderDeposit: 'Balance',
      maxMessageSize: 'u32',
      maxCapacity: 'u32',
      maxTotalSize: 'u32'
    }
  };

  const PH_V1_TO_V2 = {
    assumed_validation_data: {
      description: 'Returns the persisted validation data for the given `ParaId` along with the corresponding validation code hash.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }, {
        name: 'hash',
        type: 'Hash'
      }],
      type: 'Option<(PersistedValidationData, ValidationCodeHash)>'
    },
    availability_cores: {
      description: 'Yields information on all availability cores as relevant to the child block.',
      params: [],
      type: 'Vec<CoreState>'
    },
    candidate_events: {
      description: 'Get a vector of events concerning candidates that occurred within a block.',
      params: [],
      type: 'Vec<CandidateEvent>'
    },
    candidate_pending_availability: {
      description: 'Get the receipt of a candidate pending availability.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }],
      type: 'Option<CommittedCandidateReceipt>'
    },
    check_validation_outputs: {
      description: 'Checks if the given validation outputs pass the acceptance criteria.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }, {
        name: 'outputs',
        type: 'CandidateCommitments'
      }],
      type: 'bool'
    },
    dmq_contents: {
      description: 'Get all the pending inbound messages in the downward message queue for a para.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }],
      type: 'Vec<InboundDownwardMessage>'
    },
    inbound_hrmp_channels_contents: {
      description: 'Get the contents of all channels addressed to the given recipient.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }],
      type: 'Vec<InboundHrmpMessage>'
    },
    on_chain_votes: {
      description: 'Scrape dispute relevant from on-chain, backing votes and resolved disputes.',
      params: [],
      type: 'Option<ScrapedOnChainVotes>'
    },
    persisted_validation_data: {
      description: 'Yields the persisted validation data for the given `ParaId` along with an assumption that should be used if the para currently occupies a core.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }, {
        name: 'assumption',
        type: 'OccupiedCoreAssumption'
      }],
      type: 'Option<PersistedValidationData>'
    },
    session_index_for_child: {
      description: 'Returns the session index expected at a child of the block.',
      params: [],
      type: 'SessionIndex'
    },
    validation_code: {
      description: 'Fetch the validation code used by a para, making the given `OccupiedCoreAssumption`.',
      params: [{
        name: 'paraId',
        type: 'ParaId'
      }, {
        name: 'assumption',
        type: 'OccupiedCoreAssumption'
      }],
      type: 'ValidationCode'
    },
    validation_code_by_hash: {
      description: 'Get the validation code from its hash.',
      params: [{
        name: 'hash',
        type: 'ValidationCodeHash'
      }],
      type: 'Option<ValidationCode>'
    },
    validator_groups: {
      description: 'Returns the validator groups and rotation info localized based on the hypothetical child of a block whose state  this is invoked on',
      params: [],
      type: '(Vec<Vec<ParaValidatorIndex>>, GroupRotationInfo)'
    },
    validators: {
      description: 'Get the current validators.',
      params: [],
      type: 'Vec<ValidatorId>'
    }
  };
  const runtime$6 = {
    ParachainHost: [{
      methods: util.objectSpread({
        pvfs_require_precheck: {
          description: 'Returns code hashes of PVFs that require pre-checking by validators in the active set.',
          params: [],
          type: 'Vec<ValidationCodeHash>'
        },
        session_info: {
          description: 'Get the session info for the given session, if stored.',
          params: [{
            name: 'index',
            type: 'SessionIndex'
          }],
          type: 'Option<SessionInfo>'
        },
        submit_pvf_check_statement: {
          description: 'Submits a PVF pre-checking statement into the transaction pool.',
          params: [{
            name: 'stmt',
            type: 'PvfCheckStatement'
          }, {
            name: 'signature',
            type: 'ValidatorSignature'
          }],
          type: 'Null'
        },
        validation_code_hash: {
          description: 'Fetch the hash of the validation code used by a para, making the given `OccupiedCoreAssumption`.',
          params: [{
            name: 'paraId',
            type: 'ParaId'
          }, {
            name: 'assumption',
            type: 'OccupiedCoreAssumption'
          }],
          type: 'Option<ValidationCodeHash>'
        }
      }, PH_V1_TO_V2),
      version: 2
    }, {
      methods: util.objectSpread({
        session_info: {
          description: 'Get the session info for the given session, if stored.',
          params: [{
            name: 'index',
            type: 'SessionIndex'
          }],
          type: 'Option<OldV1SessionInfo>'
        }
      }, PH_V1_TO_V2),
      version: 1
    }]
  };

  const SlotRange10 = {
    _enum: ['ZeroZero', 'ZeroOne', 'ZeroTwo', 'ZeroThree', 'OneOne', 'OneTwo', 'OneThree', 'TwoTwo', 'TwoThree', 'ThreeThree']
  };
  const SlotRange = {
    _enum: ['ZeroZero', 'ZeroOne', 'ZeroTwo', 'ZeroThree', 'ZeroFour', 'ZeroFive', 'ZeroSix', 'ZeroSeven', 'OneOne', 'OneTwo', 'OneThree', 'OneFour', 'OneFive', 'OneSix', 'OneSeven', 'TwoTwo', 'TwoThree', 'TwoFour', 'TwoFive', 'TwoSix', 'TwoSeven', 'ThreeThree', 'ThreeFour', 'ThreeFive', 'ThreeSix', 'ThreeSeven', 'FourFour', 'FourFive', 'FourSix', 'FourSeven', 'FiveFive', 'FiveSix', 'FiveSeven', 'SixSix', 'SixSeven', 'SevenSeven']
  };
  const oldTypes = {
    Bidder: {
      _enum: {
        New: 'NewBidder',
        Existing: 'ParaId'
      }
    },
    IncomingParachain: {
      _enum: {
        Unset: 'NewBidder',
        Fixed: 'IncomingParachainFixed',
        Deploy: 'IncomingParachainDeploy'
      }
    },
    IncomingParachainDeploy: {
      code: 'ValidationCode',
      initialHeadData: 'HeadData'
    },
    IncomingParachainFixed: {
      codeHash: 'Hash',
      codeSize: 'u32',
      initialHeadData: 'HeadData'
    },
    NewBidder: {
      who: 'AccountId',
      sub: 'SubId'
    },
    SubId: 'u32'
  };
  const slotTypes = util.objectSpread({}, oldTypes, {
    AuctionIndex: 'u32',
    LeasePeriod: 'BlockNumber',
    LeasePeriodOf: 'BlockNumber',
    SlotRange10,
    SlotRange,
    WinningData10: `[WinningDataEntry; ${SlotRange10._enum.length}]`,
    WinningData: `[WinningDataEntry; ${SlotRange._enum.length}]`,
    WinningDataEntry: 'Option<(AccountId, ParaId, BalanceOf)>',
    WinnersData10: 'Vec<WinnersDataTuple10>',
    WinnersData: 'Vec<WinnersDataTuple>',
    WinnersDataTuple10: '(AccountId, ParaId, BalanceOf, SlotRange10)',
    WinnersDataTuple: '(AccountId, ParaId, BalanceOf, SlotRange)'
  });

  const proposeTypes = {
    ParachainProposal: {
      proposer: 'AccountId',
      genesisHead: 'HeadData',
      validators: 'Vec<ValidatorId>',
      name: 'Bytes',
      balance: 'Balance'
    },
    RegisteredParachainInfo: {
      validators: 'Vec<ValidatorId>',
      proposer: 'AccountId'
    }
  };
  const cumulusTypes = {
    ServiceQuality: {
      _enum: ['Ordered', 'Fast']
    }
  };
  const disputeTypes = {
    DisputeLocation: {
      _enum: ['Local', 'Remote']
    },
    DisputeResult: {
      _enum: ['Valid', 'Invalid']
    },
    DisputeState: {
      validatorsFor: 'BitVec',
      validatorsAgainst: 'BitVec',
      start: 'BlockNumber',
      concludedAt: 'Option<BlockNumber>'
    },
    DisputeStatement: {
      _enum: {
        Valid: 'ValidDisputeStatementKind',
        Invalid: 'InvalidDisputeStatementKind'
      }
    },
    DisputeStatementSet: {
      candidateHash: 'CandidateHash',
      session: 'SessionIndex',
      statements: 'Vec<(DisputeStatement, ParaValidatorIndex, ValidatorSignature)>'
    },
    ExplicitDisputeStatement: {
      valid: 'bool',
      candidateHash: 'CandidateHash',
      session: 'SessionIndex'
    },
    InvalidDisputeStatementKind: {
      _enum: ['Explicit']
    },
    MultiDisputeStatementSet: 'Vec<DisputeStatementSet>',
    ValidDisputeStatementKind: {
      _enum: {
        Explicit: 'Null',
        BackingSeconded: 'Hash',
        BackingValid: 'Hash',
        ApprovalChecking: 'Null'
      }
    }
  };
  const definitions$g = {
    rpc: {},
    runtime: runtime$6,
    types: util.objectSpread({}, cumulusTypes, disputeTypes, hrmpTypes, proposeTypes, slotTypes, {
      AbridgedCandidateReceipt: {
        parachainIndex: 'ParaId',
        relayParent: 'Hash',
        headData: 'HeadData',
        collator: 'CollatorId',
        signature: 'CollatorSignature',
        povBlockHash: 'Hash',
        commitments: 'CandidateCommitments'
      },
      AbridgedHostConfiguration: {
        maxCodeSize: 'u32',
        maxHeadDataSize: 'u32',
        maxUpwardQueueCount: 'u32',
        maxUpwardQueueSize: 'u32',
        maxUpwardMessageSize: 'u32',
        maxUpwardMessageNumPerCandidate: 'u32',
        hrmpMaxMessageNumPerCandidate: 'u32',
        validationUpgradeFrequency: 'BlockNumber',
        validationUpgradeDelay: 'BlockNumber'
      },
      AbridgedHrmpChannel: {
        maxCapacity: 'u32',
        maxTotalSize: 'u32',
        maxMessageSize: 'u32',
        msgCount: 'u32',
        totalSize: 'u32',
        mqcHead: 'Option<Hash>'
      },
      AssignmentId: 'AccountId',
      AssignmentKind: {
        _enum: {
          Parachain: 'Null',
          Parathread: '(CollatorId, u32)'
        }
      },
      AttestedCandidate: {
        candidate: 'AbridgedCandidateReceipt',
        validityVotes: 'Vec<ValidityAttestation>',
        validatorIndices: 'BitVec'
      },
      AuthorityDiscoveryId: 'AccountId',
      AvailabilityBitfield: 'BitVec',
      AvailabilityBitfieldRecord: {
        bitfield: 'AvailabilityBitfield',
        submittedTt: 'BlockNumber'
      },
      BackedCandidate: {
        candidate: 'CommittedCandidateReceipt',
        validityVotes: 'Vec<ValidityAttestation>',
        validatorIndices: 'BitVec'
      },
      BufferedSessionChange: {
        applyAt: 'BlockNumber',
        validators: 'Vec<ValidatorId>',
        queued: 'Vec<ValidatorId>',
        sessionIndex: 'SessionIndex'
      },
      CandidateCommitments: {
        upwardMessages: 'Vec<UpwardMessage>',
        horizontalMessages: 'Vec<OutboundHrmpMessage>',
        newValidationCode: 'Option<ValidationCode>',
        headData: 'HeadData',
        processedDownwardMessages: 'u32',
        hrmpWatermark: 'BlockNumber'
      },
      CandidateDescriptor: {
        paraId: 'ParaId',
        relayParent: 'RelayChainHash',
        collatorId: 'CollatorId',
        persistedValidationDataHash: 'Hash',
        povHash: 'Hash',
        erasureRoot: 'Hash',
        signature: 'CollatorSignature',
        paraHead: 'Hash',
        validationCodeHash: 'ValidationCodeHash'
      },
      CandidateEvent: {
        _enum: {
          CandidateBacked: '(CandidateReceipt, HeadData, CoreIndex, GroupIndex)',
          CandidateIncluded: '(CandidateReceipt, HeadData, CoreIndex, GroupIndex)',
          CandidateTimedOut: '(CandidateReceipt, HeadData, CoreIndex)'
        }
      },
      CandidateHash: 'Hash',
      CandidateInfo: {
        who: 'AccountId',
        deposit: 'Balance'
      },
      CandidatePendingAvailability: {
        core: 'CoreIndex',
        hash: 'CandidateHash',
        descriptor: 'CandidateDescriptor',
        availabilityVotes: 'BitVec',
        backers: 'BitVec',
        relayParentNumber: 'BlockNumber',
        backedInNumber: 'BlockNumber',
        backingGroup: 'GroupIndex'
      },
      CandidateReceipt: {
        descriptor: 'CandidateDescriptor',
        commitmentsHash: 'Hash'
      },
      GlobalValidationData: {
        maxCodeSize: 'u32',
        maxHeadDataSize: 'u32',
        blockNumber: 'BlockNumber'
      },
      CollatorId: 'H256',
      CollatorSignature: 'Signature',
      CommittedCandidateReceipt: {
        descriptor: 'CandidateDescriptor',
        commitments: 'CandidateCommitments'
      },
      CoreAssignment: {
        core: 'CoreIndex',
        paraId: 'ParaId',
        kind: 'AssignmentKind',
        groupIdx: 'GroupIndex'
      },
      CoreIndex: 'u32',
      CoreOccupied: {
        _enum: {
          Parathread: 'ParathreadEntry',
          Parachain: 'Null'
        }
      },
      CoreState: {
        _enum: {
          Occupied: 'OccupiedCore',
          Scheduled: 'ScheduledCore',
          Free: 'Null'
        }
      },
      DoubleVoteReport: {
        identity: 'ValidatorId',
        first: '(Statement, ValidatorSignature)',
        second: '(Statement, ValidatorSignature)',
        proof: 'MembershipProof',
        signingContext: 'SigningContext'
      },
      DownwardMessage: 'Bytes',
      GroupIndex: 'u32',
      GroupRotationInfo: {
        sessionStartBlock: 'BlockNumber',
        groupRotationFrequency: 'BlockNumber',
        now: 'BlockNumber'
      },
      GlobalValidationSchedule: {
        maxCodeSize: 'u32',
        maxHeadDataSize: 'u32',
        blockNumber: 'BlockNumber'
      },
      HeadData: 'Bytes',
      HostConfiguration: {
        maxCodeSize: 'u32',
        maxHeadDataSize: 'u32',
        maxUpwardQueueCount: 'u32',
        maxUpwardQueueSize: 'u32',
        maxUpwardMessageSize: 'u32',
        maxUpwardMessageNumPerCandidate: 'u32',
        hrmpMaxMessageNumPerCandidate: 'u32',
        validationUpgradeFrequency: 'BlockNumber',
        validationUpgradeDelay: 'BlockNumber',
        maxPovSize: 'u32',
        maxDownwardMessageSize: 'u32',
        preferredDispatchableUpwardMessagesStepWeight: 'Weight',
        hrmpMaxParachainOutboundChannels: 'u32',
        hrmpMaxParathreadOutboundChannels: 'u32',
        hrmpOpenRequestTtl: 'u32',
        hrmpSenderDeposit: 'Balance',
        hrmpRecipientDeposit: 'Balance',
        hrmpChannelMaxCapacity: 'u32',
        hrmpChannelMaxTotalSize: 'u32',
        hrmpMaxParachainInboundChannels: 'u32',
        hrmpMaxParathreadInboundChannels: 'u32',
        hrmpChannelMaxMessageSize: 'u32',
        codeRetentionPeriod: 'BlockNumber',
        parathreadCores: 'u32',
        parathreadRetries: 'u32',
        groupRotationFrequency: 'BlockNumber',
        chainAvailabilityPeriod: 'BlockNumber',
        threadAvailabilityPeriod: 'BlockNumber',
        schedulingLookahead: 'u32',
        maxValidatorsPerCore: 'Option<u32>',
        maxValidators: 'Option<u32>',
        disputePeriod: 'SessionIndex',
        disputePostConclusionAcceptancePeriod: 'BlockNumber',
        disputeMaxSpamSlots: 'u32',
        disputeConclusionByTimeOutPeriod: 'BlockNumber',
        noShowSlots: 'u32',
        nDelayTranches: 'u32',
        zerothDelayTrancheWidth: 'u32',
        neededApprovals: 'u32',
        relayVrfModuloSamples: 'u32'
      },
      InboundDownwardMessage: {
        pubSentAt: 'BlockNumber',
        pubMsg: 'DownwardMessage'
      },
      InboundHrmpMessage: {
        sentAt: 'BlockNumber',
        data: 'Bytes'
      },
      InboundHrmpMessages: 'Vec<InboundHrmpMessage>',
      LocalValidationData: {
        parentHead: 'HeadData',
        balance: 'Balance',
        codeUpgradeAllowed: 'Option<BlockNumber>'
      },
      MessageIngestionType: {
        downwardMessages: 'Vec<InboundDownwardMessage>',
        horizontalMessages: 'BTreeMap<ParaId, InboundHrmpMessages>'
      },
      MessageQueueChain: 'RelayChainHash',
      OccupiedCore: {
        nextUpOnAvailable: 'Option<ScheduledCore>',
        occupiedSince: 'BlockNumber',
        timeOutAt: 'BlockNumber',
        nextUpOnTimeOut: 'Option<ScheduledCore>',
        availability: 'BitVec',
        groupResponsible: 'GroupIndex',
        candidateHash: 'CandidateHash',
        candidateDescriptor: 'CandidateDescriptor'
      },
      OccupiedCoreAssumption: {
        _enum: ['Included,', 'TimedOut', 'Free']
      },
      OutboundHrmpMessage: {
        recipient: 'u32',
        data: 'Bytes'
      },
      ParachainDispatchOrigin: {
        _enum: ['Signed', 'Parachain', 'Root']
      },
      ParachainInherentData: {
        validationData: 'PersistedValidationData',
        relayChainState: 'StorageProof',
        downwardMessages: 'Vec<InboundDownwardMessage>',
        horizontalMessages: 'BTreeMap<ParaId, VecInboundHrmpMessage>'
      },
      ParachainsInherentData: {
        bitfields: 'SignedAvailabilityBitfields',
        backedCandidates: 'Vec<BackedCandidate>',
        disputes: 'MultiDisputeStatementSet',
        parentHeader: 'Header'
      },
      ParaGenesisArgs: {
        genesisHead: 'Bytes',
        validationCode: 'Bytes',
        parachain: 'bool'
      },
      ParaId: 'u32',
      ParaInfo: {
        manager: 'AccountId',
        deposit: 'Balance',
        locked: 'bool'
      },
      ParaLifecycle: {
        _enum: ['Onboarding', 'Parathread', 'Parachain', 'UpgradingToParachain', 'DowngradingToParathread', 'OutgoingParathread', 'OutgoingParachain']
      },
      ParaPastCodeMeta: {
        upgradeTimes: 'Vec<ReplacementTimes>',
        lastPruned: 'Option<BlockNumber>'
      },
      ParaScheduling: {
        _enum: ['Always', 'Dynamic']
      },
      ParathreadClaim: '(ParaId, CollatorId)',
      ParathreadClaimQueue: {
        queue: 'Vec<QueuedParathread>',
        nextCoreOffset: 'u32'
      },
      ParathreadEntry: {
        claim: 'ParathreadClaim',
        retries: 'u32'
      },
      ParaValidatorIndex: 'u32',
      PersistedValidationData: {
        parentHead: 'HeadData',
        relayParentNumber: 'RelayChainBlockNumber',
        relayParentStorageRoot: 'Hash',
        maxPovSize: 'u32'
      },
      PvfCheckStatement: {
        accept: 'bool',
        subject: 'ValidationCodeHash',
        sessionIndex: 'SessionIndex',
        validatorIndex: 'ParaValidatorIndex'
      },
      QueuedParathread: {
        claim: 'ParathreadEntry',
        coreOffset: 'u32'
      },
      RelayBlockNumber: 'u32',
      RelayChainBlockNumber: 'RelayBlockNumber',
      RelayHash: 'Hash',
      RelayChainHash: 'RelayHash',
      Remark: '[u8; 32]',
      ReplacementTimes: {
        expectedAt: 'BlockNumber',
        activatedAt: 'BlockNumber'
      },
      Retriable: {
        _enum: {
          Never: 'Null',
          WithRetries: 'u32'
        }
      },
      ScheduledCore: {
        paraId: 'ParaId',
        collator: 'Option<CollatorId>'
      },
      Scheduling: {
        _enum: ['Always', 'Dynamic']
      },
      ScrapedOnChainVotes: {
        session: 'SessionIndex',
        backingValidatorsPerCandidate: 'Vec<(CandidateReceipt, Vec<(ParaValidatorIndex, ValidityAttestation)>)>',
        disputes: 'MultiDisputeStatementSet'
      },
      SessionInfo: {
        activeValidatorIndices: 'Vec<ParaValidatorIndex>',
        randomSeed: '[u8; 32]',
        disputePeriod: 'SessionIndex',
        validators: 'Vec<ValidatorId>',
        discoveryKeys: 'Vec<AuthorityDiscoveryId>',
        assignmentKeys: 'Vec<AssignmentId>',
        validatorGroups: 'Vec<Vec<ValidatorIndex>>',
        nCores: 'u32',
        zerothDelayTrancheWidth: 'u32',
        relayVrfModuloSamples: 'u32',
        nDelayTranches: 'u32',
        noShowSlots: 'u32',
        neededApprovals: 'u32'
      },
      OldV1SessionInfo: {
        validators: 'Vec<ValidatorId>',
        discoveryKeys: 'Vec<AuthorityDiscoveryId>',
        assignmentKeys: 'Vec<AssignmentId>',
        validatorGroups: 'Vec<Vec<ParaValidatorIndex>>',
        nCores: 'u32',
        zerothDelayTrancheWidth: 'u32',
        relayVrfModuloSamples: 'u32',
        nDelayTranches: 'u32',
        noShowSlots: 'u32',
        neededApprovals: 'u32'
      },
      SessionInfoValidatorGroup: 'Vec<ParaValidatorIndex>',
      SignedAvailabilityBitfield: {
        payload: 'BitVec',
        validatorIndex: 'ParaValidatorIndex',
        signature: 'ValidatorSignature'
      },
      SignedAvailabilityBitfields: 'Vec<SignedAvailabilityBitfield>',
      SigningContext: {
        sessionIndex: 'SessionIndex',
        parentHash: 'Hash'
      },
      Statement: {
        _enum: {
          Never: 'Null',
          Candidate: 'Hash',
          Valid: 'Hash',
          Invalid: 'Hash'
        }
      },
      TransientValidationData: {
        maxCodeSize: 'u32',
        maxHeadDataSize: 'u32',
        balance: 'Balance',
        codeUpgradeAllowed: 'Option<BlockNumber>',
        dmqLength: 'u32'
      },
      UpgradeGoAhead: {
        _enum: ['Abort', 'GoAhead']
      },
      UpgradeRestriction: {
        _enum: ['Present']
      },
      UpwardMessage: 'Bytes',
      ValidationFunctionParams: {
        maxCodeSize: 'u32',
        relayChainHeight: 'RelayChainBlockNumber',
        codeUpgradeAllowed: 'Option<RelayChainBlockNumber>'
      },
      ValidationCode: 'Bytes',
      ValidationCodeHash: 'Hash',
      ValidationData: {
        persisted: 'PersistedValidationData',
        transient: 'TransientValidationData'
      },
      ValidationDataType: {
        validationData: 'ValidationData',
        relayChainState: 'Vec<Bytes>'
      },
      ValidatorSignature: 'Signature',
      ValidityAttestation: {
        _enum: {
          Never: 'Null',
          Implicit: 'ValidatorSignature',
          Explicit: 'ValidatorSignature'
        }
      },
      MessagingStateSnapshot: {
        relayDispatchQueueSize: '(u32, u32)',
        egressChannels: 'Vec<MessagingStateSnapshotEgressEntry>'
      },
      MessagingStateSnapshotEgressEntry: '(ParaId, AbridgedHrmpChannel)',
      SystemInherentData: 'ParachainInherentData',
      VecInboundHrmpMessage: 'Vec<InboundHrmpMessage>'
    })
  };

  const definitions$f = {
    rpc: {},
    types: {
      Approvals: '[bool; 4]'
    }
  };

  const definitions$e = {
    rpc: {},
    types: {
      AccountStatus: {
        validity: 'AccountValidity',
        freeBalance: 'Balance',
        lockedBalance: 'Balance',
        signature: 'Vec<u8>',
        vat: 'Permill'
      },
      AccountValidity: {
        _enum: ['Invalid', 'Initiated', 'Pending', 'ValidLow', 'ValidHigh', 'Completed']
      }
    }
  };

  exports.TypeDefInfo = void 0;
  (function (TypeDefInfo) {
    TypeDefInfo[TypeDefInfo["BTreeMap"] = 0] = "BTreeMap";
    TypeDefInfo[TypeDefInfo["BTreeSet"] = 1] = "BTreeSet";
    TypeDefInfo[TypeDefInfo["Compact"] = 2] = "Compact";
    TypeDefInfo[TypeDefInfo["DoNotConstruct"] = 3] = "DoNotConstruct";
    TypeDefInfo[TypeDefInfo["Enum"] = 4] = "Enum";
    TypeDefInfo[TypeDefInfo["HashMap"] = 5] = "HashMap";
    TypeDefInfo[TypeDefInfo["Int"] = 6] = "Int";
    TypeDefInfo[TypeDefInfo["Linkage"] = 7] = "Linkage";
    TypeDefInfo[TypeDefInfo["Null"] = 8] = "Null";
    TypeDefInfo[TypeDefInfo["Option"] = 9] = "Option";
    TypeDefInfo[TypeDefInfo["Plain"] = 10] = "Plain";
    TypeDefInfo[TypeDefInfo["Range"] = 11] = "Range";
    TypeDefInfo[TypeDefInfo["RangeInclusive"] = 12] = "RangeInclusive";
    TypeDefInfo[TypeDefInfo["Result"] = 13] = "Result";
    TypeDefInfo[TypeDefInfo["Set"] = 14] = "Set";
    TypeDefInfo[TypeDefInfo["Si"] = 15] = "Si";
    TypeDefInfo[TypeDefInfo["Struct"] = 16] = "Struct";
    TypeDefInfo[TypeDefInfo["Tuple"] = 17] = "Tuple";
    TypeDefInfo[TypeDefInfo["UInt"] = 18] = "UInt";
    TypeDefInfo[TypeDefInfo["Vec"] = 19] = "Vec";
    TypeDefInfo[TypeDefInfo["VecFixed"] = 20] = "VecFixed";
    TypeDefInfo[TypeDefInfo["WrapperKeepOpaque"] = 21] = "WrapperKeepOpaque";
    TypeDefInfo[TypeDefInfo["WrapperOpaque"] = 22] = "WrapperOpaque";
  })(exports.TypeDefInfo || (exports.TypeDefInfo = {}));

  function hasEq(o) {
    return util.isFunction(o.eq);
  }

  function compareArray(a, b) {
    if (Array.isArray(b)) {
      return a.length === b.length && util.isUndefined(a.find((v, index) => hasEq(v) ? !v.eq(b[index]) : v !== b[index]));
    }
    return false;
  }

  class AbstractArray extends Array {
    static get [Symbol.species]() {
      return Array;
    }
    constructor(registry, length) {
      super(length);
      this.registry = registry;
    }
    get encodedLength() {
      let total = util.compactToU8a(this.length).length;
      for (let i = 0; i < this.length; i++) {
        total += this[i].encodedLength;
      }
      return total;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.length === 0;
    }
    get length() {
      return super.length;
    }
    eq(other) {
      return compareArray(this, other);
    }
    inspect() {
      return {
        inner: this.inspectInner(),
        outer: [util.compactToU8a(this.length)]
      };
    }
    inspectInner() {
      const inner = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        inner[i] = this[i].inspect();
      }
      return inner;
    }
    toArray() {
      return Array.from(this);
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman(isExtended) {
      const result = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        result[i] = this[i] && this[i].toHuman(isExtended);
      }
      return result;
    }
    toJSON() {
      const result = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        result[i] = this[i] && this[i].toJSON();
      }
      return result;
    }
    toPrimitive() {
      const result = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        result[i] = this[i] && this[i].toPrimitive();
      }
      return result;
    }
    toString() {
      const result = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        result[i] = this[i].toString();
      }
      return `[${result.join(', ')}]`;
    }
    toU8a(isBare) {
      const encoded = this.toU8aInner();
      return isBare ? util.u8aConcatStrict(encoded) : util.u8aConcatStrict([util.compactToU8a(this.length), ...encoded]);
    }
    toU8aInner(isBare) {
      const encoded = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        encoded[i] = this[i].toU8a(isBare);
      }
      return encoded;
    }
  }

  class AbstractBase {
    #raw;
    constructor(registry, value, initialU8aLength) {
      this.#raw = value;
      this.initialU8aLength = initialU8aLength;
      this.registry = registry;
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get inner() {
      return this.#raw;
    }
    get isEmpty() {
      return this.#raw.isEmpty;
    }
    eq(other) {
      return this.#raw.eq(other);
    }
    inspect() {
      return this.#raw.inspect();
    }
    toHex(isLe) {
      return this.#raw.toHex(isLe);
    }
    toHuman(isExtended) {
      return this.#raw.toHuman(isExtended);
    }
    toJSON() {
      return this.#raw.toJSON();
    }
    toPrimitive() {
      return this.#raw.toPrimitive();
    }
    toString() {
      return this.#raw.toString();
    }
    toU8a(isBare) {
      return this.#raw.toU8a(isBare);
    }
    toRawType() {
      return 'Base';
    }
    unwrap() {
      return this.#raw;
    }
  }

  const DEFAULT_UINT_BITS = 64;
  const MAX_NUMBER_BITS = 52;
  const MUL_P = new util.BN(10000);
  const FORMATTERS = [['Perquintill', util.BN_QUINTILL], ['Perbill', util.BN_BILLION], ['Permill', util.BN_MILLION], ['Percent', util.BN_HUNDRED]];
  function toPercentage(value, divisor) {
    return `${(value.mul(MUL_P).div(divisor).toNumber() / 100).toFixed(2)}%`;
  }
  function decodeAbstractInt(value, isNegative) {
    if (util.isNumber(value)) {
      if (!Number.isInteger(value) || value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
        throw new Error('Number needs to be an integer <= Number.MAX_SAFE_INTEGER, i.e. 2 ^ 53 - 1');
      }
      return value;
    } else if (util.isString(value)) {
      if (util.isHex(value, -1, true)) {
        return util.hexToBn(value, {
          isLe: false,
          isNegative
        }).toString();
      }
      if (value.includes('.') || value.includes(',') || value.includes('e')) {
        throw new Error('String should not contain decimal points or scientific notation');
      }
      return value;
    } else if (util.isBn(value)) {
      return value.toString();
    } else if (util.isObject(value) && !util.isFunction(value.toBn)) {
      const keys = Object.keys(value);
      if (keys.length !== 1) {
        throw new Error('Unable to construct number from multi-key object');
      }
      const inner = value[keys[0]];
      if (!util.isString(inner) && !util.isNumber(inner)) {
        throw new Error('Unable to construct from object with non-string/non-number value');
      }
      return decodeAbstractInt(inner, isNegative);
    }
    return util.bnToBn(value).toString();
  }
  class AbstractInt extends util.BN {
    #bitLength;
    constructor(registry, value = 0, bitLength = DEFAULT_UINT_BITS, isSigned = false) {
      super(
      util.isU8a(value) ? bitLength <= 48 ? util.u8aToNumber(value.subarray(0, bitLength / 8), {
        isNegative: isSigned
      }) : util.u8aToBn(value.subarray(0, bitLength / 8), {
        isLe: true,
        isNegative: isSigned
      }).toString() : decodeAbstractInt(value, isSigned));
      this.registry = registry;
      this.#bitLength = bitLength;
      this.encodedLength = this.#bitLength / 8;
      this.isUnsigned = !isSigned;
      const isNegative = this.isNeg();
      const maxBits = bitLength - (isSigned && !isNegative ? 1 : 0);
      if (isNegative && !isSigned) {
        throw new Error(`${this.toRawType()}: Negative number passed to unsigned type`);
      } else if (super.bitLength() > maxBits) {
        throw new Error(`${this.toRawType()}: Input too large. Found input with ${super.bitLength()} bits, expected ${maxBits}`);
      }
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.isZero();
    }
    bitLength() {
      return this.#bitLength;
    }
    eq(other) {
      return super.eq(util.isHex(other) ? util.hexToBn(other.toString(), {
        isLe: false,
        isNegative: !this.isUnsigned
      }) : util.bnToBn(other));
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    isMax() {
      const u8a = this.toU8a().filter(b => b === 0xff);
      return u8a.length === this.#bitLength / 8;
    }
    toBigInt() {
      return BigInt(this.toString());
    }
    toBn() {
      return this;
    }
    toHex(isLe = false) {
      return util.bnToHex(this, {
        bitLength: this.bitLength(),
        isLe,
        isNegative: !this.isUnsigned
      });
    }
    toHuman(isExpanded) {
      const rawType = this.toRawType();
      if (rawType === 'Balance') {
        return this.isMax() ? 'everything'
        : util.formatBalance(this, {
          decimals: this.registry.chainDecimals[0],
          withSi: true,
          withUnit: this.registry.chainTokens[0]
        });
      }
      const [, divisor] = FORMATTERS.find(([type]) => type === rawType) || [];
      return divisor ? toPercentage(this, divisor) : util.formatNumber(this);
    }
    toJSON(onlyHex = false) {
      return onlyHex || super.bitLength() > MAX_NUMBER_BITS ? this.toHex() : this.toNumber();
    }
    toPrimitive() {
      return super.bitLength() > MAX_NUMBER_BITS ? this.toString() : this.toNumber();
    }
    toRawType() {
      return this instanceof this.registry.createClassUnsafe('Balance') ? 'Balance' : `${this.isUnsigned ? 'u' : 'i'}${this.bitLength()}`;
    }
    toString(base) {
      return super.toString(base);
    }
    toU8a(isBare) {
      return util.bnToU8a(this, {
        bitLength: this.bitLength(),
        isLe: true,
        isNegative: !this.isUnsigned
      });
    }
  }

  function hasMismatch(a, b) {
    return util.isUndefined(a) || (hasEq(a) ? !a.eq(b) : a !== b);
  }
  function notEntry(value) {
    return !Array.isArray(value) || value.length !== 2;
  }
  function compareMapArray(a, b) {
    return a.size === b.length && !b.some(e => notEntry(e) || hasMismatch(a.get(e[0]), e[1]));
  }
  function compareMap(a, b) {
    if (Array.isArray(b)) {
      return compareMapArray(a, b);
    } else if (b instanceof Map) {
      return compareMapArray(a, [...b.entries()]);
    } else if (util.isObject(b)) {
      return compareMapArray(a, Object.entries(b));
    }
    return false;
  }

  function compareSetArray(a, b) {
    return a.size === b.length && !b.some(e => !a.has(e));
  }
  function compareSet(a, b) {
    if (Array.isArray(b)) {
      return compareSetArray(a, b);
    } else if (b instanceof Set) {
      return compareSetArray(a, [...b.values()]);
    } else if (util.isObject(b)) {
      return compareSetArray(a, Object.values(b));
    }
    return false;
  }

  function formatFailure(registry, result, {
    message
  }, u8a, i, count, Type, key) {
    let type = '';
    try {
      type = `: ${new Type(registry).toRawType()}`;
    } catch {
    }
    return `decodeU8a: failed at ${util.u8aToHex(u8a.subarray(0, 16))}…${key ? ` on ${key}` : ''} (index ${i}/${count})${type}:: ${message}`;
  }
  function decodeU8a$6(registry, result, u8a, [Types, keys]) {
    const count = result.length;
    let offset = 0;
    let i = 0;
    try {
      while (i < count) {
        const value = new Types[i](registry, u8a.subarray(offset));
        offset += value.initialU8aLength || value.encodedLength;
        result[i] = value;
        i++;
      }
    } catch (error) {
      throw new Error(formatFailure(registry, result, error, u8a.subarray(offset), i, count, Types[i], keys[i]));
    }
    return [result, offset];
  }
  function decodeU8aStruct(registry, result, u8a, [Types, keys]) {
    const count = result.length;
    let offset = 0;
    let i = 0;
    try {
      while (i < count) {
        const value = new Types[i](registry, u8a.subarray(offset));
        offset += value.initialU8aLength || value.encodedLength;
        result[i] = [keys[i], value];
        i++;
      }
    } catch (error) {
      throw new Error(formatFailure(registry, result, error, u8a.subarray(offset), i, count, Types[i], keys[i]));
    }
    return [result, offset];
  }
  function decodeU8aVec(registry, result, u8a, startAt, Type) {
    const count = result.length;
    let offset = startAt;
    let i = 0;
    try {
      while (i < count) {
        const value = new Type(registry, u8a.subarray(offset));
        offset += value.initialU8aLength || value.encodedLength;
        result[i] = value;
        i++;
      }
    } catch (error) {
      throw new Error(formatFailure(registry, result, error, u8a.subarray(offset), i, count, Type));
    }
    return [offset, offset - startAt];
  }

  function typeToConstructor(registry, type) {
    return util.isString(type) ? registry.createClassUnsafe(type) : type;
  }

  function mapToTypeMap(registry, input) {
    const entries = Object.entries(input);
    const count = entries.length;
    const output = [new Array(count), new Array(count)];
    for (let i = 0; i < count; i++) {
      output[1][i] = entries[i][0];
      output[0][i] = typeToConstructor(registry, entries[i][1]);
    }
    return output;
  }

  const BOUNDED = ['BTreeMap', 'BTreeSet', 'HashMap', 'Vec'];
  const ALLOWED_BOXES = BOUNDED.concat(['Compact', 'DoNotConstruct', 'Int', 'Linkage', 'Range', 'RangeInclusive', 'Result', 'Opaque', 'Option', 'UInt', 'WrapperKeepOpaque', 'WrapperOpaque']);
  const BOX_PRECEDING = ['<', '(', '[', '"', ',', ' '];
  const mappings = [
  alias('<T::InherentOfflineReport as InherentOfflineReport>::Inherent', 'InherentOfflineReport', false), alias('VecDeque<', 'Vec<', false),
  cleanupCompact(),
  removeExtensions('Bounded', true),
  removeExtensions('Weak', false),
  removeTraits(),
  removePairOf(),
  removeWrap('Box<'),
  removeGenerics(),
  alias('String', 'Text'),
  alias('Vec<u8>', 'Bytes'), alias('&\\[u8\\]', 'Bytes'), alias("&'static\\[u8\\]", 'Bytes'),
  alias('RawAddress', 'Address'),
  alias('Lookup::Source', 'LookupSource'), alias('Lookup::Target', 'LookupTarget'),
  alias('exec::StorageKey', 'ContractStorageKey'),
  flattenSingleTuple(),
  removeColons(),
  trim()];
  function trim() {
    return value => value.trim();
  }
  function findClosing(value, start) {
    let depth = 0;
    for (let index = start; index < value.length; index++) {
      if (value[index] === '>') {
        if (!depth) {
          return index;
        }
        depth--;
      } else if (value[index] === '<') {
        depth++;
      }
    }
    throw new Error(`Unable to find closing matching <> on '${value}' (start ${start})`);
  }
  function alias(src, dest, withChecks = true) {
    const from = new RegExp(`(^${src}|${BOX_PRECEDING.map(box => `\\${box}${src}`).join('|')})`, 'g');
    const to = src => {
      from.lastIndex = 0;
      return withChecks && BOX_PRECEDING.includes(src[0]) ? `${src[0]}${dest}` : dest;
    };
    return value => value.replace(from, to);
  }
  function cleanupCompact() {
    return value => {
      if (value.includes(' as HasCompact')) {
        for (let index = 0; index < value.length; index++) {
          if (value[index] === '<') {
            const end = findClosing(value, index + 1) - 14;
            if (value.substring(end, end + 14) === ' as HasCompact') {
              value = `Compact<${value.substring(index + 1, end)}>`;
            }
          }
        }
      }
      return value;
    };
  }
  function flattenSingleTuple() {
    const from1 = /,\)/g;
    const from2 = /\(([^,]+)\)/;
    return value => {
      from1.lastIndex = 0;
      return value
      .replace(from1, ')')
      .replace(from2, '$1');
    };
  }
  function replaceTagWith(value, matcher, replacer) {
    let index = -1;
    while (true) {
      index = value.indexOf(matcher, index + 1);
      if (index === -1) {
        return value;
      }
      const start = index + matcher.length;
      const end = findClosing(value, start);
      value = `${value.substring(0, index)}${replacer(value.substring(start, end))}${value.substring(end + 1)}`;
    }
  }
  function removeExtensions(type, isSized) {
    return value => {
      for (let i = 0; i < BOUNDED.length; i++) {
        const tag = BOUNDED[i];
        value = replaceTagWith(value, `${type}${tag}<`, v => {
          const parts = v.split(',').map(s => s.trim()).filter(s => s);
          if (isSized) {
            parts.pop();
          }
          return `${tag}<${parts.join(',')}>`;
        });
      }
      return value;
    };
  }
  function removeColons() {
    return value => {
      let index = 0;
      while (index !== -1) {
        index = value.indexOf('::');
        if (index === 0) {
          value = value.substring(2);
        } else if (index !== -1) {
          let start = index;
          while (start !== -1 && !BOX_PRECEDING.includes(value[start])) {
            start--;
          }
          value = `${value.substring(0, start + 1)}${value.substring(index + 2)}`;
        }
      }
      return value;
    };
  }
  function removeGenerics() {
    return value => {
      for (let index = 0; index < value.length; index++) {
        if (value[index] === '<') {
          const box = ALLOWED_BOXES.find(box => {
            const start = index - box.length;
            return start >= 0 && value.substring(start, index) === box && (
            start === 0 || BOX_PRECEDING.includes(value[start - 1]));
          });
          if (!box) {
            const end = findClosing(value, index + 1);
            value = `${value.substring(0, index)}${value.substring(end + 1)}`;
          }
        }
      }
      return value;
    };
  }
  function removePairOf() {
    const replacer = v => `(${v},${v})`;
    return value => replaceTagWith(value, 'PairOf<', replacer);
  }
  function removeTraits() {
    const from1 = /\s/g;
    const from2 = /(T|Self)::/g;
    const from3 = /<(T|Self)asTrait>::/g;
    const from4 = /<Tas[a-z]+::Trait>::/g;
    const from5 = /<LookupasStaticLookup>/g;
    const from6 = /::Type/g;
    return value => {
      from1.lastIndex = 0;
      from2.lastIndex = 0;
      from3.lastIndex = 0;
      from4.lastIndex = 0;
      from5.lastIndex = 0;
      from6.lastIndex = 0;
      return value
      .replace(from1, '')
      .replace(from2, '')
      .replace(from3, '')
      .replace(from4, '')
      .replace(from5, 'Lookup')
      .replace(from6, '');
    };
  }
  function removeWrap(check) {
    const replacer = v => v;
    return value => replaceTagWith(value, check, replacer);
  }
  const sanitizeMap = new Map();
  function sanitize(value) {
    const startValue = value.toString();
    const memoized = sanitizeMap.get(startValue);
    if (memoized) {
      return memoized;
    }
    let result = startValue;
    for (let i = 0; i < mappings.length; i++) {
      result = mappings[i](result);
    }
    sanitizeMap.set(startValue, result);
    return result;
  }

  function isArrayLike(arg) {
    return arg instanceof Uint8Array || Array.isArray(arg);
  }
  function isCodec(arg) {
    return util.isFunction(arg && arg.toU8a);
  }
  function isEnum(arg) {
    return isCodec(arg) && util.isNumber(arg.index) && isCodec(arg.value);
  }
  function isNumberLike(arg) {
    return util.isNumber(arg) || util.isBn(arg) || util.isBigInt(arg);
  }
  function sortArray(a, b) {
    let sortRes = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; ++i) {
      sortRes = sortAsc(a[i], b[i]);
      if (sortRes !== 0) {
        return sortRes;
      }
    }
    return a.length - b.length;
  }
  function sortAsc(a, b) {
    if (isNumberLike(a) && isNumberLike(b)) {
      return util.bnToBn(a).cmp(util.bnToBn(b));
    } else if (a instanceof Map && b instanceof Map) {
      return sortAsc(Array.from(a.values()), Array.from(b.values()));
    } else if (isEnum(a) && isEnum(b)) {
      return sortAsc(a.index, b.index) || sortAsc(a.value, b.value);
    } else if (isArrayLike(a) && isArrayLike(b)) {
      return sortArray(a, b);
    } else if (isCodec(a) && isCodec(b)) {
      return sortAsc(a.toU8a(true), b.toU8a(true));
    }
    throw new Error(`Attempting to sort unrecognized values: ${util.stringify(a)} (typeof ${typeof a}) <-> ${util.stringify(b)} (typeof ${typeof b})`);
  }
  function sortSet(set) {
    return new Set(Array.from(set).sort(sortAsc));
  }
  function sortMap(map) {
    return new Map(Array.from(map.entries()).sort(([keyA], [keyB]) => sortAsc(keyA, keyB)));
  }

  function typesToMap(registry, [Types, keys]) {
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = registry.getClassName(Types[i]) || new Types[i](registry).toRawType();
    }
    return result;
  }

  function noopSetDefinition$6(d) {
    return d;
  }
  function decodeCompact(registry, Type, value) {
    if (util.isU8a(value)) {
      const [decodedLength, bn] = (value[0] & 0b11) < 0b11 ? util.compactFromU8aLim(value) : util.compactFromU8a(value);
      return [new Type(registry, bn), decodedLength];
    } else if (value instanceof Compact) {
      const raw = value.unwrap();
      return raw instanceof Type ? [raw, 0] : [new Type(registry, raw), 0];
    } else if (value instanceof Type) {
      return [value, 0];
    }
    return [new Type(registry, value), 0];
  }
  class Compact {
    #Type;
    #raw;
    constructor(registry, Type, value = 0, {
      definition,
      setDefinition = noopSetDefinition$6
    } = {}) {
      this.registry = registry;
      this.#Type = definition || setDefinition(typeToConstructor(registry, Type));
      const [raw, decodedLength] = decodeCompact(registry, this.#Type, value);
      this.initialU8aLength = decodedLength;
      this.#raw = raw;
    }
    static with(Type) {
      let definition;
      const setDefinition = d => definition = d;
      return class extends Compact {
        constructor(registry, value) {
          super(registry, Type, value, {
            definition,
            setDefinition
          });
        }
      };
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.#raw.isEmpty;
    }
    bitLength() {
      return this.#raw.bitLength();
    }
    eq(other) {
      return this.#raw.eq(other instanceof Compact ? other.#raw : other);
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toBigInt() {
      return this.#raw.toBigInt();
    }
    toBn() {
      return this.#raw.toBn();
    }
    toHex(isLe) {
      return this.#raw.toHex(isLe);
    }
    toHuman(isExtended) {
      return this.#raw.toHuman(isExtended);
    }
    toJSON() {
      return this.#raw.toJSON();
    }
    toNumber() {
      return this.#raw.toNumber();
    }
    toPrimitive() {
      return this.#raw.toPrimitive();
    }
    toRawType() {
      return `Compact<${this.registry.getClassName(this.#Type) || this.#raw.toRawType()}>`;
    }
    toString() {
      return this.#raw.toString();
    }
    toU8a(isBare) {
      return util.compactToU8a(this.#raw.toBn());
    }
    unwrap() {
      return this.#raw;
    }
  }

  class DoNotConstruct {
    #neverError;
    constructor(registry, typeName = 'DoNotConstruct') {
      this.registry = registry;
      this.#neverError = new Error(`DoNotConstruct: Cannot construct unknown type ${typeName}`);
      throw this.#neverError;
    }
    static with(typeName) {
      return class extends DoNotConstruct {
        constructor(registry) {
          super(registry, typeName);
        }
      };
    }
    get encodedLength() {
      throw this.#neverError;
    }
    get hash() {
      throw this.#neverError;
    }
    get isEmpty() {
      throw this.#neverError;
    }
    eq() {
      throw this.#neverError;
    }
    inspect() {
      throw this.#neverError;
    }
    toHex() {
      throw this.#neverError;
    }
    toHuman() {
      throw this.#neverError;
    }
    toJSON() {
      throw this.#neverError;
    }
    toPrimitive() {
      throw this.#neverError;
    }
    toRawType() {
      throw this.#neverError;
    }
    toString() {
      throw this.#neverError;
    }
    toU8a() {
      throw this.#neverError;
    }
  }

  class Null {
    encodedLength = 0;
    isEmpty = true;
    initialU8aLength = 0;
    constructor(registry) {
      this.registry = registry;
    }
    get hash() {
      throw new Error('.hash is not implemented on Null');
    }
    eq(other) {
      return other instanceof Null || util.isNull(other);
    }
    inspect() {
      return {};
    }
    toHex() {
      return '0x';
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return null;
    }
    toPrimitive() {
      return null;
    }
    toRawType() {
      return 'Null';
    }
    toString() {
      return '';
    }
    toU8a(isBare) {
      return new Uint8Array();
    }
  }

  function noopSetDefinition$5(d) {
    return d;
  }
  function isRustEnum$1(def) {
    const defValues = Object.values(def);
    if (defValues.some(v => util.isNumber(v))) {
      if (!defValues.every(v => util.isNumber(v) && v >= 0 && v <= 255)) {
        throw new Error('Invalid number-indexed enum definition');
      }
      return false;
    }
    return true;
  }
  function extractDef(registry, _def) {
    const def = {};
    let isBasic;
    let isIndexed;
    if (Array.isArray(_def)) {
      for (let i = 0; i < _def.length; i++) {
        def[_def[i]] = {
          Type: Null,
          index: i
        };
      }
      isBasic = true;
      isIndexed = false;
    } else if (isRustEnum$1(_def)) {
      const [Types, keys] = mapToTypeMap(registry, _def);
      for (let i = 0; i < keys.length; i++) {
        def[keys[i]] = {
          Type: Types[i],
          index: i
        };
      }
      isBasic = !Object.values(def).some(({
        Type
      }) => Type !== Null);
      isIndexed = false;
    } else {
      const entries = Object.entries(_def);
      for (let i = 0; i < entries.length; i++) {
        const [key, index] = entries[i];
        def[key] = {
          Type: Null,
          index
        };
      }
      isBasic = true;
      isIndexed = true;
    }
    return {
      def,
      isBasic,
      isIndexed
    };
  }
  function getEntryType(def, checkIdx) {
    const values = Object.values(def);
    for (let i = 0; i < values.length; i++) {
      const {
        Type,
        index
      } = values[i];
      if (index === checkIdx) {
        return Type;
      }
    }
    throw new Error(`Unable to create Enum via index ${checkIdx}, in ${Object.keys(def).join(', ')}`);
  }
  function createFromU8a(registry, def, index, value) {
    const Type = getEntryType(def, index);
    return {
      index,
      value: new Type(registry, value)
    };
  }
  function createFromValue(registry, def, index = 0, value) {
    const Type = getEntryType(def, index);
    return {
      index,
      value: value instanceof Type ? value : new Type(registry, value)
    };
  }
  function decodeFromJSON(registry, def, key, value) {
    const keys = Object.keys(def).map(k => k.toLowerCase());
    const keyLower = key.toLowerCase();
    const index = keys.indexOf(keyLower);
    if (index === -1) {
      throw new Error(`Cannot map Enum JSON, unable to find '${key}' in ${keys.join(', ')}`);
    }
    try {
      return createFromValue(registry, def, Object.values(def)[index].index, value);
    } catch (error) {
      throw new Error(`Enum(${key}):: ${error.message}`);
    }
  }
  function decodeEnum(registry, def, value, index) {
    if (util.isNumber(index)) {
      return createFromValue(registry, def, index, value);
    } else if (util.isU8a(value) || util.isHex(value)) {
      const u8a = util.u8aToU8a(value);
      if (u8a.length) {
        return createFromU8a(registry, def, u8a[0], u8a.subarray(1));
      }
    } else if (value instanceof Enum) {
      return createFromValue(registry, def, value.index, value.value);
    } else if (util.isNumber(value)) {
      return createFromValue(registry, def, value);
    } else if (util.isString(value)) {
      return decodeFromJSON(registry, def, value.toString());
    } else if (util.isObject(value)) {
      const key = Object.keys(value)[0];
      return decodeFromJSON(registry, def, key, value[key]);
    }
    return createFromValue(registry, def, Object.values(def)[0].index);
  }
  class Enum {
    #def;
    #entryIndex;
    #indexes;
    #isBasic;
    #isIndexed;
    #raw;
    constructor(registry, Types, value, index, {
      definition,
      setDefinition = noopSetDefinition$5
    } = {}) {
      const {
        def,
        isBasic,
        isIndexed
      } = definition || setDefinition(extractDef(registry, Types));
      const decoded = util.isU8a(value) && value.length && !util.isNumber(index) ? createFromU8a(registry, def, value[0], value.subarray(1)) : decodeEnum(registry, def, value, index);
      this.registry = registry;
      this.#def = def;
      this.#isBasic = isBasic;
      this.#isIndexed = isIndexed;
      this.#indexes = Object.values(def).map(({
        index
      }) => index);
      this.#entryIndex = this.#indexes.indexOf(decoded.index);
      this.#raw = decoded.value;
      if (this.#raw.initialU8aLength) {
        this.initialU8aLength = 1 + this.#raw.initialU8aLength;
      }
    }
    static with(Types) {
      var _class;
      let definition;
      const setDefinition = d => definition = d;
      return _class = class extends Enum {
        constructor(registry, value, index) {
          super(registry, Types, value, index, {
            definition,
            setDefinition
          });
        }
      }, (() => {
        const keys = Array.isArray(Types) ? Types : Object.keys(Types);
        const asKeys = new Array(keys.length);
        const isKeys = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
          const name = util.stringPascalCase(keys[i]);
          asKeys[i] = `as${name}`;
          isKeys[i] = `is${name}`;
        }
        util.objectProperties(_class.prototype, isKeys, (_, i, self) => self.type === keys[i]);
        util.objectProperties(_class.prototype, asKeys, (k, i, self) => {
          if (self.type !== keys[i]) {
            throw new Error(`Cannot convert '${self.type}' via ${k}`);
          }
          return self.value;
        });
      })(), _class;
    }
    get encodedLength() {
      return 1 + this.#raw.encodedLength;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get index() {
      return this.#indexes[this.#entryIndex];
    }
    get inner() {
      return this.#raw;
    }
    get isBasic() {
      return this.#isBasic;
    }
    get isEmpty() {
      return this.#raw.isEmpty;
    }
    get isNone() {
      return this.#raw instanceof Null;
    }
    get defIndexes() {
      return this.#indexes;
    }
    get defKeys() {
      return Object.keys(this.#def);
    }
    get type() {
      return this.defKeys[this.#entryIndex];
    }
    get value() {
      return this.#raw;
    }
    eq(other) {
      if (util.isU8a(other)) {
        return !this.toU8a().some((entry, index) => entry !== other[index]);
      } else if (util.isNumber(other)) {
        return this.toNumber() === other;
      } else if (this.#isBasic && util.isString(other)) {
        return this.type === other;
      } else if (util.isHex(other)) {
        return this.toHex() === other;
      } else if (other instanceof Enum) {
        return this.index === other.index && this.value.eq(other.value);
      } else if (util.isObject(other)) {
        return this.value.eq(other[this.type]);
      }
      return this.value.eq(other);
    }
    inspect() {
      if (this.#isBasic) {
        return {
          outer: [new Uint8Array([this.index])]
        };
      }
      const {
        inner,
        outer = []
      } = this.#raw.inspect();
      return {
        inner,
        outer: [new Uint8Array([this.index]), ...outer]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman(isExtended) {
      return this.#isBasic || this.isNone ? this.type : {
        [this.type]: this.#raw.toHuman(isExtended)
      };
    }
    toJSON() {
      return this.#isBasic ? this.type : {
        [util.stringCamelCase(this.type)]: this.#raw.toJSON()
      };
    }
    toNumber() {
      return this.index;
    }
    toPrimitive() {
      return this.#isBasic ? this.type : {
        [util.stringCamelCase(this.type)]: this.#raw.toPrimitive()
      };
    }
    _toRawStruct() {
      if (this.#isBasic) {
        return this.#isIndexed ? this.defKeys.reduce((out, key, index) => {
          out[key] = this.#indexes[index];
          return out;
        }, {}) : this.defKeys;
      }
      const entries = Object.entries(this.#def);
      return typesToMap(this.registry, entries.reduce((out, [key, {
        Type
      }], i) => {
        out[0][i] = Type;
        out[1][i] = key;
        return out;
      }, [new Array(entries.length), new Array(entries.length)]));
    }
    toRawType() {
      return util.stringify({
        _enum: this._toRawStruct()
      });
    }
    toString() {
      return this.isNone ? this.type : util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      return isBare ? this.#raw.toU8a(isBare) : util.u8aConcatStrict([new Uint8Array([this.index]), this.#raw.toU8a(isBare)]);
    }
  }

  class Int extends AbstractInt {
    constructor(registry, value = 0, bitLength) {
      super(registry, value, bitLength, true);
    }
    static with(bitLength, typeName) {
      return class extends Int {
        constructor(registry, value) {
          super(registry, value, bitLength);
        }
        toRawType() {
          return typeName || super.toRawType();
        }
      };
    }
  }

  function noopSetDefinition$4(d) {
    return d;
  }
  class None extends Null {
    toRawType() {
      return 'None';
    }
  }
  function decodeOption(registry, Type, value) {
    if (value instanceof Type) {
      return value;
    } else if (value instanceof Option) {
      if (value.value instanceof Type) {
        return value.value;
      } else if (value.isNone) {
        return new None(registry);
      }
      return new Type(registry, value.value);
    } else if (util.isNull(value) || util.isUndefined(value) || value === '0x' || value instanceof None) {
      return new None(registry);
    } else if (util.isU8a(value)) {
      return !value.length || value[0] === 0 ? new None(registry) : new Type(registry, value.subarray(1));
    }
    return new Type(registry, value);
  }
  class Option {
    #Type;
    #raw;
    constructor(registry, typeName, value, {
      definition,
      setDefinition = noopSetDefinition$4
    } = {}) {
      const Type = definition || setDefinition(typeToConstructor(registry, typeName));
      const decoded = util.isU8a(value) && value.length && !util.isCodec(value) ? value[0] === 0 ? new None(registry) : new Type(registry, value.subarray(1)) : decodeOption(registry, Type, value);
      this.registry = registry;
      this.#Type = Type;
      this.#raw = decoded;
      if (decoded && decoded.initialU8aLength) {
        this.initialU8aLength = 1 + decoded.initialU8aLength;
      }
    }
    static with(Type) {
      let definition;
      const setDefinition = d => {
        definition = d;
        return d;
      };
      return class extends Option {
        constructor(registry, value) {
          super(registry, Type, value, {
            definition,
            setDefinition
          });
        }
      };
    }
    get encodedLength() {
      return 1 + this.#raw.encodedLength;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.isNone;
    }
    get isNone() {
      return this.#raw instanceof None;
    }
    get isSome() {
      return !this.isNone;
    }
    get value() {
      return this.#raw;
    }
    eq(other) {
      if (other instanceof Option) {
        return this.isSome === other.isSome && this.value.eq(other.value);
      }
      return this.value.eq(other);
    }
    inspect() {
      if (this.isNone) {
        return {
          outer: [new Uint8Array([0])]
        };
      }
      const {
        inner,
        outer = []
      } = this.#raw.inspect();
      return {
        inner,
        outer: [new Uint8Array([1]), ...outer]
      };
    }
    toHex() {
      return this.isNone ? '0x' : util.u8aToHex(this.toU8a().subarray(1));
    }
    toHuman(isExtended) {
      return this.#raw.toHuman(isExtended);
    }
    toJSON() {
      return this.isNone ? null : this.#raw.toJSON();
    }
    toPrimitive() {
      return this.isNone ? null : this.#raw.toPrimitive();
    }
    toRawType(isBare) {
      const wrapped = this.registry.getClassName(this.#Type) || new this.#Type(this.registry).toRawType();
      return isBare ? wrapped : `Option<${wrapped}>`;
    }
    toString() {
      return this.#raw.toString();
    }
    toU8a(isBare) {
      if (isBare) {
        return this.#raw.toU8a(true);
      }
      const u8a = new Uint8Array(this.encodedLength);
      if (this.isSome) {
        u8a.set([1]);
        u8a.set(this.#raw.toU8a(), 1);
      }
      return u8a;
    }
    unwrap() {
      if (this.isNone) {
        throw new Error('Option: unwrapping a None value');
      }
      return this.#raw;
    }
    unwrapOr(defaultValue) {
      return this.isSome ? this.unwrap() : defaultValue;
    }
    unwrapOrDefault() {
      return this.isSome ? this.unwrap() : new this.#Type(this.registry);
    }
  }

  class Result extends Enum {
    constructor(registry, Ok, Err, value) {
      super(registry, {
        Ok,
        Err
      }, value);
    }
    static with(Types) {
      return class extends Result {
        constructor(registry, value) {
          super(registry, Types.Ok, Types.Err, value);
        }
      };
    }
    get asErr() {
      if (!this.isErr) {
        throw new Error('Cannot extract Err value from Ok result, check isErr first');
      }
      return this.value;
    }
    get asOk() {
      if (!this.isOk) {
        throw new Error('Cannot extract Ok value from Err result, check isOk first');
      }
      return this.value;
    }
    get isEmpty() {
      return this.isOk && this.value.isEmpty;
    }
    get isErr() {
      return !this.isOk;
    }
    get isOk() {
      return this.index === 0;
    }
    toRawType() {
      const Types = this._toRawStruct();
      return `Result<${Types.Ok},${Types.Err}>`;
    }
  }

  function noopSetDefinition$3(d) {
    return d;
  }
  function decodeTuple(registry, result, value, Classes) {
    if (util.isU8a(value) || util.isHex(value)) {
      return decodeU8a$6(registry, result, util.u8aToU8a(value), Classes);
    }
    const Types = Classes[0];
    for (let i = 0; i < Types.length; i++) {
      try {
        const entry = value === null || value === void 0 ? void 0 : value[i];
        result[i] = entry instanceof Types[i] ? entry : new Types[i](registry, entry);
      } catch (error) {
        throw new Error(`Tuple: failed on ${i}:: ${error.message}`);
      }
    }
    return [result, 0];
  }
  class Tuple extends AbstractArray {
    #Types;
    constructor(registry, Types, value, {
      definition,
      setDefinition = noopSetDefinition$3
    } = {}) {
      const Classes = definition || setDefinition(Array.isArray(Types) ? [Types.map(t => typeToConstructor(registry, t)), []] : util.isFunction(Types) || util.isString(Types) ? [[typeToConstructor(registry, Types)], []] : mapToTypeMap(registry, Types));
      super(registry, Classes[0].length);
      this.initialU8aLength = (util.isU8a(value) ? decodeU8a$6(registry, this, value, Classes) : decodeTuple(registry, this, value, Classes))[1];
      this.#Types = Classes;
    }
    static with(Types) {
      let definition;
      const setDefinition = d => definition = d;
      return class extends Tuple {
        constructor(registry, value) {
          super(registry, Types, value, {
            definition,
            setDefinition
          });
        }
      };
    }
    get encodedLength() {
      let total = 0;
      for (let i = 0; i < this.length; i++) {
        total += this[i].encodedLength;
      }
      return total;
    }
    get Types() {
      return this.#Types[1].length ? this.#Types[1] : this.#Types[0].map(T => new T(this.registry).toRawType());
    }
    inspect() {
      return {
        inner: this.inspectInner()
      };
    }
    toRawType() {
      const types = this.#Types[0].map(T => this.registry.getClassName(T) || new T(this.registry).toRawType());
      return `(${types.join(',')})`;
    }
    toString() {
      return util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      return util.u8aConcatStrict(this.toU8aInner(isBare));
    }
  }

  class UInt extends AbstractInt {
    static with(bitLength, typeName) {
      return class extends UInt {
        constructor(registry, value) {
          super(registry, value, bitLength);
        }
        toRawType() {
          return typeName || super.toRawType();
        }
      };
    }
  }

  const MAX_LENGTH$2 = 64 * 1024;
  const l$5 = util.logger('Vec');
  function noopSetDefinition$2(d) {
    return d;
  }
  function decodeVecLength(value) {
    if (Array.isArray(value)) {
      return [value, value.length, 0];
    }
    const u8a = util.u8aToU8a(value);
    const [startAt, length] = util.compactFromU8aLim(u8a);
    if (length > MAX_LENGTH$2) {
      throw new Error(`Vec length ${length.toString()} exceeds ${MAX_LENGTH$2}`);
    }
    return [u8a, length, startAt];
  }
  function decodeVec(registry, result, value, startAt, Type) {
    if (Array.isArray(value)) {
      const count = result.length;
      for (let i = 0; i < count; i++) {
        const entry = value[i];
        try {
          result[i] = entry instanceof Type ? entry : new Type(registry, entry);
        } catch (error) {
          l$5.error(`Unable to decode on index ${i}`, error.message);
          throw error;
        }
      }
      return [0, 0];
    }
    return decodeU8aVec(registry, result, util.u8aToU8a(value), startAt, Type);
  }
  class Vec extends AbstractArray {
    #Type;
    constructor(registry, Type, value = [], {
      definition,
      setDefinition = noopSetDefinition$2
    } = {}) {
      const [decodeFrom, length, startAt] = decodeVecLength(value);
      super(registry, length);
      this.#Type = definition || setDefinition(typeToConstructor(registry, Type));
      this.initialU8aLength = (util.isU8a(decodeFrom) ? decodeU8aVec(registry, this, decodeFrom, startAt, this.#Type) : decodeVec(registry, this, decodeFrom, startAt, this.#Type))[0];
    }
    static with(Type) {
      let definition;
      const setDefinition = d => definition = d;
      return class extends Vec {
        constructor(registry, value) {
          super(registry, Type, value, {
            definition,
            setDefinition
          });
        }
      };
    }
    get Type() {
      return this.#Type.name;
    }
    indexOf(_other) {
      const other = _other instanceof this.#Type ? _other : new this.#Type(this.registry, _other);
      for (let i = 0; i < this.length; i++) {
        if (other.eq(this[i])) {
          return i;
        }
      }
      return -1;
    }
    toRawType() {
      return `Vec<${this.registry.getClassName(this.#Type) || new this.#Type(this.registry).toRawType()}>`;
    }
  }

  function noopSetDefinition$1(d) {
    return d;
  }
  class VecFixed extends AbstractArray {
    #Type;
    constructor(registry, Type, length, value = [], {
      definition,
      setDefinition = noopSetDefinition$1
    } = {}) {
      super(registry, length);
      this.#Type = definition || setDefinition(typeToConstructor(registry, Type));
      this.initialU8aLength = (util.isU8a(value) ? decodeU8aVec(registry, this, value, 0, this.#Type) : decodeVec(registry, this, value, 0, this.#Type))[1];
    }
    static with(Type, length) {
      let definition;
      const setDefinition = d => definition = d;
      return class extends VecFixed {
        constructor(registry, value) {
          super(registry, Type, length, value, {
            definition,
            setDefinition
          });
        }
      };
    }
    get Type() {
      return new this.#Type(this.registry).toRawType();
    }
    get encodedLength() {
      let total = 0;
      for (let i = 0; i < this.length; i++) {
        total += this[i].encodedLength;
      }
      return total;
    }
    inspect() {
      return {
        inner: this.inspectInner()
      };
    }
    toU8a() {
      const encoded = this.toU8aInner();
      return encoded.length ? util.u8aConcatStrict(encoded) : new Uint8Array([]);
    }
    toRawType() {
      return `[${this.Type};${this.length}]`;
    }
  }

  class Raw extends Uint8Array {
    static get [Symbol.species]() {
      return Uint8Array;
    }
    constructor(registry, value, initialU8aLength) {
      super(util.u8aToU8a(value));
      this.registry = registry;
      this.initialU8aLength = initialU8aLength;
    }
    get encodedLength() {
      return this.length;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isAscii() {
      return util.isAscii(this);
    }
    get isEmpty() {
      return !this.length || util.isUndefined(this.find(b => !!b));
    }
    get isUtf8() {
      return util.isUtf8(this);
    }
    bitLength() {
      return this.length * 8;
    }
    eq(other) {
      if (other instanceof Uint8Array) {
        return this.length === other.length && !this.some((b, index) => b !== other[index]);
      }
      return this.eq(util.u8aToU8a(other));
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toHex() {
      return util.u8aToHex(this);
    }
    toHuman() {
      return this.toPrimitive();
    }
    toJSON() {
      return this.toHex();
    }
    toPrimitive() {
      if (this.isAscii) {
        const text = this.toUtf8();
        if (util.isAscii(text)) {
          return text;
        }
      }
      return this.toJSON();
    }
    toRawType() {
      return 'Raw';
    }
    toString() {
      return this.toHex();
    }
    toU8a(isBare) {
      return Uint8Array.from(this);
    }
    toUtf8() {
      if (!this.isUtf8) {
        throw new Error('The character sequence is not a valid Utf8 string');
      }
      return util.u8aToString(this);
    }
  }

  function decodeBitVecU8a(value) {
    if (!value || !value.length) {
      return [0, new Uint8Array()];
    }
    const [offset, length] = util.compactFromU8aLim(value);
    const total = offset + Math.ceil(length / 8);
    if (total > value.length) {
      throw new Error(`BitVec: required length less than remainder, expected at least ${total}, found ${value.length}`);
    }
    return [length, value.subarray(offset, total)];
  }
  function decodeBitVec(value) {
    if (Array.isArray(value) || util.isString(value)) {
      const u8a = util.u8aToU8a(value);
      return [u8a.length / 8, u8a];
    }
    return decodeBitVecU8a(value);
  }
  class BitVec extends Raw {
    #decodedLength;
    #isMsb;
    constructor(registry, value, isMsb = false) {
      const [decodedLength, u8a] = decodeBitVec(value);
      super(registry, u8a);
      this.#decodedLength = decodedLength;
      this.#isMsb = isMsb;
    }
    get encodedLength() {
      return this.length + util.compactToU8a(this.#decodedLength).length;
    }
    inspect() {
      return {
        outer: [util.compactToU8a(this.#decodedLength), super.toU8a()]
      };
    }
    toHuman() {
      return `0b${[...this.toU8a(true)].map(d => `00000000${d.toString(2)}`.slice(-8)).map(s => this.#isMsb ? s : s.split('').reverse().join('')).join('_')}`;
    }
    toRawType() {
      return 'BitVec';
    }
    toU8a(isBare) {
      const bitVec = super.toU8a();
      return isBare ? bitVec : util.u8aConcatStrict([util.compactToU8a(this.#decodedLength), bitVec]);
    }
  }

  function noopSetDefinition(d) {
    return d;
  }
  function decodeStructFromObject(registry, [Types, keys], value, jsonMap) {
    let jsonObj;
    const typeofArray = Array.isArray(value);
    const typeofMap = value instanceof Map;
    if (!typeofArray && !typeofMap && !util.isObject(value)) {
      throw new Error(`Struct: Cannot decode value ${util.stringify(value)} (typeof ${typeof value}), expected an input object, map or array`);
    } else if (typeofArray && value.length !== keys.length) {
      throw new Error(`Struct: Unable to map ${util.stringify(value)} array to object with known keys ${keys.join(', ')}`);
    }
    const raw = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const jsonKey = jsonMap.get(key) || key;
      const Type = Types[i];
      let assign;
      try {
        if (typeofArray) {
          assign = value[i];
        } else if (typeofMap) {
          assign = jsonKey && value.get(jsonKey);
        } else {
          assign = jsonKey && value[jsonKey];
          if (util.isUndefined(assign)) {
            if (util.isUndefined(jsonObj)) {
              const entries = Object.entries(value);
              jsonObj = {};
              for (let e = 0; e < entries.length; e++) {
                jsonObj[util.stringCamelCase(entries[e][0])] = entries[e][1];
              }
            }
            assign = jsonKey && jsonObj[jsonKey];
          }
        }
        raw[i] = [key, assign instanceof Type ? assign : new Type(registry, assign)];
      } catch (error) {
        let type = Type.name;
        try {
          type = new Type(registry).toRawType();
        } catch (error) {
        }
        throw new Error(`Struct: failed on ${jsonKey}: ${type}:: ${error.message}`);
      }
    }
    return [raw, 0];
  }
  class Struct extends Map {
    #jsonMap;
    #Types;
    constructor(registry, Types, value, jsonMap = new Map(), {
      definition,
      setDefinition = noopSetDefinition
    } = {}) {
      const typeMap = definition || setDefinition(mapToTypeMap(registry, Types));
      const [decoded, decodedLength] = util.isU8a(value) || util.isHex(value) ? decodeU8aStruct(registry, new Array(typeMap[0].length), util.u8aToU8a(value), typeMap) : value instanceof Struct ? [value, 0] : decodeStructFromObject(registry, typeMap, value || {}, jsonMap);
      super(decoded);
      this.initialU8aLength = decodedLength;
      this.registry = registry;
      this.#jsonMap = jsonMap;
      this.#Types = typeMap;
    }
    static with(Types, jsonMap) {
      var _class;
      let definition;
      const setDefinition = d => definition = d;
      return _class = class extends Struct {
        constructor(registry, value) {
          super(registry, Types, value, jsonMap, {
            definition,
            setDefinition
          });
        }
      }, (() => {
        const keys = Object.keys(Types);
        util.objectProperties(_class.prototype, keys, (k, _, self) => self.get(k));
      })(), _class;
    }
    get defKeys() {
      return this.#Types[1];
    }
    get isEmpty() {
      for (const v of this.values()) {
        if (!v.isEmpty) {
          return false;
        }
      }
      return true;
    }
    get encodedLength() {
      let total = 0;
      for (const v of this.values()) {
        total += v.encodedLength;
      }
      return total;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get Type() {
      const result = {};
      const [Types, keys] = this.#Types;
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = new Types[i](this.registry).toRawType();
      }
      return result;
    }
    eq(other) {
      return compareMap(this, other);
    }
    get(key) {
      return super.get(key);
    }
    getAtIndex(index) {
      return this.toArray()[index];
    }
    getT(key) {
      return super.get(key);
    }
    inspect(isBare) {
      const inner = new Array();
      for (const [k, v] of this.entries()) {
        inner.push({ ...v.inspect(!isBare || util.isBoolean(isBare) ? isBare : isBare[k]),
          name: util.stringCamelCase(k)
        });
      }
      return {
        inner
      };
    }
    toArray() {
      return [...this.values()];
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman(isExtended) {
      const json = {};
      for (const [k, v] of this.entries()) {
        json[k] = v && v.toHuman(isExtended);
      }
      return json;
    }
    toJSON() {
      const json = {};
      for (const [k, v] of this.entries()) {
        const jsonKey = this.#jsonMap.get(k) || k;
        json[jsonKey] = v && v.toJSON();
      }
      return json;
    }
    toPrimitive() {
      const json = {};
      for (const [k, v] of this.entries()) {
        const jsonKey = this.#jsonMap.get(k) || k;
        json[jsonKey] = v && v.toPrimitive();
      }
      return json;
    }
    toRawType() {
      return util.stringify(typesToMap(this.registry, this.#Types));
    }
    toString() {
      return util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      const encoded = [];
      for (const [k, v] of this.entries()) {
        if (v && util.isFunction(v.toU8a)) {
          encoded.push(v.toU8a(!isBare || util.isBoolean(isBare) ? isBare : isBare[k]));
        }
      }
      return util.u8aConcatStrict(encoded);
    }
  }

  const l$4 = util.logger('Map');
  function decodeMapFromU8a(registry, KeyClass, ValClass, u8a) {
    const output = new Map();
    const [offset, count] = util.compactFromU8aLim(u8a);
    const types = [];
    for (let i = 0; i < count; i++) {
      types.push(KeyClass, ValClass);
    }
    const [values, decodedLength] = decodeU8a$6(registry, new Array(types.length), u8a.subarray(offset), [types, []]);
    for (let i = 0; i < values.length; i += 2) {
      output.set(values[i], values[i + 1]);
    }
    return [KeyClass, ValClass, output, offset + decodedLength];
  }
  function decodeMapFromMap(registry, KeyClass, ValClass, value) {
    const output = new Map();
    for (const [key, val] of value.entries()) {
      const isComplex = KeyClass.prototype instanceof AbstractArray || KeyClass.prototype instanceof Struct || KeyClass.prototype instanceof Enum;
      try {
        output.set(key instanceof KeyClass ? key : new KeyClass(registry, isComplex && typeof key === 'string' ? JSON.parse(key) : key), val instanceof ValClass ? val : new ValClass(registry, val));
      } catch (error) {
        l$4.error('Failed to decode key or value:', error.message);
        throw error;
      }
    }
    return [KeyClass, ValClass, output, 0];
  }
  function decodeMap(registry, keyType, valType, value) {
    const KeyClass = typeToConstructor(registry, keyType);
    const ValClass = typeToConstructor(registry, valType);
    if (!value) {
      return [KeyClass, ValClass, new Map(), 0];
    } else if (util.isU8a(value) || util.isHex(value)) {
      return decodeMapFromU8a(registry, KeyClass, ValClass, util.u8aToU8a(value));
    } else if (value instanceof Map) {
      return decodeMapFromMap(registry, KeyClass, ValClass, value);
    } else if (util.isObject(value)) {
      return decodeMapFromMap(registry, KeyClass, ValClass, new Map(Object.entries(value)));
    }
    throw new Error('Map: cannot decode type');
  }
  class CodecMap extends Map {
    #KeyClass;
    #ValClass;
    #type;
    constructor(registry, keyType, valType, rawValue, type = 'HashMap') {
      const [KeyClass, ValClass, decoded, decodedLength] = decodeMap(registry, keyType, valType, rawValue);
      super(type === 'BTreeMap' ? sortMap(decoded) : decoded);
      this.registry = registry;
      this.initialU8aLength = decodedLength;
      this.#KeyClass = KeyClass;
      this.#ValClass = ValClass;
      this.#type = type;
    }
    get encodedLength() {
      let len = util.compactToU8a(this.size).length;
      for (const [k, v] of this.entries()) {
        len += k.encodedLength + v.encodedLength;
      }
      return len;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.size === 0;
    }
    eq(other) {
      return compareMap(this, other);
    }
    inspect() {
      const inner = new Array();
      for (const [k, v] of this.entries()) {
        inner.push(k.inspect());
        inner.push(v.inspect());
      }
      return {
        inner,
        outer: [util.compactToU8a(this.size)]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman(isExtended) {
      const json = {};
      for (const [k, v] of this.entries()) {
        json[k instanceof Raw && k.isAscii ? k.toUtf8() : k.toString()] = v.toHuman(isExtended);
      }
      return json;
    }
    toJSON() {
      const json = {};
      for (const [k, v] of this.entries()) {
        json[k.toString()] = v.toJSON();
      }
      return json;
    }
    toPrimitive() {
      const json = {};
      for (const [k, v] of this.entries()) {
        json[k instanceof Raw && k.isAscii ? k.toUtf8() : k.toString()] = v.toPrimitive();
      }
      return json;
    }
    toRawType() {
      return `${this.#type}<${this.registry.getClassName(this.#KeyClass) || new this.#KeyClass(this.registry).toRawType()},${this.registry.getClassName(this.#ValClass) || new this.#ValClass(this.registry).toRawType()}>`;
    }
    toString() {
      return util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      const encoded = new Array();
      if (!isBare) {
        encoded.push(util.compactToU8a(this.size));
      }
      for (const [k, v] of this.entries()) {
        encoded.push(k.toU8a(isBare), v.toU8a(isBare));
      }
      return util.u8aConcatStrict(encoded);
    }
  }

  class BTreeMap extends CodecMap {
    static with(keyType, valType) {
      return class extends BTreeMap {
        constructor(registry, value) {
          super(registry, keyType, valType, value, 'BTreeMap');
        }
      };
    }
  }

  const l$3 = util.logger('BTreeSet');
  function decodeSetFromU8a(registry, ValClass, u8a) {
    const output = new Set();
    const [offset, count] = util.compactFromU8aLim(u8a);
    const result = new Array(count);
    const [decodedLength] = decodeU8aVec(registry, result, u8a, offset, ValClass);
    for (let i = 0; i < count; i++) {
      output.add(result[i]);
    }
    return [ValClass, output, decodedLength];
  }
  function decodeSetFromSet(registry, ValClass, value) {
    const output = new Set();
    value.forEach(val => {
      try {
        output.add(val instanceof ValClass ? val : new ValClass(registry, val));
      } catch (error) {
        l$3.error('Failed to decode key or value:', error.message);
        throw error;
      }
    });
    return [ValClass, output, 0];
  }
  function decodeSet$1(registry, valType, value) {
    const ValClass = typeToConstructor(registry, valType);
    if (!value) {
      return [ValClass, new Set(), 0];
    } else if (util.isU8a(value) || util.isHex(value)) {
      return decodeSetFromU8a(registry, ValClass, util.u8aToU8a(value));
    } else if (Array.isArray(value) || value instanceof Set) {
      return decodeSetFromSet(registry, ValClass, value);
    }
    throw new Error('BTreeSet: cannot decode type');
  }
  class BTreeSet extends Set {
    #ValClass;
    constructor(registry, valType, rawValue) {
      const [ValClass, values, decodedLength] = decodeSet$1(registry, valType, rawValue);
      super(sortSet(values));
      this.registry = registry;
      this.initialU8aLength = decodedLength;
      this.#ValClass = ValClass;
    }
    static with(valType) {
      return class extends BTreeSet {
        constructor(registry, value) {
          super(registry, valType, value);
        }
      };
    }
    get encodedLength() {
      let len = util.compactToU8a(this.size).length;
      for (const v of this.values()) {
        len += v.encodedLength;
      }
      return len;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.size === 0;
    }
    get strings() {
      return [...super.values()].map(v => v.toString());
    }
    eq(other) {
      return compareSet(this, other);
    }
    inspect() {
      const inner = new Array();
      for (const v of this.values()) {
        inner.push(v.inspect());
      }
      return {
        inner,
        outer: [util.compactToU8a(this.size)]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman(isExtended) {
      const json = [];
      for (const v of this.values()) {
        json.push(v.toHuman(isExtended));
      }
      return json;
    }
    toJSON() {
      const json = [];
      for (const v of this.values()) {
        json.push(v.toJSON());
      }
      return json;
    }
    toRawType() {
      return `BTreeSet<${this.registry.getClassName(this.#ValClass) || new this.#ValClass(this.registry).toRawType()}>`;
    }
    toPrimitive() {
      const json = [];
      for (const v of this.values()) {
        json.push(v.toPrimitive());
      }
      return json;
    }
    toString() {
      return util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      const encoded = new Array();
      if (!isBare) {
        encoded.push(util.compactToU8a(this.size));
      }
      for (const v of this.values()) {
        encoded.push(v.toU8a(isBare));
      }
      return util.u8aConcatStrict(encoded);
    }
  }

  const MAX_LENGTH$1 = 10 * 1024 * 1024;
  function decodeBytesU8a(value) {
    if (!value.length) {
      return [new Uint8Array(), 0];
    }
    const [offset, length] = util.compactFromU8aLim(value);
    const total = offset + length;
    if (length > MAX_LENGTH$1) {
      throw new Error(`Bytes length ${length.toString()} exceeds ${MAX_LENGTH$1}`);
    } else if (total > value.length) {
      throw new Error(`Bytes: required length less than remainder, expected at least ${total}, found ${value.length}`);
    }
    return [value.subarray(offset, total), total];
  }
  class Bytes extends Raw {
    constructor(registry, value) {
      const [u8a, decodedLength] = util.isU8a(value) && !(value instanceof Raw) ? decodeBytesU8a(value) : Array.isArray(value) || util.isString(value) ? [util.u8aToU8a(value), 0] : [value, 0];
      super(registry, u8a, decodedLength);
    }
    get encodedLength() {
      return this.length + util.compactToU8a(this.length).length;
    }
    inspect(isBare) {
      const clength = util.compactToU8a(this.length);
      return {
        outer: isBare ? [super.toU8a()] : this.length ? [clength, super.toU8a()] : [clength]
      };
    }
    toRawType() {
      return 'Bytes';
    }
    toU8a(isBare) {
      return isBare ? super.toU8a(isBare) : util.compactAddLength(this);
    }
  }

  class HashMap extends CodecMap {
    static with(keyType, valType) {
      return class extends HashMap {
        constructor(registry, value) {
          super(registry, keyType, valType, value);
        }
      };
    }
  }

  const EMPTY = new Uint8Array();
  class Linkage extends Struct {
    constructor(registry, Type, value) {
      super(registry, {
        previous: Option.with(Type),
        next: Option.with(Type)
      }, value);
    }
    static withKey(Type) {
      return class extends Linkage {
        constructor(registry, value) {
          super(registry, Type, value);
        }
      };
    }
    get previous() {
      return this.get('previous');
    }
    get next() {
      return this.get('next');
    }
    toRawType() {
      return `Linkage<${this.next.toRawType(true)}>`;
    }
    toU8a() {
      return this.isEmpty ? EMPTY : super.toU8a();
    }
  }

  class bool extends Boolean {
    constructor(registry, value = false) {
      super(util.isU8a(value) ? value[0] === 1 : value instanceof Boolean ? value.valueOf() : !!value);
      this.registry = registry;
    }
    get encodedLength() {
      return 1;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.isFalse;
    }
    get isFalse() {
      return !this.isTrue;
    }
    get isTrue() {
      return this.valueOf();
    }
    eq(other) {
      return this.valueOf() === (other instanceof Boolean ? other.valueOf() : other);
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.valueOf();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toRawType() {
      return 'bool';
    }
    toString() {
      return this.toJSON().toString();
    }
    toU8a(isBare) {
      return new Uint8Array([this.valueOf() ? 1 : 0]);
    }
  }

  function decodeU8a$5(registry, value) {
    return value[0] === 0 ? null : new bool(registry, value[0] === 1);
  }
  class OptionBool extends Option {
    constructor(registry, value) {
      super(registry, bool, util.isU8a(value) || util.isHex(value) ? decodeU8a$5(registry, util.u8aToU8a(value)) : value);
      this.initialU8aLength = 1;
    }
    get encodedLength() {
      return 1;
    }
    get isFalse() {
      return this.isSome ? !this.value.valueOf() : false;
    }
    get isTrue() {
      return this.isSome ? this.value.valueOf() : false;
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toRawType(isBare) {
      return isBare ? 'bool' : 'Option<bool>';
    }
    toU8a(isBare) {
      if (isBare) {
        return super.toU8a(true);
      }
      return this.isSome ? new Uint8Array([this.isTrue ? 1 : 2]) : new Uint8Array([0]);
    }
  }

  class Range extends Tuple {
    #rangeName;
    constructor(registry, Type, value, {
      rangeName = 'Range'
    } = {}) {
      super(registry, [Type, Type], value);
      this.#rangeName = rangeName;
    }
    static with(Type) {
      return class extends Range {
        constructor(registry, value) {
          super(registry, Type, value);
        }
      };
    }
    get start() {
      return this[0];
    }
    get end() {
      return this[1];
    }
    toRawType() {
      return `${this.#rangeName}<${this.start.toRawType()}>`;
    }
  }

  class RangeInclusive extends Range {
    constructor(registry, Type, value) {
      super(registry, Type, value, {
        rangeName: 'RangeInclusive'
      });
    }
    static with(Type) {
      return class extends RangeInclusive {
        constructor(registry, value) {
          super(registry, Type, value);
        }
      };
    }
  }

  const MAX_LENGTH = 128 * 1024;
  function decodeText(value) {
    if (util.isU8a(value)) {
      if (!value.length) {
        return ['', 0];
      }
      if (value instanceof Raw) {
        return [util.u8aToString(value), 0];
      }
      const [offset, length] = util.compactFromU8aLim(value);
      const total = offset + length;
      if (length > MAX_LENGTH) {
        throw new Error(`Text: length ${length.toString()} exceeds ${MAX_LENGTH}`);
      } else if (total > value.length) {
        throw new Error(`Text: required length less than remainder, expected at least ${total}, found ${value.length}`);
      }
      return [util.u8aToString(value.subarray(offset, total)), total];
    } else if (util.isHex(value)) {
      return [util.u8aToString(util.hexToU8a(value)), 0];
    }
    return [value ? value.toString() : '', 0];
  }
  class Text extends String {
    #override = null;
    constructor(registry, value) {
      const [str, decodedLength] = decodeText(value);
      super(str);
      this.registry = registry;
      this.initialU8aLength = decodedLength;
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.length === 0;
    }
    get length() {
      return super.length;
    }
    eq(other) {
      return util.isString(other) ? this.toString() === other.toString() : false;
    }
    inspect() {
      const value = util.stringToU8a(super.toString());
      return {
        outer: value.length ? [util.compactToU8a(value.length), value] : [util.compactToU8a(value.length)]
      };
    }
    setOverride(override) {
      this.#override = override;
    }
    toHex() {
      return util.u8aToHex(this.toU8a(true));
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.toString();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toRawType() {
      return 'Text';
    }
    toString() {
      return this.#override || super.toString();
    }
    toU8a(isBare) {
      const encoded = util.stringToU8a(super.toString());
      return isBare ? encoded : util.compactAddLength(encoded);
    }
  }

  class Type extends Text {
    constructor(registry, value = '') {
      super(registry, value);
      this.setOverride(sanitize(this.toString()));
    }
    toRawType() {
      return 'Type';
    }
  }

  function decodeU8aFixed(value, bitLength) {
    const u8a = util.u8aToU8a(value);
    const byteLength = bitLength / 8;
    if (!u8a.length) {
      return [new Uint8Array(byteLength), 0];
    }
    if (util.isU8a(value) ? u8a.length < byteLength : u8a.length !== byteLength) {
      throw new Error(`Expected input with ${byteLength} bytes (${bitLength} bits), found ${u8a.length} bytes`);
    }
    return [u8a.subarray(0, byteLength), byteLength];
  }
  class U8aFixed extends Raw {
    constructor(registry, value = new Uint8Array(), bitLength = 256) {
      const [u8a, decodedLength] = decodeU8aFixed(value, bitLength);
      super(registry, u8a, decodedLength);
    }
    static with(bitLength, typeName) {
      return class extends U8aFixed {
        constructor(registry, value) {
          super(registry, value, bitLength);
        }
        toRawType() {
          return typeName || super.toRawType();
        }
      };
    }
    toRawType() {
      return `[u8;${this.length}]`;
    }
  }

  function decodeRaw(registry, typeName, value) {
    const Type = typeToConstructor(registry, typeName);
    if (util.isU8a(value) || util.isHex(value)) {
      try {
        const [, u8a] = util.isHex(value) ? [0, util.u8aToU8a(value)] : value instanceof Raw ? [0, value.subarray()] : util.compactStripLength(value);
        return [Type, new Type(registry, u8a), value];
      } catch {
        return [Type, null, value];
      }
    }
    const instance = new Type(registry, value);
    return [Type, instance, util.compactAddLength(instance.toU8a())];
  }
  class WrapperKeepOpaque extends Bytes {
    #Type;
    #decoded;
    #opaqueName;
    constructor(registry, typeName, value, {
      opaqueName = 'WrapperKeepOpaque'
    } = {}) {
      const [Type, decoded, u8a] = decodeRaw(registry, typeName, value);
      super(registry, u8a);
      this.#Type = Type;
      this.#decoded = decoded;
      this.#opaqueName = opaqueName;
    }
    static with(Type) {
      return class extends WrapperKeepOpaque {
        constructor(registry, value) {
          super(registry, Type, value);
        }
      };
    }
    get isDecoded() {
      return !!this.#decoded;
    }
    inspect() {
      return this.#decoded ? {
        inner: [this.#decoded.inspect()],
        outer: [util.compactToU8a(this.length)]
      } : {
        outer: [util.compactToU8a(this.length), this.toU8a(true)]
      };
    }
    toHuman(isExtended) {
      return this.#decoded ? this.#decoded.toHuman(isExtended) : super.toHuman();
    }
    toPrimitive() {
      return this.#decoded ? this.#decoded.toPrimitive() : super.toPrimitive();
    }
    toRawType() {
      return `${this.#opaqueName}<${this.registry.getClassName(this.#Type) || (this.#decoded ? this.#decoded.toRawType() : new this.#Type(this.registry).toRawType())}>`;
    }
    toString() {
      return this.#decoded ? this.#decoded.toString() : super.toString();
    }
    unwrap() {
      if (!this.#decoded) {
        throw new Error(`${this.#opaqueName}: unwrapping an undecodable value`);
      }
      return this.#decoded;
    }
  }

  class WrapperOpaque extends WrapperKeepOpaque {
    constructor(registry, typeName, value) {
      super(registry, typeName, value, {
        opaqueName: 'WrapperOpaque'
      });
    }
    static with(Type) {
      return class extends WrapperOpaque {
        constructor(registry, value) {
          super(registry, Type, value);
        }
      };
    }
    get inner() {
      return this.unwrap();
    }
  }

  class Float extends Number {
    #bitLength;
    constructor(registry, value, {
      bitLength = 32
    } = {}) {
      super(util.isU8a(value) || util.isHex(value) ? value.length === 0 ? 0 : util.u8aToFloat(util.u8aToU8a(value), {
        bitLength
      }) : value || 0);
      this.#bitLength = bitLength;
      this.encodedLength = bitLength / 8;
      this.initialU8aLength = this.encodedLength;
      this.registry = registry;
    }
    static with(bitLength) {
      return class extends Float {
        constructor(registry, value) {
          super(registry, value, {
            bitLength
          });
        }
      };
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.valueOf() === 0;
    }
    eq(other) {
      return this.valueOf() === Number(other);
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman() {
      return this.toString();
    }
    toJSON() {
      return this.toHex();
    }
    toNumber() {
      return this.valueOf();
    }
    toPrimitive() {
      return this.toNumber();
    }
    toRawType() {
      return `f${this.#bitLength}`;
    }
    toU8a() {
      return util.floatToU8a(this, {
        bitLength: this.#bitLength
      });
    }
  }

  function decodeJson(value) {
    return Object.entries(value || {});
  }
  class Json extends Map {
    constructor(registry, value) {
      const decoded = decodeJson(value);
      super(decoded);
      this.registry = registry;
      util.objectProperties(this, decoded.map(([k]) => k), k => this.get(k));
    }
    get encodedLength() {
      return 0;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return [...this.keys()].length === 0;
    }
    eq(other) {
      return compareMap(this, other);
    }
    getT(key) {
      return this.get(key);
    }
    inspect() {
      throw new Error('Unimplemented');
    }
    toHex() {
      throw new Error('Unimplemented');
    }
    toHuman() {
      return [...this.entries()].reduce((json, [key, value]) => {
        json[key] = util.isFunction(value.toHuman) ? value.toHuman() : value;
        return json;
      }, {});
    }
    toJSON() {
      return [...this.entries()].reduce((json, [key, value]) => {
        json[key] = value;
        return json;
      }, {});
    }
    toPrimitive() {
      return [...this.entries()].reduce((json, [key, value]) => {
        json[key] = util.isFunction(value.toHuman) ? value.toPrimitive() : value;
        return json;
      }, {});
    }
    toRawType() {
      return 'Json';
    }
    toString() {
      return util.stringify(this.toJSON());
    }
    toU8a(isBare) {
      throw new Error('Unimplemented');
    }
  }

  function encodeSet(setValues, values) {
    const encoded = new util.BN(0);
    for (let i = 0; i < values.length; i++) {
      encoded.ior(util.bnToBn(setValues[values[i]] || 0));
    }
    return encoded;
  }
  function decodeSetArray(setValues, values) {
    const result = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const key = values[i];
      if (util.isUndefined(setValues[key])) {
        throw new Error(`Set: Invalid key '${key}' passed to Set, allowed ${Object.keys(setValues).join(', ')}`);
      }
      result[i] = key;
    }
    return result;
  }
  function decodeSetNumber(setValues, _value) {
    const bn = util.bnToBn(_value);
    const keys = Object.keys(setValues);
    const result = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (bn.and(util.bnToBn(setValues[key])).eq(util.bnToBn(setValues[key]))) {
        result.push(key);
      }
    }
    const computed = encodeSet(setValues, result);
    if (!bn.eq(computed)) {
      throw new Error(`Set: Mismatch decoding '${bn.toString()}', computed as '${computed.toString()}' with ${result.join(', ')}`);
    }
    return result;
  }
  function decodeSet(setValues, value = 0, bitLength) {
    if (bitLength % 8 !== 0) {
      throw new Error(`Expected valid bitLength, power of 8, found ${bitLength}`);
    }
    const byteLength = bitLength / 8;
    if (util.isU8a(value)) {
      return value.length === 0 ? [] : decodeSetNumber(setValues, util.u8aToBn(value.subarray(0, byteLength), {
        isLe: true
      }));
    } else if (util.isString(value)) {
      return decodeSet(setValues, util.u8aToU8a(value), byteLength);
    } else if (value instanceof Set || Array.isArray(value)) {
      const input = Array.isArray(value) ? value : [...value.values()];
      return decodeSetArray(setValues, input);
    }
    return decodeSetNumber(setValues, value);
  }
  class CodecSet extends Set {
    #allowed;
    #byteLength;
    constructor(registry, setValues, value, bitLength = 8) {
      super(decodeSet(setValues, value, bitLength));
      this.registry = registry;
      this.#allowed = setValues;
      this.#byteLength = bitLength / 8;
    }
    static with(values, bitLength) {
      var _class;
      return _class = class extends CodecSet {
        constructor(registry, value) {
          super(registry, values, value, bitLength);
        }
      }, (() => {
        const keys = Object.keys(values);
        const isKeys = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
          isKeys[i] = `is${util.stringPascalCase(keys[i])}`;
        }
        util.objectProperties(_class.prototype, isKeys, (_, i, self) => self.strings.includes(keys[i]));
      })(), _class;
    }
    get encodedLength() {
      return this.#byteLength;
    }
    get hash() {
      return this.registry.hash(this.toU8a());
    }
    get isEmpty() {
      return this.size === 0;
    }
    get strings() {
      return [...super.values()];
    }
    get valueEncoded() {
      return encodeSet(this.#allowed, this.strings);
    }
    add = key => {
      if (this.#allowed && util.isUndefined(this.#allowed[key])) {
        throw new Error(`Set: Invalid key '${key}' on add`);
      }
      super.add(key);
      return this;
    };
    eq(other) {
      if (Array.isArray(other)) {
        return compareArray(this.strings.sort(), other.sort());
      } else if (other instanceof Set) {
        return this.eq([...other.values()]);
      } else if (util.isNumber(other) || util.isBn(other)) {
        return this.valueEncoded.eq(util.bnToBn(other));
      }
      return false;
    }
    inspect() {
      return {
        outer: [this.toU8a()]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.strings;
    }
    toNumber() {
      return this.valueEncoded.toNumber();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toRawType() {
      return util.stringify({
        _set: this.#allowed
      });
    }
    toString() {
      return `[${this.strings.join(', ')}]`;
    }
    toU8a(isBare) {
      return util.bnToU8a(this.valueEncoded, {
        bitLength: this.#byteLength * 8,
        isLe: true
      });
    }
  }

  class f32 extends Float.with(32) {
    __FloatType = 'f32';
  }

  class f64 extends Float.with(64) {
    __FloatType = 'f64';
  }

  class i8 extends Int.with(8) {
    __IntType = 'i8';
  }

  class i16 extends Int.with(16) {
    __IntType = 'i16';
  }

  class i32 extends Int.with(32) {
    __IntType = 'i32';
  }

  class i64 extends Int.with(64) {
    __IntType = 'i64';
  }

  class i128 extends Int.with(128) {
    __IntType = 'i128';
  }

  class i256 extends Int.with(256) {
    __IntType = 'i256';
  }

  class u8 extends UInt.with(8) {
    __UIntType = 'u8';
  }

  class u16 extends UInt.with(16) {
    __UIntType = 'u16';
  }

  class u32 extends UInt.with(32) {
    __UIntType = 'u32';
  }

  class u64 extends UInt.with(64) {
    __UIntType = 'u64';
  }

  class u128 extends UInt.with(128) {
    __UIntType = 'u128';
  }

  class u256 extends UInt.with(256) {
    __UIntType = 'u256';
  }

  class usize extends u32 {
    constructor(registry, value) {
      super(registry, value);
      throw new Error('The `usize` type should not be used. Since it is platform-specific, it creates incompatibilities between native (generally u64) and WASM (always u32) code. Use one of the `u32` or `u64` types explicitly.');
    }
  }

  function typeSplit(type) {
    const result = [];
    let c = 0;
    let f = 0;
    let s = 0;
    let t = 0;
    let start = 0;
    for (let i = 0; i < type.length; i++) {
      switch (type[i]) {
        case ',':
          {
            if (!(c || f || s || t)) {
              result.push(type.substring(start, i).trim());
              start = i + 1;
            }
            break;
          }
        case '<':
          c++;
          break;
        case '>':
          c--;
          break;
        case '[':
          f++;
          break;
        case ']':
          f--;
          break;
        case '{':
          s++;
          break;
        case '}':
          s--;
          break;
        case '(':
          t++;
          break;
        case ')':
          t--;
          break;
      }
    }
    if (c || f || s || t) {
      throw new Error(`Invalid definition (missing terminators) found in ${type}`);
    }
    result.push(type.substring(start, type.length).trim());
    return result;
  }

  const KNOWN_INTERNALS = ['_alias', '_fallback'];
  function getTypeString(typeOrObj) {
    return util.isString(typeOrObj) ? typeOrObj.toString() : JSON.stringify(typeOrObj);
  }
  function isRustEnum(details) {
    const values = Object.values(details);
    if (values.some(v => util.isNumber(v))) {
      if (!values.every(v => util.isNumber(v) && v >= 0 && v <= 255)) {
        throw new Error('Invalid number-indexed enum definition');
      }
      return false;
    }
    return true;
  }
  function _decodeEnum(value, details, count, fallbackType) {
    value.info = exports.TypeDefInfo.Enum;
    value.fallbackType = fallbackType;
    if (Array.isArray(details)) {
      value.sub = details.map((name, index) => ({
        index,
        info: exports.TypeDefInfo.Plain,
        name,
        type: 'Null'
      }));
    } else if (isRustEnum(details)) {
      value.sub = Object.entries(details).map(([name, typeOrObj], index) => util.objectSpread({}, getTypeDef(getTypeString(typeOrObj || 'Null'), {
        name
      }, count), {
        index
      }));
    } else {
      value.sub = Object.entries(details).map(([name, index]) => ({
        index,
        info: exports.TypeDefInfo.Plain,
        name,
        type: 'Null'
      }));
    }
    return value;
  }
  function _decodeSet(value, details, fallbackType) {
    value.info = exports.TypeDefInfo.Set;
    value.fallbackType = fallbackType;
    value.length = details._bitLength;
    value.sub = Object.entries(details).filter(([name]) => !name.startsWith('_')).map(([name, index]) => ({
      index,
      info: exports.TypeDefInfo.Plain,
      name,
      type: 'Null'
    }));
    return value;
  }
  function _decodeStruct(value, type, _, count) {
    const parsed = JSON.parse(type);
    const keys = Object.keys(parsed);
    if (keys.includes('_enum')) {
      return _decodeEnum(value, parsed._enum, count, parsed._fallback);
    } else if (keys.includes('_set')) {
      return _decodeSet(value, parsed._set, parsed._fallback);
    }
    value.alias = parsed._alias ? new Map(Object.entries(parsed._alias)) : undefined;
    value.fallbackType = parsed._fallback;
    value.sub = keys.filter(name => !KNOWN_INTERNALS.includes(name)).map(name => getTypeDef(getTypeString(parsed[name]), {
      name
    }, count));
    return value;
  }
  function _decodeFixedVec(value, type, _, count) {
    const max = type.length - 1;
    let index = -1;
    let inner = 0;
    for (let i = 1; i < max && index === -1; i++) {
      switch (type[i]) {
        case ';':
          {
            if (inner === 0) {
              index = i;
            }
            break;
          }
        case '[':
        case '(':
        case '<':
          inner++;
          break;
        case ']':
        case ')':
        case '>':
          inner--;
          break;
      }
    }
    if (index === -1) {
      throw new Error(`${type}: Unable to extract location of ';'`);
    }
    const vecType = type.substring(1, index);
    const [strLength, displayName] = type.substring(index + 1, max).split(';');
    const length = parseInt(strLength.trim(), 10);
    if (length > 2048) {
      throw new Error(`${type}: Only support for [Type; <length>], where length <= 2048`);
    }
    value.displayName = displayName;
    value.length = length;
    value.sub = getTypeDef(vecType, {}, count);
    return value;
  }
  function _decodeTuple(value, _, subType, count) {
    value.sub = subType.length === 0 ? [] : typeSplit(subType).map(inner => getTypeDef(inner, {}, count));
    return value;
  }
  function _decodeAnyInt(value, type, _, clazz) {
    const [strLength, displayName] = type.substring(clazz.length + 1, type.length - 1).split(',');
    const length = parseInt(strLength.trim(), 10);
    if (length > 8192 || length % 8) {
      throw new Error(`${type}: Only support for ${clazz}<bitLength>, where length <= 8192 and a power of 8, found ${length}`);
    }
    value.displayName = displayName;
    value.length = length;
    return value;
  }
  function _decodeInt(value, type, subType) {
    return _decodeAnyInt(value, type, subType, 'Int');
  }
  function _decodeUInt(value, type, subType) {
    return _decodeAnyInt(value, type, subType, 'UInt');
  }
  function _decodeDoNotConstruct(value, type, _) {
    const NAME_LENGTH = 'DoNotConstruct'.length;
    value.displayName = type.substring(NAME_LENGTH + 1, type.length - 1);
    return value;
  }
  function hasWrapper(type, [start, end]) {
    return type.substring(0, start.length) === start && type.slice(-1 * end.length) === end;
  }
  const nestedExtraction = [['[', ']', exports.TypeDefInfo.VecFixed, _decodeFixedVec], ['{', '}', exports.TypeDefInfo.Struct, _decodeStruct], ['(', ')', exports.TypeDefInfo.Tuple, _decodeTuple],
  ['BTreeMap<', '>', exports.TypeDefInfo.BTreeMap, _decodeTuple], ['HashMap<', '>', exports.TypeDefInfo.HashMap, _decodeTuple], ['Int<', '>', exports.TypeDefInfo.Int, _decodeInt], ['Result<', '>', exports.TypeDefInfo.Result, _decodeTuple], ['UInt<', '>', exports.TypeDefInfo.UInt, _decodeUInt], ['DoNotConstruct<', '>', exports.TypeDefInfo.DoNotConstruct, _decodeDoNotConstruct]];
  const wrappedExtraction = [['BTreeSet<', '>', exports.TypeDefInfo.BTreeSet], ['Compact<', '>', exports.TypeDefInfo.Compact], ['Linkage<', '>', exports.TypeDefInfo.Linkage], ['Opaque<', '>', exports.TypeDefInfo.WrapperOpaque], ['Option<', '>', exports.TypeDefInfo.Option], ['Range<', '>', exports.TypeDefInfo.Range], ['RangeInclusive<', '>', exports.TypeDefInfo.RangeInclusive], ['Vec<', '>', exports.TypeDefInfo.Vec], ['WrapperKeepOpaque<', '>', exports.TypeDefInfo.WrapperKeepOpaque], ['WrapperOpaque<', '>', exports.TypeDefInfo.WrapperOpaque]];
  function extractSubType(type, [start, end]) {
    return type.substring(start.length, type.length - end.length);
  }
  function getTypeDef(_type, {
    displayName,
    name
  } = {}, count = 0) {
    const type = sanitize(_type);
    const value = {
      displayName,
      info: exports.TypeDefInfo.Plain,
      name,
      type
    };
    if (++count > 64) {
      throw new Error('getTypeDef: Maximum nested limit reached');
    }
    const nested = nestedExtraction.find(nested => hasWrapper(type, nested));
    if (nested) {
      value.info = nested[2];
      return nested[3](value, type, extractSubType(type, nested), count);
    }
    const wrapped = wrappedExtraction.find(wrapped => hasWrapper(type, wrapped));
    if (wrapped) {
      value.info = wrapped[2];
      value.sub = getTypeDef(extractSubType(type, wrapped), {}, count);
    }
    return value;
  }

  function getTypeDefType({
    lookupName,
    type
  }) {
    return lookupName || type;
  }
  function getSubDefArray(value) {
    if (!Array.isArray(value.sub)) {
      throw new Error(`Expected subtype as TypeDef[] in ${util.stringify(value)}`);
    }
    return value.sub;
  }
  function getSubDef(value) {
    if (!value.sub || Array.isArray(value.sub)) {
      throw new Error(`Expected subtype as TypeDef in ${util.stringify(value)}`);
    }
    return value.sub;
  }
  function getSubType(value) {
    return getTypeDefType(getSubDef(value));
  }
  function getTypeClassMap(value) {
    const subs = getSubDefArray(value);
    const map = {};
    for (let i = 0; i < subs.length; i++) {
      map[subs[i].name] = getTypeDefType(subs[i]);
    }
    return map;
  }
  function getTypeClassArray(value) {
    return getSubDefArray(value).map(getTypeDefType);
  }
  function createInt(Clazz, {
    displayName,
    length
  }) {
    if (!util.isNumber(length)) {
      throw new Error(`Expected bitLength information for ${displayName || Clazz.constructor.name}<bitLength>`);
    }
    return Clazz.with(length, displayName);
  }
  function createHashMap(Clazz, value) {
    const [keyType, valueType] = getTypeClassArray(value);
    return Clazz.with(keyType, valueType);
  }
  function createWithSub(Clazz, value) {
    return Clazz.with(getSubType(value));
  }
  const infoMapping = {
    [exports.TypeDefInfo.BTreeMap]: (registry, value) => createHashMap(BTreeMap, value),
    [exports.TypeDefInfo.BTreeSet]: (registry, value) => createWithSub(BTreeSet, value),
    [exports.TypeDefInfo.Compact]: (registry, value) => createWithSub(Compact, value),
    [exports.TypeDefInfo.DoNotConstruct]: (registry, value) => DoNotConstruct.with(value.displayName || value.type),
    [exports.TypeDefInfo.Enum]: (registry, value) => {
      const subs = getSubDefArray(value);
      return Enum.with(subs.every(({
        type
      }) => type === 'Null') ? subs.reduce((out, {
        index,
        name
      }, count) => {
        out[name] = index || count;
        return out;
      }, {}) : getTypeClassMap(value));
    },
    [exports.TypeDefInfo.HashMap]: (registry, value) => createHashMap(HashMap, value),
    [exports.TypeDefInfo.Int]: (registry, value) => createInt(Int, value),
    [exports.TypeDefInfo.Linkage]: (registry, value) => {
      const type = `Option<${getSubType(value)}>`;
      const Clazz = Struct.with({
        previous: type,
        next: type
      });
      Clazz.prototype.toRawType = function () {
        return `Linkage<${this.next.toRawType(true)}>`;
      };
      return Clazz;
    },
    [exports.TypeDefInfo.Null]: (registry, _) => Null,
    [exports.TypeDefInfo.Option]: (registry, value) => {
      if (!value.sub || Array.isArray(value.sub)) {
        throw new Error('Expected type information for Option');
      }
      return createWithSub(Option, value);
    },
    [exports.TypeDefInfo.Plain]: (registry, value) => registry.getOrUnknown(value.type),
    [exports.TypeDefInfo.Range]: (registry, value) => createWithSub(Range, value),
    [exports.TypeDefInfo.RangeInclusive]: (registry, value) => createWithSub(RangeInclusive, value),
    [exports.TypeDefInfo.Result]: (registry, value) => {
      const [Ok, Err] = getTypeClassArray(value);
      return Result.with({
        Err,
        Ok
      });
    },
    [exports.TypeDefInfo.Set]: (registry, value) => CodecSet.with(getSubDefArray(value).reduce((result, {
      index,
      name
    }) => {
      result[name] = index;
      return result;
    }, {}), value.length),
    [exports.TypeDefInfo.Si]: (registry, value) => getTypeClass(registry, registry.lookup.getTypeDef(value.type)),
    [exports.TypeDefInfo.Struct]: (registry, value) => Struct.with(getTypeClassMap(value), value.alias),
    [exports.TypeDefInfo.Tuple]: (registry, value) => Tuple.with(getTypeClassArray(value)),
    [exports.TypeDefInfo.UInt]: (registry, value) => createInt(UInt, value),
    [exports.TypeDefInfo.Vec]: (registry, {
      sub
    }) => {
      if (!sub || Array.isArray(sub)) {
        throw new Error('Expected type information for vector');
      }
      return sub.type === 'u8' ? Bytes : Vec.with(getTypeDefType(sub));
    },
    [exports.TypeDefInfo.VecFixed]: (registry, {
      displayName,
      length,
      sub
    }) => {
      if (!util.isNumber(length) || !sub || Array.isArray(sub)) {
        throw new Error('Expected length & type information for fixed vector');
      }
      return sub.type === 'u8' ? U8aFixed.with(length * 8, displayName) : VecFixed.with(getTypeDefType(sub), length);
    },
    [exports.TypeDefInfo.WrapperKeepOpaque]: (registry, value) => createWithSub(WrapperKeepOpaque, value),
    [exports.TypeDefInfo.WrapperOpaque]: (registry, value) => createWithSub(WrapperOpaque, value)
  };
  function constructTypeClass(registry, typeDef) {
    try {
      const Type = infoMapping[typeDef.info](registry, typeDef);
      if (!Type) {
        throw new Error('No class created');
      }
      if (!Type.__fallbackType && typeDef.fallbackType) {
        Type.__fallbackType = typeDef.fallbackType;
      }
      return Type;
    } catch (error) {
      throw new Error(`Unable to construct class from ${util.stringify(typeDef)}: ${error.message}`);
    }
  }
  function getTypeClass(registry, typeDef) {
    return registry.getUnsafe(typeDef.type, false, typeDef);
  }
  function createClassUnsafe(registry, type) {
    return (
      registry.getUnsafe(type) ||
      getTypeClass(registry, registry.isLookupType(type) ? registry.lookup.getTypeDef(type) : getTypeDef(type))
    );
  }

  function checkInstance(created, matcher) {
    const u8a = created.toU8a();
    const rawType = created.toRawType();
    const isOk =
    util.u8aEq(u8a, matcher) ||
    ['Bytes', 'Text', 'Type'].includes(rawType) && matcher.length === created.length ||
    created.isEmpty && matcher.every(v => !v);
    if (!isOk) {
      throw new Error(`${rawType}:: Decoded input doesn't match input, received ${util.u8aToHex(matcher, 512)} (${matcher.length} bytes), created ${util.u8aToHex(u8a, 512)} (${u8a.length} bytes)`);
    }
  }
  function checkPedantic(created, [value]) {
    if (util.isU8a(value)) {
      checkInstance(created, value);
    } else if (util.isHex(value)) {
      checkInstance(created, util.u8aToU8a(value));
    }
  }
  function initType(registry, Type, params = [], {
    blockHash,
    isOptional,
    isPedantic
  } = {}) {
    const created = new (isOptional ? Option.with(Type) : Type)(registry, ...params);
    isPedantic && checkPedantic(created, params);
    if (blockHash) {
      created.createdAtHash = createTypeUnsafe(registry, 'Hash', [blockHash]);
    }
    return created;
  }
  function createTypeUnsafe(registry, type, params = [], options = {}) {
    let Clazz = null;
    let firstError = null;
    try {
      Clazz = createClassUnsafe(registry, type);
      return initType(registry, Clazz, params, options);
    } catch (error) {
      firstError = new Error(`createType(${type}):: ${error.message}`);
    }
    if (Clazz && Clazz.__fallbackType) {
      try {
        Clazz = createClassUnsafe(registry, Clazz.__fallbackType);
        return initType(registry, Clazz, params, options);
      } catch {
      }
    }
    throw firstError;
  }

  const stringIdentity = value => value.toString();
  const INFO_WRAP = ['BTreeMap', 'BTreeSet', 'Compact', 'HashMap', 'Option', 'Result', 'Vec'];
  function paramsNotation(outer, inner, transform = stringIdentity) {
    return `${outer}${inner ? `<${(Array.isArray(inner) ? inner : [inner]).map(transform).join(', ')}>` : ''}`;
  }
  function encodeWithParams(registry, typeDef, outer) {
    const {
      info,
      sub
    } = typeDef;
    switch (info) {
      case exports.TypeDefInfo.BTreeMap:
      case exports.TypeDefInfo.BTreeSet:
      case exports.TypeDefInfo.Compact:
      case exports.TypeDefInfo.HashMap:
      case exports.TypeDefInfo.Linkage:
      case exports.TypeDefInfo.Option:
      case exports.TypeDefInfo.Range:
      case exports.TypeDefInfo.RangeInclusive:
      case exports.TypeDefInfo.Result:
      case exports.TypeDefInfo.Vec:
      case exports.TypeDefInfo.WrapperKeepOpaque:
      case exports.TypeDefInfo.WrapperOpaque:
        return paramsNotation(outer, sub, p => encodeTypeDef(registry, p));
    }
    throw new Error(`Unable to encode ${util.stringify(typeDef)} with params`);
  }
  function encodeSubTypes(registry, sub, asEnum, extra) {
    const names = sub.map(({
      name
    }) => name);
    if (!names.every(n => !!n)) {
      throw new Error(`Subtypes does not have consistent names, ${names.join(', ')}`);
    }
    const inner = util.objectSpread({}, extra);
    for (let i = 0; i < sub.length; i++) {
      const def = sub[i];
      inner[def.name] = encodeTypeDef(registry, def);
    }
    return util.stringify(asEnum ? {
      _enum: inner
    } : inner);
  }
  const encoders = {
    [exports.TypeDefInfo.BTreeMap]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'BTreeMap'),
    [exports.TypeDefInfo.BTreeSet]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'BTreeSet'),
    [exports.TypeDefInfo.Compact]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Compact'),
    [exports.TypeDefInfo.DoNotConstruct]: (registry, {
      displayName,
      lookupIndex,
      lookupName
    }) => `DoNotConstruct<${lookupName || displayName || (util.isUndefined(lookupIndex) ? 'Unknown' : registry.createLookupType(lookupIndex))}>`,
    [exports.TypeDefInfo.Enum]: (registry, {
      sub
    }) => {
      if (!Array.isArray(sub)) {
        throw new Error('Unable to encode Enum type');
      }
      return sub.every(({
        type
      }) => type === 'Null') ? util.stringify({
        _enum: sub.map(({
          name
        }, index) => `${name || `Empty${index}`}`)
      }) : encodeSubTypes(registry, sub, true);
    },
    [exports.TypeDefInfo.HashMap]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'HashMap'),
    [exports.TypeDefInfo.Int]: (registry, {
      length = 32
    }) => `Int<${length}>`,
    [exports.TypeDefInfo.Linkage]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Linkage'),
    [exports.TypeDefInfo.Null]: (registry, typeDef) => 'Null',
    [exports.TypeDefInfo.Option]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Option'),
    [exports.TypeDefInfo.Plain]: (registry, {
      displayName,
      type
    }) => displayName || type,
    [exports.TypeDefInfo.Range]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Range'),
    [exports.TypeDefInfo.RangeInclusive]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'RangeInclusive'),
    [exports.TypeDefInfo.Result]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Result'),
    [exports.TypeDefInfo.Set]: (registry, {
      length = 8,
      sub
    }) => {
      if (!Array.isArray(sub)) {
        throw new Error('Unable to encode Set type');
      }
      return util.stringify({
        _set: sub.reduce((all, {
          index,
          name
        }, count) => util.objectSpread(all, {
          [`${name || `Unknown${index || count}`}`]: index || count
        }), {
          _bitLength: length || 8
        })
      });
    },
    [exports.TypeDefInfo.Si]: (registry, {
      lookupName,
      type
    }) => lookupName || type,
    [exports.TypeDefInfo.Struct]: (registry, {
      alias,
      sub
    }) => {
      if (!Array.isArray(sub)) {
        throw new Error('Unable to encode Struct type');
      }
      return encodeSubTypes(registry, sub, false, alias ? {
        _alias: [...alias.entries()].reduce((all, [k, v]) => util.objectSpread(all, {
          [k]: v
        }), {})
      } : {});
    },
    [exports.TypeDefInfo.Tuple]: (registry, {
      sub
    }) => {
      if (!Array.isArray(sub)) {
        throw new Error('Unable to encode Tuple type');
      }
      return `(${sub.map(type => encodeTypeDef(registry, type)).join(',')})`;
    },
    [exports.TypeDefInfo.UInt]: (registry, {
      length = 32
    }) => `UInt<${length}>`,
    [exports.TypeDefInfo.Vec]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'Vec'),
    [exports.TypeDefInfo.VecFixed]: (registry, {
      length,
      sub
    }) => {
      if (!util.isNumber(length) || !sub || Array.isArray(sub)) {
        throw new Error('Unable to encode VecFixed type');
      }
      return `[${sub.type};${length}]`;
    },
    [exports.TypeDefInfo.WrapperKeepOpaque]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'WrapperKeepOpaque'),
    [exports.TypeDefInfo.WrapperOpaque]: (registry, typeDef) => encodeWithParams(registry, typeDef, 'WrapperOpaque')
  };
  function encodeType(registry, typeDef, withLookup = true) {
    return withLookup && typeDef.lookupName ? typeDef.lookupName : encoders[typeDef.info](registry, typeDef);
  }
  function encodeTypeDef(registry, typeDef) {
    return typeDef.displayName && !INFO_WRAP.some(i => typeDef.displayName === i) ? typeDef.displayName : encodeType(registry, typeDef);
  }
  function withTypeString(registry, typeDef) {
    return util.objectSpread({}, typeDef, {
      type: encodeType(registry, typeDef, false)
    });
  }

  const XCM_MAPPINGS = ['AssetInstance', 'Fungibility', 'Junction', 'Junctions', 'MultiAsset', 'MultiAssetFilter', 'MultiLocation', 'Response', 'WildFungibility', 'WildMultiAsset', 'Xcm', 'XcmError', 'XcmOrder'];
  function mapXcmTypes(version) {
    return XCM_MAPPINGS.reduce((all, key) => util.objectSpread(all, {
      [key]: `${key}${version}`
    }), {});
  }

  const v0 = {
    FungibilityV0: 'FungibilityV1',
    WildFungibilityV0: 'WildFungibilityV1',
    AssetInstanceV0: {
      _enum: {
        Undefined: 'Null',
        Index8: 'u8',
        Index16: 'Compact<u16>',
        Index32: 'Compact<u32>',
        Index64: 'Compact<u64>',
        Index128: 'Compact<u128>',
        Array4: '[u8; 4]',
        Array8: '[u8; 8]',
        Array16: '[u8; 16]',
        Array32: '[u8; 32]',
        Blob: 'Vec<u8>'
      }
    },
    JunctionV0: {
      _enum: {
        Parent: 'Null',
        Parachain: 'Compact<u32>',
        AccountId32: {
          network: 'NetworkId',
          id: 'AccountId'
        },
        AccountIndex64: {
          network: 'NetworkId',
          index: 'Compact<u64>'
        },
        AccountKey20: {
          network: 'NetworkId',
          key: '[u8; 20]'
        },
        PalletInstance: 'u8',
        GeneralIndex: 'Compact<u128>',
        GeneralKey: 'Vec<u8>',
        OnlyChild: 'Null',
        Plurality: {
          id: 'BodyId',
          part: 'BodyPart'
        }
      }
    },
    MultiAssetV0: {
      _enum: {
        None: 'Null',
        All: 'Null',
        AllFungible: 'Null',
        AllNonFungible: 'Null',
        AllAbstractFungible: 'Vec<u8>',
        AllAbstractNonFungible: 'Vec<u8>',
        AllConcreteFungible: 'MultiLocationV0',
        AllConcreteNonFungible: 'MultiLocationV0',
        AbstractFungible: {
          id: 'Vec<u8>',
          instance: 'Compact<u128>'
        },
        AbstractNonFungible: {
          class: 'Vec<u8>',
          instance: 'AssetInstanceV0'
        },
        ConcreteFungible: {
          id: 'MultiLocationV0',
          amount: 'Compact<u128>'
        },
        ConcreteNonFungible: {
          class: 'MultiLocationV0',
          instance: 'AssetInstanceV0'
        }
      }
    },
    MultiLocationV0: {
      _enum: {
        Here: 'Null',
        X1: 'JunctionV0',
        X2: '(JunctionV0, JunctionV0)',
        X3: '(JunctionV0, JunctionV0, JunctionV0)',
        X4: '(JunctionV0, JunctionV0, JunctionV0, JunctionV0)',
        X5: '(JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0)',
        X6: '(JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0)',
        X7: '(JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0)',
        X8: '(JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0, JunctionV0)'
      }
    },
    OriginKindV0: {
      _enum: ['Native', 'SovereignAccount', 'Superuser', 'Xcm']
    },
    ResponseV0: {
      _enum: {
        Assets: 'Vec<MultiAssetV0>'
      }
    },
    XcmV0: {
      _enum: {
        WithdrawAsset: {
          assets: 'Vec<MultiAssetV0>',
          effects: 'Vec<XcmOrderV0>'
        },
        ReserveAssetDeposit: {
          assets: 'Vec<MultiAssetV0>',
          effects: 'Vec<XcmOrderV0>'
        },
        ReceiveTeleportedAsset: {
          assets: 'Vec<MultiAssetV0>',
          effects: 'Vec<XcmOrderV0>'
        },
        QueryResponse: {
          queryId: 'Compact<u64>',
          response: 'ResponseV0'
        },
        TransferAsset: {
          assets: 'Vec<MultiAssetV0>',
          dest: 'MultiLocationV0'
        },
        TransferReserveAsset: {
          assets: 'Vec<MultiAssetV0>',
          dest: 'MultiLocationV0',
          effects: 'Vec<XcmOrderV0>'
        },
        Transact: {
          originType: 'XcmOriginKind',
          requireWeightAtMost: 'u64',
          call: 'DoubleEncodedCall'
        },
        HrmpNewChannelOpenRequest: {
          sender: 'Compact<u32>',
          maxMessageSize: 'Compact<u32>',
          maxCapacity: 'Compact<u32>'
        },
        HrmpChannelAccepted: {
          recipient: 'Compact<u32>'
        },
        HrmpChannelClosing: {
          initiator: 'Compact<u32>',
          sender: 'Compact<u32>',
          recipient: 'Compact<u32>'
        },
        RelayedFrom: {
          who: 'MultiLocationV0',
          message: 'XcmV0'
        }
      }
    },
    XcmErrorV0: {
      _enum: {
        Undefined: 'Null',
        Overflow: 'Null',
        Unimplemented: 'Null',
        UnhandledXcmVersion: 'Null',
        UnhandledXcmMessage: 'Null',
        UnhandledEffect: 'Null',
        EscalationOfPrivilege: 'Null',
        UntrustedReserveLocation: 'Null',
        UntrustedTeleportLocation: 'Null',
        DestinationBufferOverflow: 'Null',
        SendFailed: 'Null',
        CannotReachDestination: '(MultiLocation, Xcm)',
        MultiLocationFull: 'Null',
        FailedToDecode: 'Null',
        BadOrigin: 'Null',
        ExceedsMaxMessageSize: 'Null',
        FailedToTransactAsset: 'Null',
        WeightLimitReached: 'Weight',
        Wildcard: 'Null',
        TooMuchWeightRequired: 'Null',
        NotHoldingFees: 'Null',
        WeightNotComputable: 'Null',
        Barrier: 'Null',
        NotWithdrawable: 'Null',
        LocationCannotHold: 'Null',
        TooExpensive: 'Null',
        AssetNotFound: 'Null',
        RecursionLimitReached: 'Null'
      }
    },
    XcmOrderV0: {
      _enum: {
        Null: 'Null',
        DepositAsset: {
          assets: 'Vec<MultiAssetV0>',
          dest: 'MultiLocationV0'
        },
        DepositReserveAsset: {
          assets: 'Vec<MultiAssetV0>',
          dest: 'MultiLocationV0',
          effects: 'Vec<XcmOrderV0>'
        },
        ExchangeAsset: {
          give: 'Vec<MultiAssetV0>',
          receive: 'Vec<MultiAssetV0>'
        },
        InitiateReserveWithdraw: {
          assets: 'Vec<MultiAssetV0>',
          reserve: 'MultiLocationV0',
          effects: 'Vec<XcmOrderV0>'
        },
        InitiateTeleport: {
          assets: 'Vec<MultiAssetV0>',
          dest: 'MultiLocationV0',
          effects: 'Vec<XcmOrderV0>'
        },
        QueryHolding: {
          queryId: 'Compact<u64>',
          dest: 'MultiLocationV0',
          assets: 'Vec<MultiAssetV0>'
        },
        BuyExecution: {
          fees: 'MultiAssetV0',
          weight: 'u64',
          debt: 'u64',
          haltOnError: 'bool',
          xcm: 'Vec<XcmV0>'
        }
      }
    }
  };

  const v1 = {
    AssetInstanceV1: {
      _enum: {
        Undefined: 'Null',
        Index: 'Compact<u128>',
        Array4: '[u8; 4]',
        Array8: '[u8; 8]',
        Array16: '[u8; 16]',
        Array32: '[u8; 32]',
        Blob: 'Bytes'
      }
    },
    FungibilityV1: {
      _enum: {
        Fungible: 'Compact<u128>',
        NonFungible: 'AssetInstanceV1'
      }
    },
    JunctionV1: {
      _enum: {
        Parachain: 'Compact<u32>',
        AccountId32: {
          network: 'NetworkId',
          id: 'AccountId'
        },
        AccountIndex64: {
          network: 'NetworkId',
          index: 'Compact<u64>'
        },
        AccountKey20: {
          network: 'NetworkId',
          key: '[u8; 20]'
        },
        PalletInstance: 'u8',
        GeneralIndex: 'Compact<u128>',
        GeneralKey: 'Vec<u8>',
        OnlyChild: 'Null',
        Plurality: {
          id: 'BodyId',
          part: 'BodyPart'
        }
      }
    },
    JunctionsV1: {
      _enum: {
        Here: 'Null',
        X1: 'JunctionV1',
        X2: '(JunctionV1, JunctionV1)',
        X3: '(JunctionV1, JunctionV1, JunctionV1)',
        X4: '(JunctionV1, JunctionV1, JunctionV1, JunctionV1)',
        X5: '(JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1)',
        X6: '(JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1)',
        X7: '(JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1)',
        X8: '(JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1, JunctionV1)'
      }
    },
    MultiAssetsV1: 'Vec<MultiAssetV1>',
    MultiAssetV1: {
      id: 'XcmAssetId',
      fungibility: 'FungibilityV1'
    },
    MultiAssetFilterV1: {
      _enum: {
        Definite: 'MultiAssetsV1',
        Wild: 'WildMultiAssetV1'
      }
    },
    MultiLocationV1: {
      parents: 'u8',
      interior: 'JunctionsV1'
    },
    OriginKindV1: 'OriginKindV0',
    ResponseV1: {
      _enum: {
        Assets: 'MultiAssetsV1'
      }
    },
    WildFungibilityV1: {
      _enum: ['Fungible', 'NonFungible']
    },
    WildMultiAssetV1: {
      _enum: {
        All: 'Null',
        AllOf: {
          id: 'XcmAssetId',
          fungibility: 'WildFungibilityV1'
        }
      }
    },
    XcmV1: {
      _enum: {
        WithdrawAsset: {
          assets: 'MultiAssetsV1',
          effects: 'Vec<XcmOrderV1>'
        },
        ReserveAssetDeposit: {
          assets: 'MultiAssetsV1',
          effects: 'Vec<XcmOrderV1>'
        },
        ReceiveTeleportedAsset: {
          assets: 'MultiAssetsV1',
          effects: 'Vec<XcmOrderV1>'
        },
        QueryResponse: {
          queryId: 'Compact<u64>',
          response: 'ResponseV1'
        },
        TransferAsset: {
          assets: 'MultiAssetsV1',
          dest: 'MultiLocationV1'
        },
        TransferReserveAsset: {
          assets: 'MultiAssetsV1',
          dest: 'MultiLocationV1',
          effects: 'Vec<XcmOrderV1>'
        },
        Transact: {
          originType: 'XcmOriginKind',
          requireWeightAtMost: 'u64',
          call: 'DoubleEncodedCall'
        },
        HrmpNewChannelOpenRequest: {
          sender: 'Compact<u32>',
          maxMessageSize: 'Compact<u32>',
          maxCapacity: 'Compact<u32>'
        },
        HrmpChannelAccepted: {
          recipient: 'Compact<u32>'
        },
        HrmpChannelClosing: {
          initiator: 'Compact<u32>',
          sender: 'Compact<u32>',
          recipient: 'Compact<u32>'
        },
        RelayedFrom: {
          who: 'MultiLocationV1',
          message: 'XcmV1'
        }
      }
    },
    XcmErrorV1: {
      _enum: {
        Undefined: 'Null',
        Overflow: 'Null',
        Unimplemented: 'Null',
        UnhandledXcmVersion: 'Null',
        UnhandledXcmMessage: 'Null',
        UnhandledEffect: 'Null',
        EscalationOfPrivilege: 'Null',
        UntrustedReserveLocation: 'Null',
        UntrustedTeleportLocation: 'Null',
        DestinationBufferOverflow: 'Null',
        SendFailed: 'Null',
        CannotReachDestination: '(MultiLocationV1, XcmV1)',
        MultiLocationFull: 'Null',
        FailedToDecode: 'Null',
        BadOrigin: 'Null',
        ExceedsMaxMessageSize: 'Null',
        FailedToTransactAsset: 'Null',
        WeightLimitReached: 'Weight',
        Wildcard: 'Null',
        TooMuchWeightRequired: 'Null',
        NotHoldingFees: 'Null',
        WeightNotComputable: 'Null',
        Barrier: 'Null',
        NotWithdrawable: 'Null',
        LocationCannotHold: 'Null',
        TooExpensive: 'Null',
        AssetNotFound: 'Null',
        DestinationUnsupported: 'Null',
        RecursionLimitReached: 'Null'
      }
    },
    XcmOrderV1: {
      _enum: {
        Noop: 'Null',
        DepositAsset: {
          assets: 'MultiAssetFilterV1',
          maxAssets: 'u32',
          beneficiary: 'MultiLocationV1'
        },
        DepositReserveAsset: {
          assets: 'MultiAssetFilterV1',
          maxAssets: 'u32',
          dest: 'MultiLocationV1',
          effects: 'Vec<XcmOrderV1>'
        },
        ExchangeAsset: {
          give: 'MultiAssetFilterV1',
          receive: 'MultiAssetsV1'
        },
        InitiateReserveWithdraw: {
          assets: 'MultiAssetFilterV1',
          reserve: 'MultiLocationV1',
          effects: 'Vec<XcmOrderV1>'
        },
        InitiateTeleport: {
          assets: 'MultiAssetFilterV1',
          dest: 'MultiLocationV1',
          effects: 'Vec<XcmOrderV1>'
        },
        QueryHolding: {
          queryId: 'Compact<u64>',
          dest: 'MultiLocationV1',
          assets: 'MultiAssetFilterV1'
        },
        BuyExecution: {
          fees: 'MultiAssetV1',
          weight: 'u64',
          debt: 'u64',
          haltOnError: 'bool',
          instructions: 'Vec<XcmV1>'
        }
      }
    }
  };

  const v2 = {
    AssetInstanceV2: 'AssetInstanceV1',
    FungibilityV2: 'FungibilityV1',
    JunctionV2: 'JunctionV1',
    JunctionsV2: 'JunctionsV1',
    MultiAssetsV2: 'MultiAssetsV1',
    MultiAssetV2: 'MultiAssetV1',
    MultiAssetFilterV2: 'MultiAssetFilterV1',
    MultiLocationV2: 'MultiLocationV1',
    OriginKindV2: 'OriginKindV1',
    WildFungibilityV2: 'WildFungibilityV1',
    ResponseV2: {
      _enum: {
        Null: 'Null',
        Assets: 'MultiAssetsV2',
        ExecutionResult: 'ResponseV2Result'
      }
    },
    ResponseV2Error: '(u32, XcmErrorV2)',
    ResponseV2Result: 'Result<Null, ResponseV2Error>',
    WeightLimitV2: {
      _enum: {
        Unlimited: 'Null',
        Limited: 'Compact<u64>'
      }
    },
    InstructionV2: {
      _enum: {
        WithdrawAsset: 'MultiAssetsV2',
        ReserveAssetDeposited: 'MultiAssetsV2',
        ReceiveTeleportedAsset: 'MultiAssetsV2',
        QueryResponse: {
          queryId: 'Compact<u64>',
          response: 'ResponseV2',
          maxWeight: 'Compact<u64>'
        },
        TransferAsset: {
          assets: 'MultiAssetsV2',
          beneficiary: 'MultiLocationV2'
        },
        TransferReserveAsset: {
          assets: 'MultiAssetsV2',
          dest: 'MultiLocationV2',
          xcm: 'XcmV2'
        },
        Transact: {
          originType: 'OriginKindV2',
          requireWeightAtMost: 'u64',
          call: 'DoubleEncodedCall'
        },
        HrmpNewChannelOpenRequest: {
          sender: 'Compact<u32>',
          maxMessageSize: 'Compact<u32>',
          maxCapacity: 'Compact<u32>'
        },
        HrmpChannelAccepted: {
          recipient: 'Compact<u32>'
        },
        HrmpChannelClosing: {
          initiator: 'Compact<u32>',
          sender: 'Compact<u32>',
          recipient: 'Compact<u32>'
        },
        ClearOrigin: 'Null',
        DescendOrigin: 'InteriorMultiLocation',
        ReportError: {
          queryId: 'Compact<u64>',
          dest: 'MultiLocationV2',
          maxResponseWeight: 'Compact<u64>'
        },
        DepositAsset: {
          assets: 'MultiAssetFilterV2',
          maxAssets: 'u32',
          beneficiary: 'MultiLocationV2'
        },
        DepositReserveAsset: {
          assets: 'MultiAssetFilterV2',
          maxAssets: 'u32',
          dest: 'MultiLocationV2',
          xcm: 'XcmV2'
        },
        ExchangeAsset: {
          give: 'MultiAssetFilterV2',
          receive: 'MultiAssetsV2'
        },
        InitiateReserveWithdraw: {
          assets: 'MultiAssetFilterV2',
          reserve: 'MultiLocationV2',
          xcm: 'XcmV2'
        },
        InitiateTeleport: {
          assets: 'MultiAssetFilterV2',
          dest: 'MultiLocationV2',
          xcm: 'XcmV2'
        },
        QueryHolding: {
          query_id: 'Compact<u64>',
          dest: 'MultiLocationV2',
          assets: 'MultiAssetFilterV2',
          maxResponse_Weight: 'Compact<u64>'
        },
        BuyExecution: {
          fees: 'MultiAssetV2',
          weightLimit: 'WeightLimitV2'
        },
        RefundSurplus: 'Null',
        SetErrorHandler: 'XcmV2',
        SetAppendix: 'XcmV2',
        ClearError: 'Null',
        ClaimAsset: {
          assets: 'MultiAssetsV2',
          ticket: 'MultiLocationV2'
        },
        Trap: 'u64'
      }
    },
    WildMultiAssetV2: 'WildMultiAssetV1',
    XcmV2: 'Vec<InstructionV2>',
    XcmErrorV2: {
      _enum: {
        Undefined: 'Null',
        Overflow: 'Null',
        Unimplemented: 'Null',
        UnhandledXcmVersion: 'Null',
        UnhandledXcmMessage: 'Null',
        UnhandledEffect: 'Null',
        EscalationOfPrivilege: 'Null',
        UntrustedReserveLocation: 'Null',
        UntrustedTeleportLocation: 'Null',
        DestinationBufferOverflow: 'Null',
        MultiLocationFull: 'Null',
        MultiLocationNotInvertible: 'Null',
        FailedToDecode: 'Null',
        BadOrigin: 'Null',
        ExceedsMaxMessageSize: 'Null',
        FailedToTransactAsset: 'Null',
        WeightLimitReached: 'Weight',
        Wildcard: 'Null',
        TooMuchWeightRequired: 'Null',
        NotHoldingFees: 'Null',
        WeightNotComputable: 'Null',
        Barrier: 'Null',
        NotWithdrawable: 'Null',
        LocationCannotHold: 'Null',
        TooExpensive: 'Null',
        AssetNotFound: 'Null',
        DestinationUnsupported: 'Null',
        RecursionLimitReached: 'Null',
        Transport: 'Null',
        Unroutable: 'Null',
        UnknownWeightRequired: 'Null',
        Trap: 'u64',
        UnknownClaim: 'Null',
        InvalidLocation: 'Null'
      }
    },
    XcmOrderV2: 'XcmOrderV1'
  };

  const XCM_LATEST = 'V2';
  const xcm = {
    XcmOrigin: {
      _enum: {
        Xcm: 'MultiLocation'
      }
    },
    XcmpMessageFormat: {
      _enum: ['ConcatenatedVersionedXcm', 'ConcatenatedEncodedBlob', 'Signals']
    },
    XcmAssetId: {
      _enum: {
        Concrete: 'MultiLocation',
        Abstract: 'Bytes'
      }
    },
    InboundStatus: {
      _enum: ['Ok', 'Suspended']
    },
    OutboundStatus: {
      _enum: ['Ok', 'Suspended']
    },
    MultiAssets: 'Vec<MultiAsset>'
  };
  const location = {
    BodyId: {
      _enum: {
        Unit: 'Null',
        Named: 'Vec<u8>',
        Index: 'Compact<u32>',
        Executive: 'Null',
        Technical: 'Null',
        Legislative: 'Null',
        Judicial: 'Null'
      }
    },
    BodyPart: {
      _enum: {
        Voice: 'Null',
        Members: 'Compact<u32>',
        Fraction: {
          nom: 'Compact<u32>',
          denom: 'Compact<u32>'
        },
        AtLeastProportion: {
          nom: 'Compact<u32>',
          denom: 'Compact<u32>'
        },
        MoreThanProportion: {
          nom: 'Compact<u32>',
          denom: 'Compact<u32>'
        }
      }
    },
    InteriorMultiLocation: 'Junctions',
    NetworkId: {
      _enum: {
        Any: 'Null',
        Named: 'Vec<u8>',
        Polkadot: 'Null',
        Kusama: 'Null'
      }
    }
  };
  const definitions$d = {
    rpc: {},
    types: util.objectSpread({}, location, xcm, v0, v1, v2, mapXcmTypes(XCM_LATEST), {
      DoubleEncodedCall: {
        encoded: 'Vec<u8>'
      },
      XcmOriginKind: {
        _enum: ['Native', 'SovereignAccount', 'Superuser', 'Xcm']
      },
      Outcome: {
        _enum: {
          Complete: 'Weight',
          Incomplete: '(Weight, XcmErrorV0)',
          Error: 'XcmErrorV0'
        }
      },
      QueryId: 'u64',
      QueryStatus: {
        _enum: {
          Pending: {
            responder: 'VersionedMultiLocation',
            maybeNotify: 'Option<(u8, u8)>',
            timeout: 'BlockNumber'
          },
          Ready: {
            response: 'VersionedResponse',
            at: 'BlockNumber'
          }
        }
      },
      QueueConfigData: {
        suspendThreshold: 'u32',
        dropThreshold: 'u32',
        resumeThreshold: 'u32',
        thresholdWeight: 'Weight',
        weightRestrictDecay: 'Weight'
      },
      VersionMigrationStage: {
        _enum: {
          MigrateSupportedVersion: 'Null',
          MigrateVersionNotifiers: 'Null',
          NotifyCurrentTargets: 'Option<Bytes>',
          MigrateAndNotifyOldTargets: 'Null'
        }
      },
      VersionedMultiAsset: {
        _enum: {
          V0: 'MultiAssetV0',
          V1: 'MultiAssetV1',
          V2: 'MultiAssetV2'
        }
      },
      VersionedMultiAssets: {
        _enum: {
          V0: 'Vec<MultiAssetV0>',
          V1: 'MultiAssetsV1',
          V2: 'MultiAssetsV2'
        }
      },
      VersionedMultiLocation: {
        _enum: {
          V0: 'MultiLocationV0',
          V1: 'MultiLocationV1',
          V2: 'MultiLocationV2'
        }
      },
      VersionedResponse: {
        V0: 'ResponseV0',
        V1: 'ResponseV1',
        V2: 'ResponseV2'
      },
      VersionedXcm: {
        _enum: {
          V0: 'XcmV0',
          V1: 'XcmV1',
          V2: 'XcmV2'
        }
      },
      XcmVersion: 'u32'
    })
  };

  const layout = {
    ContractCryptoHasher: {
      _enum: ['Blake2x256', 'Sha2x256', 'Keccak256']
    },
    ContractDiscriminant: 'u32',
    ContractLayoutArray: {
      offset: 'ContractLayoutKey',
      len: 'u32',
      cellsPerElem: 'u64',
      layout: 'ContractStorageLayout'
    },
    ContractLayoutCell: {
      key: 'ContractLayoutKey',
      ty: 'SiLookupTypeId'
    },
    ContractLayoutEnum: {
      dispatchKey: 'ContractLayoutKey',
      variants: 'BTreeMap<ContractDiscriminant, ContractLayoutStruct>'
    },
    ContractLayoutHash: {
      offset: 'ContractLayoutKey',
      strategy: 'ContractLayoutHashingStrategy',
      layout: 'ContractStorageLayout'
    },
    ContractLayoutHashingStrategy: {
      hasher: 'ContractCryptoHasher',
      postfix: 'Vec<u8>',
      prefix: 'Vec<u8>'
    },
    ContractLayoutKey: '[u8; 32]',
    ContractLayoutStruct: {
      fields: 'Vec<ContractLayoutStructField>'
    },
    ContractLayoutStructField: {
      layout: 'ContractStorageLayout',
      name: 'Text'
    },
    ContractStorageLayout: {
      _enum: {
        Cell: 'ContractLayoutCell',
        Hash: 'ContractLayoutHash',
        Array: 'ContractLayoutArray',
        Struct: 'ContractLayoutStruct',
        Enum: 'ContractLayoutEnum'
      }
    }
  };
  const spec = {
    ContractConstructorSpecV0: {
      name: 'Text',
      selector: 'ContractSelector',
      args: 'Vec<ContractMessageParamSpecV0>',
      docs: 'Vec<Text>'
    },
    ContractConstructorSpecV1: {
      name: 'Vec<Text>',
      selector: 'ContractSelector',
      args: 'Vec<ContractMessageParamSpecV0>',
      docs: 'Vec<Text>'
    },
    ContractConstructorSpecV2: {
      label: 'Text',
      selector: 'ContractSelector',
      args: 'Vec<ContractMessageParamSpecV2>',
      docs: 'Vec<Text>'
    },
    ContractConstructorSpecV3: {
      label: 'Text',
      selector: 'ContractSelector',
      payable: 'bool',
      args: 'Vec<ContractMessageParamSpecV2>',
      docs: 'Vec<Text>'
    },
    ContractContractSpecV0: {
      constructors: 'Vec<ContractConstructorSpecV0>',
      messages: 'Vec<ContractMessageSpecV0>',
      events: 'Vec<ContractEventSpecV0>',
      docs: 'Vec<Text>'
    },
    ContractContractSpecV1: {
      constructors: 'Vec<ContractConstructorSpecV1>',
      messages: 'Vec<ContractMessageSpecV1>',
      events: 'Vec<ContractEventSpecV1>',
      docs: 'Vec<Text>'
    },
    ContractContractSpecV2: {
      constructors: 'Vec<ContractConstructorSpecV2>',
      messages: 'Vec<ContractMessageSpecV2>',
      events: 'Vec<ContractEventSpecV2>',
      docs: 'Vec<Text>'
    },
    ContractContractSpecV3: {
      constructors: 'Vec<ContractConstructorSpecV3>',
      messages: 'Vec<ContractMessageSpecV2>',
      events: 'Vec<ContractEventSpecV2>',
      docs: 'Vec<Text>'
    },
    ContractContractSpecV4: 'ContractContractSpecV3',
    ContractDisplayName: 'SiPath',
    ContractEventParamSpecV0: {
      name: 'Text',
      indexed: 'bool',
      type: 'ContractTypeSpec',
      docs: 'Vec<Text>'
    },
    ContractEventParamSpecV2: {
      label: 'Text',
      indexed: 'bool',
      type: 'ContractTypeSpec',
      docs: 'Vec<Text>'
    },
    ContractEventSpecV0: {
      name: 'Text',
      args: 'Vec<ContractEventParamSpecV0>',
      docs: 'Vec<Text>'
    },
    ContractEventSpecV1: {
      name: 'Text',
      args: 'Vec<ContractEventParamSpecV0>',
      docs: 'Vec<Text>'
    },
    ContractEventSpecV2: {
      label: 'Text',
      args: 'Vec<ContractEventParamSpecV2>',
      docs: 'Vec<Text>'
    },
    ContractMessageParamSpecV0: {
      name: 'Text',
      type: 'ContractTypeSpec'
    },
    ContractMessageParamSpecV2: {
      label: 'Text',
      type: 'ContractTypeSpec'
    },
    ContractMessageSpecV0: {
      name: 'Text',
      selector: 'ContractSelector',
      mutates: 'bool',
      payable: 'bool',
      args: 'Vec<ContractMessageParamSpecV0>',
      returnType: 'Option<ContractTypeSpec>',
      docs: 'Vec<Text>'
    },
    ContractMessageSpecV1: {
      name: 'Vec<Text>',
      selector: 'ContractSelector',
      mutates: 'bool',
      payable: 'bool',
      args: 'Vec<ContractMessageParamSpecV0>',
      returnType: 'Option<ContractTypeSpec>',
      docs: 'Vec<Text>'
    },
    ContractMessageSpecV2: {
      label: 'Text',
      selector: 'ContractSelector',
      mutates: 'bool',
      payable: 'bool',
      args: 'Vec<ContractMessageParamSpecV2>',
      returnType: 'Option<ContractTypeSpec>',
      docs: 'Vec<Text>'
    },
    ContractSelector: '[u8; 4]',
    ContractTypeSpec: {
      type: 'SiLookupTypeId',
      displayName: 'ContractDisplayName'
    }
  };
  const ContractMetadataV0 = {
    metadataVersion: 'Text',
    types: 'Vec<Si0Type>',
    spec: 'ContractContractSpecV0'
  };
  const ContractMetadataV1 = {
    types: 'Vec<PortableType>',
    spec: 'ContractContractSpecV1'
  };
  const ContractMetadataV2 = {
    types: 'Vec<PortableType>',
    spec: 'ContractContractSpecV2'
  };
  const ContractMetadataV3 = {
    types: 'Vec<PortableType>',
    spec: 'ContractContractSpecV3'
  };
  const ContractMetadataV4 = ContractMetadataV3;
  const ContractProjectInfo = {
    source: 'ContractProjectSource',
    contract: 'ContractProjectContract'
  };
  const latest = {
    ContractConstructorSpecLatest: 'ContractConstructorSpecV3',
    ContractEventSpecLatest: 'ContractEventSpecV2',
    ContractEventParamSpecLatest: 'ContractEventParamSpecV2',
    ContractMessageParamSpecLatest: 'ContractMessageParamSpecV2',
    ContractMessageSpecLatest: 'ContractMessageSpecV2',
    ContractMetadataLatest: 'ContractMetadataV4'
  };
  const definitions$c = {
    rpc: {},
    types: util.objectSpread({}, layout, spec, latest, {
      ContractProjectInfo,
      ContractMetadataV0,
      ContractMetadataV1,
      ContractMetadataV2,
      ContractMetadataV3,
      ContractMetadataV4,
      ContractMetadata: {
        _enum: {
          V0: 'ContractMetadataV0',
          V1: 'ContractMetadataV1',
          V2: 'ContractMetadataV2',
          V3: 'ContractMetadataV3',
          V4: 'ContractMetadataV4'
        }
      },
      ContractProjectV0: util.objectSpread({
        metadataVersion: 'Text'
      }, ContractProjectInfo, ContractMetadataV0),
      ContractProject: '(ContractProjectInfo, ContractMetadata)',
      ContractProjectContract: {
        _alias: {
          docs: 'documentation'
        },
        name: 'Text',
        version: 'Text',
        authors: 'Vec<Text>',
        description: 'Option<Text>',
        docs: 'Option<Text>',
        repository: 'Option<Text>',
        homepage: 'Option<Text>',
        license: 'Option<Text>'
      },
      ContractProjectSource: {
        _alias: {
          wasmHash: 'hash'
        },
        wasmHash: '[u8; 32]',
        language: 'Text',
        compiler: 'Text',
        wasm: 'Raw'
      }
    })
  };

  const netRpc = {
    listening: {
      aliasSection: 'net',
      description: 'Returns true if client is actively listening for network connections. Otherwise false.',
      params: [],
      type: 'bool'
    },
    peerCount: {
      aliasSection: 'net',
      description: 'Returns number of peers connected to node.',
      params: [],
      type: 'Text'
    },
    version: {
      aliasSection: 'net',
      description: 'Returns protocol version.',
      params: [],
      type: 'Text'
    }
  };
  const web3Rpc = {
    clientVersion: {
      aliasSection: 'web3',
      description: 'Returns current client version.',
      params: [],
      type: 'Text'
    },
    sha3: {
      aliasSection: 'web3',
      description: 'Returns sha3 of the given data',
      params: [{
        name: 'data',
        type: 'Bytes'
      }],
      type: 'H256'
    }
  };
  const rpc$7 = util.objectSpread({}, netRpc, web3Rpc, {
    accounts: {
      description: 'Returns accounts list.',
      params: [],
      type: 'Vec<H160>'
    },
    blockNumber: {
      description: 'Returns the blockNumber',
      params: [],
      type: 'U256'
    },
    call: {
      description: 'Call contract, returning the output data.',
      params: [{
        name: 'request',
        type: 'EthCallRequest'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'Bytes'
    },
    chainId: {
      description: 'Returns the chain ID used for transaction signing at the current best block. None is returned if not available.',
      params: [],
      type: 'U64'
    },
    coinbase: {
      description: 'Returns block author.',
      params: [],
      type: 'H160'
    },
    estimateGas: {
      description: 'Estimate gas needed for execution of given contract.',
      params: [{
        name: 'request',
        type: 'EthCallRequest'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'U256'
    },
    feeHistory: {
      description: 'Returns fee history for given block count & reward percentiles',
      params: [{
        name: 'blockCount',
        type: 'U256'
      }, {
        name: 'newestBlock',
        type: 'BlockNumber'
      }, {
        name: 'rewardPercentiles',
        type: 'Option<Vec<f64>>'
      }],
      type: 'EthFeeHistory'
    },
    gasPrice: {
      description: 'Returns current gas price.',
      params: [],
      type: 'U256'
    },
    getBalance: {
      description: 'Returns balance of the given account.',
      params: [{
        name: 'address',
        type: 'H160'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'U256'
    },
    getBlockByHash: {
      description: 'Returns block with given hash.',
      params: [{
        name: 'hash',
        type: 'H256'
      }, {
        name: 'full',
        type: 'bool'
      }],
      type: 'Option<EthRichBlock>'
    },
    getBlockByNumber: {
      description: 'Returns block with given number.',
      params: [{
        name: 'block',
        type: 'BlockNumber'
      }, {
        name: 'full',
        type: 'bool'
      }],
      type: 'Option<EthRichBlock>'
    },
    getBlockTransactionCountByHash: {
      description: 'Returns the number of transactions in a block with given hash.',
      params: [{
        name: 'hash',
        type: 'H256'
      }],
      type: 'U256'
    },
    getBlockTransactionCountByNumber: {
      description: 'Returns the number of transactions in a block with given block number.',
      params: [{
        name: 'block',
        type: 'BlockNumber'
      }],
      type: 'U256'
    },
    getCode: {
      description: 'Returns the code at given address at given time (block number).',
      params: [{
        name: 'address',
        type: 'H160'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'Bytes'
    },
    getFilterChanges: {
      description: 'Returns filter changes since last poll.',
      params: [{
        name: 'index',
        type: 'U256'
      }],
      type: 'EthFilterChanges'
    },
    getFilterLogs: {
      description: 'Returns all logs matching given filter (in a range \'from\' - \'to\').',
      params: [{
        name: 'index',
        type: 'U256'
      }],
      type: 'Vec<EthLog>'
    },
    getLogs: {
      description: 'Returns logs matching given filter object.',
      params: [{
        name: 'filter',
        type: 'EthFilter'
      }],
      type: 'Vec<EthLog>'
    },
    getProof: {
      description: 'Returns proof for account and storage.',
      params: [{
        name: 'address',
        type: 'H160'
      }, {
        name: 'storageKeys',
        type: 'Vec<H256>'
      }, {
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'EthAccount'
    },
    getStorageAt: {
      description: 'Returns content of the storage at given address.',
      params: [{
        name: 'address',
        type: 'H160'
      }, {
        name: 'index',
        type: 'U256'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'H256'
    },
    getTransactionByBlockHashAndIndex: {
      description: 'Returns transaction at given block hash and index.',
      params: [{
        name: 'hash',
        type: 'H256'
      }, {
        name: 'index',
        type: 'U256'
      }],
      type: 'EthTransaction'
    },
    getTransactionByBlockNumberAndIndex: {
      description: 'Returns transaction by given block number and index.',
      params: [{
        name: 'number',
        type: 'BlockNumber'
      }, {
        name: 'index',
        type: 'U256'
      }],
      type: 'EthTransaction'
    },
    getTransactionByHash: {
      description: 'Get transaction by its hash.',
      params: [{
        name: 'hash',
        type: 'H256'
      }],
      type: 'EthTransaction'
    },
    getTransactionCount: {
      description: 'Returns the number of transactions sent from given address at given time (block number).',
      params: [{
        name: 'hash',
        type: 'H256'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'U256'
    },
    getTransactionReceipt: {
      description: 'Returns transaction receipt by transaction hash.',
      params: [{
        name: 'hash',
        type: 'H256'
      }],
      type: 'EthReceipt'
    },
    getUncleByBlockHashAndIndex: {
      description: 'Returns an uncles at given block and index.',
      params: [{
        name: 'hash',
        type: 'H256'
      }, {
        name: 'index',
        type: 'U256'
      }],
      type: 'EthRichBlock'
    },
    getUncleByBlockNumberAndIndex: {
      description: 'Returns an uncles at given block and index.',
      params: [{
        name: 'number',
        type: 'BlockNumber'
      }, {
        name: 'index',
        type: 'U256'
      }],
      type: 'EthRichBlock'
    },
    getUncleCountByBlockHash: {
      description: 'Returns the number of uncles in a block with given hash.',
      params: [{
        name: 'hash',
        type: 'H256'
      }],
      type: 'U256'
    },
    getUncleCountByBlockNumber: {
      description: 'Returns the number of uncles in a block with given block number.',
      params: [{
        name: 'number',
        type: 'BlockNumber'
      }],
      type: 'U256'
    },
    getWork: {
      description: 'Returns the hash of the current block, the seedHash, and the boundary condition to be met.',
      params: [],
      type: 'EthWork'
    },
    hashrate: {
      description: 'Returns the number of hashes per second that the node is mining with.',
      params: [],
      type: 'U256'
    },
    maxPriorityFeePerGas: {
      description: 'Returns max priority fee per gas',
      params: [],
      type: 'U256'
    },
    mining: {
      description: 'Returns true if client is actively mining new blocks.',
      params: [],
      type: 'bool'
    },
    newBlockFilter: {
      description: 'Returns id of new block filter.',
      params: [],
      type: 'U256'
    },
    newFilter: {
      description: 'Returns id of new filter.',
      params: [{
        name: 'filter',
        type: 'EthFilter'
      }],
      type: 'U256'
    },
    newPendingTransactionFilter: {
      description: 'Returns id of new block filter.',
      params: [],
      type: 'U256'
    },
    protocolVersion: {
      description: 'Returns protocol version encoded as a string (quotes are necessary).',
      params: [],
      type: 'u64'
    },
    sendRawTransaction: {
      description: 'Sends signed transaction, returning its hash.',
      params: [{
        name: 'bytes',
        type: 'Bytes'
      }],
      type: 'H256'
    },
    sendTransaction: {
      description: 'Sends transaction; will block waiting for signer to return the transaction hash',
      params: [{
        name: 'tx',
        type: 'EthTransactionRequest'
      }],
      type: 'H256'
    },
    submitHashrate: {
      description: 'Used for submitting mining hashrate.',
      params: [{
        name: 'index',
        type: 'U256'
      }, {
        name: 'hash',
        type: 'H256'
      }],
      type: 'bool'
    },
    submitWork: {
      description: 'Used for submitting a proof-of-work solution.',
      params: [{
        name: 'nonce',
        type: 'H64'
      }, {
        name: 'headerHash',
        type: 'H256'
      }, {
        name: 'mixDigest',
        type: 'H256'
      }],
      type: 'bool'
    },
    subscribe: {
      description: 'Subscribe to Eth subscription.',
      params: [{
        name: 'kind',
        type: 'EthSubKind'
      }, {
        isOptional: true,
        name: 'params',
        type: 'EthSubParams'
      }],
      pubsub: ['subscription', 'subscribe', 'unsubscribe'],
      type: 'Null'
    },
    syncing: {
      description: 'Returns an object with data about the sync status or false.',
      params: [],
      type: 'EthSyncStatus'
    },
    uninstallFilter: {
      description: 'Uninstalls filter.',
      params: [{
        name: 'index',
        type: 'U256'
      }],
      type: 'bool'
    }
  });

  const runtime$5 = {
    ConvertTransactionRuntimeApi: [{
      methods: {
        convert_transaction: {
          description: 'Converts an Ethereum-style transaction to Extrinsic',
          params: [{
            name: 'transaction',
            type: 'TransactionV2'
          }],
          type: 'Extrinsic'
        }
      },
      version: 2
    }],
    DebugRuntimeApi: [{
      methods: {
        trace_block: {
          description: 'Trace all block extrinsics',
          params: [{
            name: 'extrinsics',
            type: 'Vec<Extrinsic>'
          }, {
            name: 'knownTransactions',
            type: 'Vec<H256>'
          }],
          type: 'Result<(), DispatchError>'
        },
        trace_transaction: {
          description: 'Trace transaction extrinsics',
          params: [{
            name: 'extrinsics',
            type: 'Vec<Extrinsic>'
          }, {
            name: 'transaction',
            type: 'EthTransaction'
          }],
          type: 'Result<(), DispatchError>'
        }
      },
      version: 4
    }],
    EthereumRuntimeRPCApi: [{
      methods: {
        account_basic: {
          description: 'Returns pallet_evm::Accounts by address.',
          params: [{
            name: 'address',
            type: 'H160'
          }],
          type: 'EvmAccount'
        },
        account_code_at: {
          description: 'For a given account address, returns pallet_evm::AccountCodes.',
          params: [{
            name: 'address',
            type: 'H160'
          }],
          type: 'Bytes'
        },
        author: {
          description: 'Returns the converted FindAuthor::find_author authority id.',
          params: [],
          type: 'H160'
        },
        call: {
          description: 'Returns a frame_ethereum::call response. If `estimate` is true,',
          params: [{
            name: 'from',
            type: 'H160'
          }, {
            name: 'to',
            type: 'H160'
          }, {
            name: 'data',
            type: 'Vec<u8>'
          }, {
            name: 'value',
            type: 'U256'
          }, {
            name: 'gasLimit',
            type: 'U256'
          }, {
            name: 'maxFeePerGas',
            type: 'Option<U256>'
          }, {
            name: 'maxPriorityFeePerGas',
            type: 'Option<U256>'
          }, {
            name: 'nonce',
            type: 'Option<U256>'
          }, {
            name: 'estimate',
            type: 'bool'
          }, {
            name: 'accessList',
            type: 'Option<Vec<(H160, Vec<H256>)>>'
          }],
          type: 'Result<EvmCallInfo, DispatchError>'
        },
        chain_id: {
          description: 'Returns runtime defined pallet_evm::ChainId.',
          params: [],
          type: 'u64'
        },
        create: {
          description: 'Returns a frame_ethereum::call response. If `estimate` is true,',
          params: [{
            name: 'from',
            type: 'H160'
          }, {
            name: 'data',
            type: 'Vec<u8>'
          }, {
            name: 'value',
            type: 'U256'
          }, {
            name: 'gasLimit',
            type: 'U256'
          }, {
            name: 'maxFeePerGas',
            type: 'Option<U256>'
          }, {
            name: 'maxPriorityFeePerGas',
            type: 'Option<U256>'
          }, {
            name: 'nonce',
            type: 'Option<U256>'
          }, {
            name: 'estimate',
            type: 'bool'
          }, {
            name: 'accessList',
            type: 'Option<Vec<(H160, Vec<H256>)>>'
          }],
          type: 'Result<EvmCreateInfo, DispatchError>'
        },
        current_all: {
          description: 'Return all the current data for a block in a single runtime call.',
          params: [],
          type: '(Option<BlockV2>, Option<Vec<EthReceiptV3>>, Option<Vec<EthTransactionStatus>>)'
        },
        current_block: {
          description: 'Return the current block.',
          params: [],
          type: 'BlockV2'
        },
        current_receipts: {
          description: 'Return the current receipt.',
          params: [],
          type: 'Option<Vec<EthReceiptV3>>'
        },
        current_transaction_statuses: {
          description: 'Return the current transaction status.',
          params: [],
          type: 'Option<Vec<EthTransactionStatus>>'
        },
        elasticity: {
          description: 'Return the elasticity multiplier.',
          params: [],
          type: 'Option<Permill>'
        },
        extrinsic_filter: {
          description: 'Receives a `Vec<OpaqueExtrinsic>` and filters all the ethereum transactions.',
          params: [{
            name: 'xts',
            type: 'Vec<Extrinsic>'
          }],
          type: 'Vec<TransactionV2>'
        },
        gas_price: {
          description: 'Returns FixedGasPrice::min_gas_price',
          params: [],
          type: 'u256'
        },
        storage_at: {
          description: 'For a given account address and index, returns pallet_evm::AccountStorages.',
          params: [{
            name: 'address',
            type: 'H160'
          }, {
            name: 'index',
            type: 'u256'
          }],
          type: 'H256'
        }
      },
      version: 4
    }]
  };

  const V0 = {
    BlockV0: {
      header: 'EthHeader',
      transactions: 'Vec<TransactionV0>',
      ommers: 'Vec<EthHeader>'
    },
    LegacyTransaction: {
      nonce: 'U256',
      gasPrice: 'U256',
      gasLimit: 'U256',
      action: 'EthTransactionAction',
      value: 'U256',
      input: 'Bytes',
      signature: 'EthTransactionSignature'
    },
    TransactionV0: 'LegacyTransaction'
  };
  const V1 = {
    BlockV1: {
      header: 'EthHeader',
      transactions: 'Vec<TransactionV1>',
      ommers: 'Vec<EthHeader>'
    },
    EIP2930Transaction: {
      chainId: 'u64',
      nonce: 'U256',
      gasPrice: 'U256',
      gasLimit: 'U256',
      action: 'EthTransactionAction',
      value: 'U256',
      input: 'Bytes',
      accessList: 'EthAccessList',
      oddYParity: 'bool',
      r: 'H256',
      s: 'H256'
    },
    TransactionV1: {
      _enum: {
        Legacy: 'LegacyTransaction',
        EIP2930: 'EIP2930Transaction'
      }
    }
  };
  const V2 = {
    BlockV2: {
      header: 'EthHeader',
      transactions: 'Vec<TransactionV2>',
      ommers: 'Vec<EthHeader>'
    },
    EIP1559Transaction: {
      chainId: 'u64',
      nonce: 'U256',
      maxPriorityFeePerGas: 'U256',
      maxFeePerGas: 'U256',
      gasLimit: 'U256',
      action: 'EthTransactionAction',
      value: 'U256',
      input: 'Bytes',
      accessList: 'EthAccessList',
      oddYParity: 'bool',
      r: 'H256',
      s: 'H256'
    },
    TransactionV2: {
      _enum: {
        Legacy: 'LegacyTransaction',
        EIP2930: 'EIP2930Transaction',
        EIP1559: 'EIP1559Transaction'
      }
    }
  };
  const types = util.objectSpread({}, V0, V1, V2, {
    EthereumAccountId: 'GenericEthereumAccountId',
    EthereumAddress: 'GenericEthereumAccountId',
    EthereumLookupSource: 'GenericEthereumLookupSource',
    EthereumSignature: '[u8; 65]',
    EthAccessListItem: {
      address: 'EthAddress',
      slots: 'Vec<H256>'
    },
    EthAccessList: 'Vec<EthAccessListItem>',
    EthAccount: {
      address: 'EthAddress',
      balance: 'U256',
      nonce: 'U256',
      codeHash: 'H256',
      storageHash: 'H256',
      accountProof: 'Vec<Bytes>',
      storageProof: 'Vec<EthStorageProof>'
    },
    EthAddress: 'H160',
    EthBlock: {
      header: 'EthHeader',
      transactions: 'Vec<EthTransaction>',
      ommers: 'Vec<EthHeader>'
    },
    EthHeader: {
      parentHash: 'H256',
      ommersHash: 'H256',
      beneficiary: 'EthAddress',
      stateRoot: 'H256',
      transactionsRoot: 'H256',
      receiptsRoot: 'H256',
      logsBloom: 'EthBloom',
      difficulty: 'U256',
      number: 'U256',
      gasLimit: 'U256',
      gasUsed: 'U256',
      timestamp: 'u64',
      extraData: 'Bytes',
      mixMash: 'H256',
      nonce: 'H64'
    },
    EthRichBlock: {
      _alias: {
        blockHash: 'hash',
        blockSize: 'size'
      },
      blockHash: 'Option<H256>',
      parentHash: 'H256',
      sha3Uncles: 'H256',
      author: 'EthAddress',
      miner: 'EthAddress',
      stateRoot: 'H256',
      transactionsRoot: 'H256',
      receiptsRoot: 'H256',
      number: 'Option<U256>',
      gasUsed: 'U256',
      gasLimit: 'U256',
      extraData: 'Bytes',
      logsBloom: 'EthBloom',
      timestamp: 'U256',
      difficulty: 'U256',
      totalDifficulty: 'Option<U256>',
      sealFields: 'Vec<Bytes>',
      uncles: 'Vec<H256>',
      transactions: 'Vec<EthTransaction>',
      blockSize: 'Option<U256>'
    },
    EthBloom: 'H2048',
    EthCallRequest: {
      from: 'Option<EthAddress>',
      to: 'Option<EthAddress>',
      gasPrice: 'Option<U256>',
      gas: 'Option<U256>',
      value: 'Option<U256>',
      data: 'Option<Bytes>',
      nonce: 'Option<U256>'
    },
    EthFeeHistory: {
      oldestBlock: 'U256',
      baseFeePerGas: 'Vec<U256>',
      gasUsedRatio: 'Vec<f64>',
      reward: 'Option<Vec<Vec<U256>>>'
    },
    EthFilter: {
      fromBlock: 'Option<BlockNumber>',
      toBlock: 'Option<BlockNumber>',
      blockHash: 'Option<H256>',
      address: 'Option<EthFilterAddress>',
      topics: 'Option<EthFilterTopic>'
    },
    EthFilterAddress: {
      _enum: {
        Single: 'EthAddress',
        Multiple: 'Vec<EthAddress>',
        Null: 'Null'
      }
    },
    EthFilterChanges: {
      _enum: {
        Logs: 'Vec<EthLog>',
        Hashes: 'Vec<H256>',
        Empty: 'Null'
      }
    },
    EthFilterTopic: {
      _enum: {
        Single: 'EthFilterTopicInner',
        Multiple: 'Vec<EthFilterTopicInner>',
        Null: 'Null'
      }
    },
    EthFilterTopicEntry: 'Option<H256>',
    EthFilterTopicInner: {
      _enum: {
        Single: 'EthFilterTopicEntry',
        Multiple: 'Vec<EthFilterTopicEntry>',
        Null: 'Null'
      }
    },
    EthRichHeader: {
      _alias: {
        blockHash: 'hash',
        blockSize: 'size'
      },
      blockHash: 'Option<H256>',
      parentHash: 'H256',
      sha3Uncles: 'H256',
      author: 'EthAddress',
      miner: 'EthAddress',
      stateRoot: 'H256',
      transactionsRoot: 'H256',
      receiptsRoot: 'H256',
      number: 'Option<U256>',
      gasUsed: 'U256',
      gasLimit: 'U256',
      extraData: 'Bytes',
      logsBloom: 'EthBloom',
      timestamp: 'U256',
      difficulty: 'U256',
      sealFields: 'Vec<Bytes>',
      blockSize: 'Option<U256>'
    },
    EthLog: {
      address: 'EthAddress',
      topics: 'Vec<H256>',
      data: 'Bytes',
      blockHash: 'Option<H256>',
      blockNumber: 'Option<U256>',
      transactionHash: 'Option<H256>',
      transactionIndex: 'Option<U256>',
      logIndex: 'Option<U256>',
      transactionLogIndex: 'Option<U256>',
      removed: 'bool'
    },
    EthReceipt: {
      transactionHash: 'Option<H256>',
      transactionIndex: 'Option<U256>',
      blockHash: 'Option<H256>',
      from: 'Option<EthAddress>',
      to: 'Option<EthAddress>',
      blockNumber: 'Option<U256>',
      cumulativeGasUsed: 'U256',
      gasUsed: 'Option<U256>',
      contractAddress: 'Option<EthAddress>',
      logs: 'Vec<EthLog>',
      root: 'Option<H256>',
      logsBloom: 'EthBloom',
      statusCode: 'Option<U64>'
    },
    EthReceiptV0: 'EthReceipt',
    EthReceiptV3: 'EthReceipt',
    EthStorageProof: {
      key: 'U256',
      value: 'U256',
      proof: 'Vec<Bytes>'
    },
    EthSubKind: {
      _enum: ['newHeads', 'logs', 'newPendingTransactions', 'syncing']
    },
    EthSubParams: {
      _enum: {
        None: 'Null',
        Logs: 'EthFilter'
      }
    },
    EthSubResult: {
      _enum: {
        Header: 'EthRichHeader',
        Log: 'EthLog',
        TransactionHash: 'H256',
        SyncState: 'EthSyncStatus'
      }
    },
    EthSyncInfo: {
      startingBlock: 'U256',
      currentBlock: 'U256',
      highestBlock: 'U256',
      warpChunksAmount: 'Option<U256>',
      warpChunksProcessed: 'Option<U256>'
    },
    EthSyncStatus: {
      _enum: {
        Info: 'EthSyncInfo',
        None: 'Null'
      }
    },
    EthTransaction: {
      hash: 'H256',
      nonce: 'U256',
      blockHash: 'Option<H256>',
      blockNumber: 'Option<U256>',
      transactionIndex: 'Option<U256>',
      from: 'H160',
      to: 'Option<H160>',
      value: 'U256',
      gasPrice: 'Option<U256>',
      maxFeePerGas: 'Option<U256>',
      maxPriorityFeePerGas: 'Option<U256>',
      gas: 'U256',
      input: 'Bytes',
      creates: 'Option<H160>',
      raw: 'Bytes',
      publicKey: 'Option<H512>',
      chainId: 'Option<U64>',
      standardV: 'U256',
      v: 'U256',
      r: 'U256',
      s: 'U256',
      accessList: 'Option<Vec<EthAccessListItem>>',
      transactionType: 'Option<U256>'
    },
    EthTransactionSignature: {
      v: 'u64',
      r: 'H256',
      s: 'H256'
    },
    EthTransactionAction: {
      _enum: {
        Call: 'H160',
        Create: 'Null'
      }
    },
    EthTransactionCondition: {
      _enum: {
        block: 'u64',
        time: 'u64'
      }
    },
    EthTransactionRequest: {
      from: 'Option<EthAddress>',
      to: 'Option<EthAddress>',
      gasPrice: 'Option<U256>',
      gas: 'Option<U256>',
      value: 'Option<U256>',
      data: 'Option<Bytes>',
      nonce: 'Option<U256>'
    },
    EthTransactionStatus: {
      transactionHash: 'H256',
      transactionIndex: 'u32',
      from: 'EthAddress',
      to: 'Option<EthAddress>',
      contractAddress: 'Option<EthAddress>',
      logs: 'Vec<EthLog>',
      logsBloom: 'EthBloom'
    },
    EthWork: {
      powHash: 'H256',
      seedHash: 'H256',
      target: 'H256',
      number: 'Option<u64>'
    }
  });
  const definitions$b = {
    rpc: rpc$7,
    runtime: runtime$5,
    types
  };

  const runtime$4 = {
    AuthorFilterAPI: [{
      methods: {
        can_author: {
          description: 'The runtime api used to predict whether an author will be eligible in the given slot',
          params: [{
            name: 'author',
            type: 'AccountId'
          }, {
            name: 'relayParent',
            type: 'u32'
          }, {
            name: 'parentHeader',
            type: 'Header'
          }],
          type: 'bool'
        }
      },
      version: 2
    }, {
      methods: {
        can_author: {
          description: 'The runtime api used to predict whether an author will be eligible in the given slot',
          params: [{
            name: 'author',
            type: 'AccountId'
          }, {
            name: 'relayParent',
            type: 'u32'
          }],
          type: 'bool'
        }
      },
      version: 1
    }],
    NimbusApi: [{
      methods: {
        can_author: {
          description: 'The runtime api used to predict whether a Nimbus author will be eligible in the given slot',
          params: [{
            name: 'author',
            type: 'AccountId'
          }, {
            name: 'relayParent',
            type: 'u32'
          }, {
            name: 'parentHeader',
            type: 'Header'
          }],
          type: 'bool'
        }
      },
      version: 1
    }]
  };

  const definitions$a = {
    rpc: {},
    runtime: runtime$4,
    types: {}
  };

  const runtime$3 = {
    OracleApi: [{
      methods: {
        get_all_values: {
          description: 'Retrieves all values',
          params: [{
            name: 'providerId',
            type: 'Raw'
          }],
          type: 'Raw'
        },
        get_value: {
          description: 'Retrieves a single value',
          params: [{
            name: 'providerId',
            type: 'Raw'
          }, {
            name: 'key',
            type: 'Raw'
          }],
          type: 'Option<Raw>'
        }
      },
      version: 1
    }]
  };

  const definitions$9 = {
    rpc: {},
    runtime: runtime$3,
    types: {}
  };

  const runtime$2 = {
    TokensApi: [{
      methods: {
        query_existential_deposit: {
          description: 'Query the existential amount for a specific currency',
          params: [{
            name: 'currencyId',
            type: 'Raw'
          }],
          type: 'u128'
        }
      },
      version: 1
    }]
  };

  const definitions$8 = {
    rpc: {},
    runtime: runtime$2,
    types: {}
  };

  const rpc$6 = {
    methods: {
      description: 'Retrieves the list of RPC methods that are exposed by the node',
      params: [],
      type: 'RpcMethods'
    }
  };

  const definitions$7 = {
    rpc: rpc$6,
    types: {
      RpcMethods: {
        version: 'u32',
        methods: 'Vec<Text>'
      }
    }
  };

  const rpc$5 = {
    hasKey: {
      description: 'Returns true if the keystore has private keys for the given public key and key type.',
      params: [{
        name: 'publicKey',
        type: 'Bytes'
      }, {
        name: 'keyType',
        type: 'Text'
      }],
      type: 'bool'
    },
    hasSessionKeys: {
      description: 'Returns true if the keystore has private keys for the given session public keys.',
      params: [{
        name: 'sessionKeys',
        type: 'Bytes'
      }],
      type: 'bool'
    },
    insertKey: {
      description: 'Insert a key into the keystore.',
      params: [{
        name: 'keyType',
        type: 'Text'
      }, {
        name: 'suri',
        type: 'Text'
      }, {
        name: 'publicKey',
        type: 'Bytes'
      }],
      type: 'Bytes'
    },
    pendingExtrinsics: {
      description: 'Returns all pending extrinsics, potentially grouped by sender',
      params: [],
      type: 'Vec<Extrinsic>'
    },
    removeExtrinsic: {
      description: 'Remove given extrinsic from the pool and temporarily ban it to prevent reimporting',
      params: [{
        name: 'bytesOrHash',
        type: 'Vec<ExtrinsicOrHash>'
      }],
      type: 'Vec<Hash>'
    },
    rotateKeys: {
      description: 'Generate new session keys and returns the corresponding public keys',
      params: [],
      type: 'Bytes'
    },
    submitAndWatchExtrinsic: {
      description: 'Submit and subscribe to watch an extrinsic until unsubscribed',
      isSigned: true,
      params: [{
        name: 'extrinsic',
        type: 'Extrinsic'
      }],
      pubsub: ['extrinsicUpdate', 'submitAndWatchExtrinsic', 'unwatchExtrinsic'],
      type: 'ExtrinsicStatus'
    },
    submitExtrinsic: {
      description: 'Submit a fully formatted extrinsic for block inclusion',
      isSigned: true,
      params: [{
        name: 'extrinsic',
        type: 'Extrinsic'
      }],
      type: 'Hash'
    }
  };

  const definitions$6 = {
    rpc: rpc$5,
    types: {
      ExtrinsicOrHash: {
        _enum: {
          Hash: 'Hash',
          Extrinsic: 'Bytes'
        }
      },
      ExtrinsicStatus: {
        _enum: {
          Future: 'Null',
          Ready: 'Null',
          Broadcast: 'Vec<Text>',
          InBlock: 'Hash',
          Retracted: 'Hash',
          FinalityTimeout: 'Hash',
          Finalized: 'Hash',
          Usurped: 'Hash',
          Dropped: 'Null',
          Invalid: 'Null'
        }
      }
    }
  };

  const rpc$4 = {
    getBlock: {
      description: 'Get header and body of a relay chain block',
      params: [{
        isHistoric: true,
        isOptional: true,
        name: 'hash',
        type: 'BlockHash'
      }],
      type: 'SignedBlock'
    },
    getBlockHash: {
      description: 'Get the block hash for a specific block',
      params: [{
        isOptional: true,
        name: 'blockNumber',
        type: 'BlockNumber'
      }],
      type: 'BlockHash'
    },
    getFinalizedHead: {
      alias: ['chain_getFinalisedHead'],
      description: 'Get hash of the last finalized block in the canon chain',
      params: [],
      type: 'BlockHash'
    },
    getHeader: {
      alias: ['chain_getHead'],
      description: 'Retrieves the header for a specific block',
      params: [{
        isHistoric: true,
        isOptional: true,
        name: 'hash',
        type: 'BlockHash'
      }],
      type: 'Header'
    },
    subscribeAllHeads: {
      description: 'Retrieves the newest header via subscription',
      params: [],
      pubsub: ['allHead', 'subscribeAllHeads', 'unsubscribeAllHeads'],
      type: 'Header'
    },
    subscribeFinalizedHeads: {
      alias: ['chain_subscribeFinalisedHeads', 'chain_unsubscribeFinalisedHeads'],
      description: 'Retrieves the best finalized header via subscription',
      params: [],
      pubsub: ['finalizedHead', 'subscribeFinalizedHeads', 'unsubscribeFinalizedHeads'],
      type: 'Header'
    },
    subscribeNewHeads: {
      alias: ['chain_unsubscribeNewHeads', 'subscribe_newHead', 'unsubscribe_newHead'],
      description: 'Retrieves the best header via subscription',
      params: [],
      pubsub: ['newHead', 'subscribeNewHead', 'unsubscribeNewHead'],
      type: 'Header'
    }
  };

  const definitions$5 = {
    rpc: rpc$4,
    types: {
      BlockHash: 'Hash'
    }
  };

  const rpc$3 = {
    getKeys: {
      description: 'Returns the keys with prefix from a child storage, leave empty to get all the keys',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'prefix',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Vec<StorageKey>'
    },
    getKeysPaged: {
      alias: ['childstate_getKeysPagedAt'],
      description: 'Returns the keys with prefix from a child storage with pagination support',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'prefix',
        type: 'StorageKey'
      }, {
        name: 'count',
        type: 'u32'
      }, {
        isOptional: true,
        name: 'startKey',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Vec<StorageKey>'
    },
    getStorage: {
      description: 'Returns a child storage entry at a specific block state',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Option<StorageData>'
    },
    getStorageEntries: {
      description: 'Returns child storage entries for multiple keys at a specific block state',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'keys',
        type: 'Vec<StorageKey>'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Vec<Option<StorageData>>'
    },
    getStorageHash: {
      description: 'Returns the hash of a child storage entry at a block state',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Option<Hash>'
    },
    getStorageSize: {
      description: 'Returns the size of a child storage entry at a block state',
      params: [{
        name: 'childKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'Hash'
      }],
      type: 'Option<u64>'
    }
  };

  const definitions$4 = {
    rpc: rpc$3,
    types: {
      PrefixedStorageKey: 'StorageKey'
    }
  };

  const rpc$2 = {
    localStorageGet: {
      description: 'Get offchain local storage under given key and prefix',
      params: [{
        name: 'kind',
        type: 'StorageKind'
      }, {
        name: 'key',
        type: 'Bytes'
      }],
      type: 'Option<Bytes>'
    },
    localStorageSet: {
      description: 'Set offchain local storage under given key and prefix',
      params: [{
        name: 'kind',
        type: 'StorageKind'
      }, {
        name: 'key',
        type: 'Bytes'
      }, {
        name: 'value',
        type: 'Bytes'
      }],
      type: 'Null'
    }
  };

  const runtime$1 = {
    OffchainWorkerApi: [{
      methods: {
        offchain_worker: {
          description: 'Starts the off-chain task for given block header.',
          params: [{
            name: 'header',
            type: 'Header'
          }],
          type: 'Null'
        }
      },
      version: 2
    }, {
      methods: {
        offchain_worker: {
          description: 'Starts the off-chain task for given block header.',
          params: [{
            name: 'number',
            type: 'BlockNumber'
          }],
          type: 'Null'
        }
      },
      version: 1
    }]
  };

  const definitions$3 = {
    rpc: rpc$2,
    runtime: runtime$1,
    types: {
      StorageKind: {
        _enum: {
          PERSISTENT: 1,
          LOCAL: 2
        }
      }
    }
  };

  const rpc$1 = {
    queryFeeDetails: {
      description: 'Query the detailed fee of a given encoded extrinsic',
      params: [{
        name: 'extrinsic',
        type: 'Bytes'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'FeeDetails'
    },
    queryInfo: {
      description: 'Retrieves the fee information for an encoded extrinsic',
      params: [{
        name: 'extrinsic',
        type: 'Bytes'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'RuntimeDispatchInfo'
    }
  };

  const runtime = {
    TransactionPaymentApi: [{
      methods: {
        query_fee_details: {
          description: 'The transaction fee details',
          params: [{
            name: 'uxt',
            type: 'Extrinsic'
          }, {
            name: 'len',
            type: 'u32'
          }],
          type: 'FeeDetails'
        },
        query_info: {
          description: 'The transaction info',
          params: [{
            name: 'uxt',
            type: 'Extrinsic'
          }, {
            name: 'len',
            type: 'u32'
          }],
          type: 'RuntimeDispatchInfo'
        }
      },
      version: 1
    }],
    TransactionPaymentCallApi: [{
      methods: {
        query_call_fee_details: {
          description: 'The call fee details',
          params: [{
            name: 'call',
            type: 'Call'
          }, {
            name: 'len',
            type: 'u32'
          }],
          type: 'FeeDetails'
        },
        query_call_info: {
          description: 'The call info',
          params: [{
            name: 'call',
            type: 'Call'
          }, {
            name: 'len',
            type: 'u32'
          }],
          type: 'RuntimeDispatchInfo'
        }
      },
      version: 1
    }]
  };

  const definitions$2 = {
    rpc: rpc$1,
    runtime,
    types: {
      FeeDetails: {
        inclusionFee: 'Option<InclusionFee>'
      },
      InclusionFee: {
        baseFee: 'Balance',
        lenFee: 'Balance',
        adjustedWeightFee: 'Balance'
      },
      RuntimeDispatchInfo: {
        weight: 'Weight',
        class: 'DispatchClass',
        partialFee: 'Balance'
      }
    }
  };

  const rpc = {
    call: {
      alias: ['state_callAt'],
      description: 'Perform a call to a builtin on the chain',
      params: [{
        name: 'method',
        type: 'Text'
      }, {
        name: 'data',
        type: 'Bytes'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Bytes'
    },
    getChildKeys: {
      description: 'Retrieves the keys with prefix of a specific child storage',
      params: [{
        name: 'childStorageKey',
        type: 'StorageKey'
      }, {
        name: 'childDefinition',
        type: 'StorageKey'
      }, {
        name: 'childType',
        type: 'u32'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Vec<StorageKey>'
    },
    getChildReadProof: {
      description: 'Returns proof of storage for child key entries at a specific block state.',
      params: [{
        name: 'childStorageKey',
        type: 'PrefixedStorageKey'
      }, {
        name: 'keys',
        type: 'Vec<StorageKey>'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'ReadProof'
    },
    getChildStorage: {
      description: 'Retrieves the child storage for a key',
      params: [{
        name: 'childStorageKey',
        type: 'StorageKey'
      }, {
        name: 'childDefinition',
        type: 'StorageKey'
      }, {
        name: 'childType',
        type: 'u32'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'StorageData'
    },
    getChildStorageHash: {
      description: 'Retrieves the child storage hash',
      params: [{
        name: 'childStorageKey',
        type: 'StorageKey'
      }, {
        name: 'childDefinition',
        type: 'StorageKey'
      }, {
        name: 'childType',
        type: 'u32'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Hash'
    },
    getChildStorageSize: {
      description: 'Retrieves the child storage size',
      params: [{
        name: 'childStorageKey',
        type: 'StorageKey'
      }, {
        name: 'childDefinition',
        type: 'StorageKey'
      }, {
        name: 'childType',
        type: 'u32'
      }, {
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'u64'
    },
    getKeys: {
      description: 'Retrieves the keys with a certain prefix',
      params: [{
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Vec<StorageKey>'
    },
    getKeysPaged: {
      alias: ['state_getKeysPagedAt'],
      description: 'Returns the keys with prefix with pagination support.',
      params: [{
        name: 'key',
        type: 'StorageKey'
      }, {
        name: 'count',
        type: 'u32'
      }, {
        isOptional: true,
        name: 'startKey',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Vec<StorageKey>'
    },
    getMetadata: {
      description: 'Returns the runtime metadata',
      params: [{
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Metadata'
    },
    getPairs: {
      description: 'Returns the keys with prefix, leave empty to get all the keys (deprecated: Use getKeysPaged)',
      params: [{
        name: 'prefix',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Vec<KeyValue>'
    },
    getReadProof: {
      description: 'Returns proof of storage entries at a specific block state',
      params: [{
        name: 'keys',
        type: 'Vec<StorageKey>'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'ReadProof'
    },
    getRuntimeVersion: {
      alias: ['chain_getRuntimeVersion'],
      description: 'Get the runtime version',
      params: [{
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'RuntimeVersion'
    },
    getStorage: {
      alias: ['state_getStorageAt'],
      description: 'Retrieves the storage for a key',
      params: [{
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'StorageData'
    },
    getStorageHash: {
      alias: ['state_getStorageHashAt'],
      description: 'Retrieves the storage hash',
      params: [{
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Hash'
    },
    getStorageSize: {
      alias: ['state_getStorageSizeAt'],
      description: 'Retrieves the storage size',
      params: [{
        name: 'key',
        type: 'StorageKey'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'u64'
    },
    queryStorage: {
      description: 'Query historical storage entries (by key) starting from a start block',
      params: [{
        name: 'keys',
        type: 'Vec<StorageKey>'
      }, {
        name: 'fromBlock',
        type: 'Hash'
      }, {
        isOptional: true,
        name: 'toBlock',
        type: 'BlockHash'
      }],
      type: 'Vec<StorageChangeSet>'
    },
    queryStorageAt: {
      description: 'Query storage entries (by key) starting at block hash given as the second parameter',
      params: [{
        name: 'keys',
        type: 'Vec<StorageKey>'
      }, {
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'Vec<StorageChangeSet>'
    },
    subscribeRuntimeVersion: {
      alias: ['chain_subscribeRuntimeVersion', 'chain_unsubscribeRuntimeVersion'],
      description: 'Retrieves the runtime version via subscription',
      params: [],
      pubsub: ['runtimeVersion', 'subscribeRuntimeVersion', 'unsubscribeRuntimeVersion'],
      type: 'RuntimeVersion'
    },
    subscribeStorage: {
      description: 'Subscribes to storage changes for the provided keys',
      params: [{
        isOptional: true,
        name: 'keys',
        type: 'Vec<StorageKey>'
      }],
      pubsub: ['storage', 'subscribeStorage', 'unsubscribeStorage'],
      type: 'StorageChangeSet'
    },
    traceBlock: {
      description: 'Provides a way to trace the re-execution of a single block',
      params: [{
        name: 'block',
        type: 'Hash'
      }, {
        name: 'targets',
        type: 'Option<Text>'
      }, {
        name: 'storageKeys',
        type: 'Option<Text>'
      }, {
        name: 'methods',
        type: 'Option<Text>'
      }],
      type: 'TraceBlockResponse'
    },
    trieMigrationStatus: {
      description: 'Check current migration state',
      params: [{
        isHistoric: true,
        isOptional: true,
        name: 'at',
        type: 'BlockHash'
      }],
      type: 'MigrationStatusResult'
    }
  };

  const definitions$1 = {
    rpc,
    types: {
      ApiId: '[u8; 8]',
      BlockTrace: {
        blockHash: 'Text',
        parentHash: 'Text',
        tracingTargets: 'Text',
        storageKeys: 'Text',
        spans: 'Vec<BlockTraceSpan>',
        events: 'Vec<BlockTraceEvent>'
      },
      BlockTraceEvent: {
        target: 'Text',
        data: 'BlockTraceEventData',
        parentId: 'Option<u64>'
      },
      BlockTraceEventData: {
        stringValues: 'HashMap<Text, Text>'
      },
      BlockTraceSpan: {
        id: 'u64',
        parentId: 'Option<u64>',
        name: 'Text',
        target: 'Text',
        wasm: 'bool'
      },
      KeyValueOption: '(StorageKey, Option<StorageData>)',
      MigrationStatusResult: {
        topRemainingToMigrate: 'u64',
        childRemainingToMigrate: 'u64'
      },
      ReadProof: {
        at: 'Hash',
        proof: 'Vec<Bytes>'
      },
      RuntimeVersionApi: '(ApiId, u32)',
      RuntimeVersion: {
        specName: 'Text',
        implName: 'Text',
        authoringVersion: 'u32',
        specVersion: 'u32',
        implVersion: 'u32',
        apis: 'Vec<RuntimeVersionApi>',
        transactionVersion: 'u32',
        stateVersion: 'u8'
      },
      RuntimeVersionPre4: {
        specName: 'Text',
        implName: 'Text',
        authoringVersion: 'u32',
        specVersion: 'u32',
        implVersion: 'u32',
        apis: 'Vec<RuntimeVersionApi>',
        transactionVersion: 'u32'
      },
      RuntimeVersionPre3: {
        specName: 'Text',
        implName: 'Text',
        authoringVersion: 'u32',
        specVersion: 'u32',
        implVersion: 'u32',
        apis: 'Vec<RuntimeVersionApi>'
      },
      RuntimeVersionPartial: {
        specName: 'Text',
        specVersion: 'u32',
        apis: 'Vec<RuntimeVersionApi>'
      },
      SpecVersion: 'u32',
      StorageChangeSet: {
        block: 'Hash',
        changes: 'Vec<KeyValueOption>'
      },
      TraceBlockResponse: {
        _enum: {
          TraceError: 'TraceError',
          BlockTrace: 'BlockTrace'
        }
      },
      TraceError: {
        error: 'Text'
      }
    }
  };

  const definitions = /*#__PURE__*/Object.freeze({
    __proto__: null,
    assets: definitions$11,
    authorship: definitions$10,
    aura: definitions$$,
    babe: definitions$_,
    balances: definitions$Z,
    beefy: definitions$Y,
    benchmark: definitions$X,
    blockbuilder: definitions$W,
    collective: definitions$V,
    consensus: definitions$U,
    contracts: definitions$T,
    democracy: definitions$S,
    dev: definitions$R,
    discovery: definitions$Q,
    elections: definitions$P,
    engine: definitions$O,
    evm: definitions$N,
    extrinsics: definitions$M,
    genericAsset: definitions$L,
    gilt: definitions$K,
    grandpa: definitions$J,
    identity: definitions$I,
    imOnline: definitions$H,
    lottery: definitions$G,
    mmr: definitions$F,
    nompools: definitions$E,
    offences: definitions$D,
    pow: definitions$C,
    proxy: definitions$B,
    recovery: definitions$A,
    scheduler: definitions$z,
    session: definitions$y,
    society: definitions$x,
    staking: definitions$w,
    support: definitions$v,
    syncstate: definitions$u,
    system: definitions$t,
    treasury: definitions$s,
    txpayment: definitions$r,
    txqueue: definitions$q,
    uniques: definitions$p,
    utility: definitions$o,
    vesting: definitions$n,
    attestations: definitions$m,
    bridges: definitions$l,
    claims: definitions$k,
    crowdloan: definitions$j,
    cumulus: definitions$i,
    finality: definitions$h,
    parachains: definitions$g,
    poll: definitions$f,
    purchase: definitions$e,
    xcm: definitions$d,
    contractsAbi: definitions$c,
    eth: definitions$b,
    nimbus: definitions$a,
    ormlOracle: definitions$9,
    ormlTokens: definitions$8,
    rpc: definitions$7,
    author: definitions$6,
    chain: definitions$5,
    childstate: definitions$4,
    offchain: definitions$3,
    payment: definitions$2,
    state: definitions$1,
    metadata: definitions$14,
    runtime: definitions$13,
    scaleInfo: definitions$12
  });

  const jsonrpc = {};
  Object.keys(definitions).forEach(s => Object.entries(definitions[s].rpc || {}).forEach(([method, def]) => {
    const section = def.aliasSection || s;
    if (!jsonrpc[section]) {
      jsonrpc[section] = {};
    }
    jsonrpc[section][method] = util.objectSpread({}, def, {
      isSubscription: !!def.pubsub,
      jsonrpc: `${section}_${method}`,
      method,
      section
    });
  }));
  const jsonrpc$1 = jsonrpc;

  function createClass(registry, type) {
    return createClassUnsafe(registry, type);
  }

  function createType(registry, type, ...params) {
    return createTypeUnsafe(registry, type, params);
  }

  function lazyVariants(lookup, {
    type
  }, getName, creator) {
    const result = {};
    const variants = lookup.getSiType(type).def.asVariant.variants;
    for (let i = 0; i < variants.length; i++) {
      util.lazyMethod(result, variants[i], creator, getName, i);
    }
    return result;
  }

  const emptyCheck = {
    extrinsic: {},
    payload: {}
  };

  const polkadot = {
    LimitParathreadCommits: emptyCheck,
    OnlyStakingAndClaims: emptyCheck,
    PrevalidateAttests: emptyCheck,
    RestrictFunctionality: emptyCheck,
    TransactionCallFilter: emptyCheck,
    ValidateDoubleVoteReports: emptyCheck
  };

  const shell = {
    DisallowSigned: emptyCheck
  };

  const statemint = {
    ChargeAssetTxPayment: {
      extrinsic: {
        tip: 'Compact<Balance>',
        assetId: 'Option<AssetId>'
      },
      payload: {}
    }
  };

  const CheckMortality = {
    extrinsic: {
      era: 'ExtrinsicEra'
    },
    payload: {
      blockHash: 'Hash'
    }
  };
  const substrate$1 = {
    ChargeTransactionPayment: {
      extrinsic: {
        tip: 'Compact<Balance>'
      },
      payload: {}
    },
    CheckBlockGasLimit: emptyCheck,
    CheckEra: CheckMortality,
    CheckGenesis: {
      extrinsic: {},
      payload: {
        genesisHash: 'Hash'
      }
    },
    CheckMortality,
    CheckNonZeroSender: emptyCheck,
    CheckNonce: {
      extrinsic: {
        nonce: 'Compact<Index>'
      },
      payload: {}
    },
    CheckSpecVersion: {
      extrinsic: {},
      payload: {
        specVersion: 'u32'
      }
    },
    CheckTxVersion: {
      extrinsic: {},
      payload: {
        transactionVersion: 'u32'
      }
    },
    CheckVersion: {
      extrinsic: {},
      payload: {
        specVersion: 'u32'
      }
    },
    CheckWeight: emptyCheck,
    LockStakingStatus: emptyCheck,
    ValidateEquivocationReport: emptyCheck
  };

  const allExtensions = util.objectSpread({}, substrate$1, polkadot, shell, statemint);
  const fallbackExtensions = ['CheckVersion', 'CheckGenesis', 'CheckEra', 'CheckNonce', 'CheckWeight', 'ChargeTransactionPayment', 'CheckBlockGasLimit'];
  function findUnknownExtensions(extensions, userExtensions = {}) {
    const names = [...Object.keys(allExtensions), ...Object.keys(userExtensions)];
    return extensions.filter(k => !names.includes(k));
  }
  function expandExtensionTypes(extensions, type, userExtensions = {}) {
    return extensions
    .map(k => userExtensions[k] || allExtensions[k]).filter(info => !!info).reduce((result, info) => util.objectSpread(result, info[type]), {});
  }

  function decodeEvent(registry, value) {
    if (!value || !value.length) {
      return {
        DataType: Null
      };
    }
    const index = value.subarray(0, 2);
    return {
      DataType: registry.findMetaEvent(index),
      value: {
        data: value.subarray(2),
        index
      }
    };
  }
  class GenericEventData extends Tuple {
    #meta;
    #method;
    #names = null;
    #section;
    #typeDef;
    constructor(registry, value, meta, section = '<unknown>', method = '<unknown>') {
      const fields = (meta === null || meta === void 0 ? void 0 : meta.fields) || [];
      super(registry, fields.map(({
        type
      }) => registry.createLookupType(type)), value);
      this.#meta = meta;
      this.#method = method;
      this.#section = section;
      this.#typeDef = fields.map(({
        type
      }) => registry.lookup.getTypeDef(type));
      const names = fields.map(({
        name
      }) => registry.lookup.sanitizeField(name)[0]).filter(n => !!n);
      if (names.length === fields.length) {
        this.#names = names;
        util.objectProperties(this, names, (_, i) => this[i]);
      }
    }
    get meta() {
      return this.#meta;
    }
    get method() {
      return this.#method;
    }
    get names() {
      return this.#names;
    }
    get section() {
      return this.#section;
    }
    get typeDef() {
      return this.#typeDef;
    }
    toHuman(isExtended) {
      if (this.#names !== null) {
        const json = {};
        for (let i = 0; i < this.#names.length; i++) {
          json[this.#names[i]] = this[i].toHuman(isExtended);
        }
        return json;
      }
      return super.toHuman(isExtended);
    }
  }
  class GenericEvent extends Struct {
    constructor(registry, _value) {
      const {
        DataType,
        value
      } = decodeEvent(registry, _value);
      super(registry, {
        index: 'EventId',
        data: DataType
      }, value);
    }
    get data() {
      return this.getT('data');
    }
    get index() {
      return this.getT('index');
    }
    get meta() {
      return this.data.meta;
    }
    get method() {
      return this.data.method;
    }
    get section() {
      return this.data.section;
    }
    get typeDef() {
      return this.data.typeDef;
    }
    toHuman(isExpanded) {
      return util.objectSpread({
        method: this.method,
        section: this.section
      }, isExpanded ? {
        docs: this.meta.docs.map(d => d.toString())
      } : null, super.toHuman(isExpanded));
    }
  }

  const EXTRINSIC_VERSION = 4;
  class GenericExtrinsicV4 extends Struct {
    constructor(registry, value, {
      isSigned
    } = {}) {
      super(registry, {
        signature: 'ExtrinsicSignatureV4',
        method: 'Call'
      }, GenericExtrinsicV4.decodeExtrinsic(registry, value, isSigned));
    }
    static decodeExtrinsic(registry, value, isSigned = false) {
      if (value instanceof GenericExtrinsicV4) {
        return value;
      } else if (value instanceof registry.createClassUnsafe('Call')) {
        return {
          method: value
        };
      } else if (util.isU8a(value)) {
        const signature = registry.createTypeUnsafe('ExtrinsicSignatureV4', [value, {
          isSigned
        }]);
        const method = registry.createTypeUnsafe('Call', [value.subarray(signature.encodedLength)]);
        return {
          method,
          signature
        };
      }
      return value || {};
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    get method() {
      return this.getT('method');
    }
    get signature() {
      return this.getT('signature');
    }
    get version() {
      return EXTRINSIC_VERSION;
    }
    addSignature(signer, signature, payload) {
      this.signature.addSignature(signer, signature, payload);
      return this;
    }
    sign(account, options) {
      this.signature.sign(this.method, account, options);
      return this;
    }
    signFake(signer, options) {
      this.signature.signFake(this.method, signer, options);
      return this;
    }
  }

  const BIT_SIGNED = 0b10000000;
  const BIT_UNSIGNED = 0;
  const EMPTY_U8A = new Uint8Array();
  const DEFAULT_VERSION = 4;
  const IMMORTAL_ERA = new Uint8Array([0]);
  const UNMASK_VERSION = 0b01111111;

  const VERSIONS$1 = ['ExtrinsicUnknown',
  'ExtrinsicUnknown', 'ExtrinsicUnknown', 'ExtrinsicUnknown', 'ExtrinsicV4'];
  function newFromValue(registry, value, version) {
    if (value instanceof GenericExtrinsic) {
      return value.unwrap();
    }
    const isSigned = (version & BIT_SIGNED) === BIT_SIGNED;
    const type = VERSIONS$1[version & UNMASK_VERSION] || VERSIONS$1[0];
    return registry.createTypeUnsafe(type, [value, {
      isSigned,
      version
    }]);
  }
  function decodeExtrinsic(registry, value, version = DEFAULT_VERSION) {
    if (util.isU8a(value) || Array.isArray(value) || util.isHex(value)) {
      return decodeU8a$4(registry, util.u8aToU8a(value), version);
    } else if (value instanceof registry.createClassUnsafe('Call')) {
      return newFromValue(registry, {
        method: value
      }, version);
    }
    return newFromValue(registry, value, version);
  }
  function decodeU8a$4(registry, value, version) {
    if (!value.length) {
      return newFromValue(registry, new Uint8Array(), version);
    }
    const [offset, length] = util.compactFromU8a(value);
    const total = offset + length.toNumber();
    if (total > value.length) {
      throw new Error(`Extrinsic: length less than remainder, expected at least ${total}, found ${value.length}`);
    }
    const data = value.subarray(offset, total);
    return newFromValue(registry, data.subarray(1), data[0]);
  }
  class ExtrinsicBase extends AbstractBase {
    constructor(registry, value, initialU8aLength) {
      super(registry, value, initialU8aLength);
      const signKeys = Object.keys(registry.getSignedExtensionTypes());
      const getter = key => this.inner.signature[key];
      for (let i = 0; i < signKeys.length; i++) {
        util.objectProperty(this, signKeys[i], getter);
      }
    }
    get args() {
      return this.method.args;
    }
    get argsDef() {
      return this.method.argsDef;
    }
    get callIndex() {
      return this.method.callIndex;
    }
    get data() {
      return this.method.data;
    }
    get era() {
      return this.inner.signature.era;
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    get isSigned() {
      return this.inner.signature.isSigned;
    }
    get length() {
      return this.toU8a(true).length;
    }
    get meta() {
      return this.method.meta;
    }
    get method() {
      return this.inner.method;
    }
    get nonce() {
      return this.inner.signature.nonce;
    }
    get signature() {
      return this.inner.signature.signature;
    }
    get signer() {
      return this.inner.signature.signer;
    }
    get tip() {
      return this.inner.signature.tip;
    }
    get type() {
      return this.inner.version;
    }
    get inner() {
      return this.unwrap();
    }
    get version() {
      return this.type | (this.isSigned ? BIT_SIGNED : BIT_UNSIGNED);
    }
    is(other) {
      return this.method.is(other);
    }
    unwrap() {
      return super.unwrap();
    }
  }
  class GenericExtrinsic extends ExtrinsicBase {
    #hashCache;
    static LATEST_EXTRINSIC_VERSION = EXTRINSIC_VERSION;
    constructor(registry, value, {
      version
    } = {}) {
      super(registry, decodeExtrinsic(registry, value, version));
    }
    get hash() {
      if (!this.#hashCache) {
        this.#hashCache = super.hash;
      }
      return this.#hashCache;
    }
    addSignature(signer, signature, payload) {
      this.inner.addSignature(signer, signature, payload);
      this.#hashCache = undefined;
      return this;
    }
    inspect() {
      const encoded = util.u8aConcat(...this.toU8aInner());
      return {
        inner: this.isSigned ? this.inner.inspect().inner : this.inner.method.inspect().inner,
        outer: [util.compactToU8a(encoded.length), new Uint8Array([this.version])]
      };
    }
    sign(account, options) {
      this.inner.sign(account, options);
      this.#hashCache = undefined;
      return this;
    }
    signFake(signer, options) {
      this.inner.signFake(signer, options);
      this.#hashCache = undefined;
      return this;
    }
    toHex(isBare) {
      return util.u8aToHex(this.toU8a(isBare));
    }
    toHuman(isExpanded) {
      return util.objectSpread({}, {
        isSigned: this.isSigned,
        method: this.method.toHuman(isExpanded)
      }, this.isSigned ? {
        era: this.era.toHuman(isExpanded),
        nonce: this.nonce.toHuman(isExpanded),
        signature: this.signature.toHex(),
        signer: this.signer.toHuman(isExpanded),
        tip: this.tip.toHuman(isExpanded)
      } : null);
    }
    toJSON() {
      return this.toHex();
    }
    toRawType() {
      return 'Extrinsic';
    }
    toU8a(isBare) {
      const encoded = util.u8aConcat(...this.toU8aInner());
      return isBare ? encoded : util.compactAddLength(encoded);
    }
    toU8aInner() {
      return [new Uint8Array([this.version]), this.inner.toU8a()];
    }
  }

  function getTrailingZeros(period) {
    const binary = period.toString(2);
    let index = 0;
    while (binary[binary.length - 1 - index] === '0') {
      index++;
    }
    return index;
  }
  function decodeMortalEra(registry, value) {
    if (util.isU8a(value) || util.isHex(value) || Array.isArray(value)) {
      return decodeMortalU8a(registry, util.u8aToU8a(value));
    } else if (!value) {
      return [new u64(registry), new u64(registry)];
    } else if (util.isObject(value)) {
      return decodeMortalObject(registry, value);
    }
    throw new Error('Invalid data passed to Mortal era');
  }
  function decodeMortalObject(registry, value) {
    const {
      current,
      period
    } = value;
    let calPeriod = Math.pow(2, Math.ceil(Math.log2(period)));
    calPeriod = Math.min(Math.max(calPeriod, 4), 1 << 16);
    const phase = current % calPeriod;
    const quantizeFactor = Math.max(calPeriod >> 12, 1);
    const quantizedPhase = phase / quantizeFactor * quantizeFactor;
    return [new u64(registry, calPeriod), new u64(registry, quantizedPhase)];
  }
  function decodeMortalU8a(registry, value) {
    if (value.length === 0) {
      return [new u64(registry), new u64(registry)];
    }
    const first = util.u8aToBn(value.subarray(0, 1)).toNumber();
    const second = util.u8aToBn(value.subarray(1, 2)).toNumber();
    const encoded = first + (second << 8);
    const period = 2 << encoded % (1 << 4);
    const quantizeFactor = Math.max(period >> 12, 1);
    const phase = (encoded >> 4) * quantizeFactor;
    if (period < 4 || phase >= period) {
      throw new Error('Invalid data passed to Mortal era');
    }
    return [new u64(registry, period), new u64(registry, phase)];
  }
  function decodeExtrinsicEra(value = new Uint8Array()) {
    if (util.isU8a(value)) {
      return !value.length || value[0] === 0 ? new Uint8Array([0]) : new Uint8Array([1, value[0], value[1]]);
    } else if (!value) {
      return new Uint8Array([0]);
    } else if (value instanceof GenericExtrinsicEra) {
      return decodeExtrinsicEra(value.toU8a());
    } else if (util.isHex(value)) {
      return decodeExtrinsicEra(util.hexToU8a(value));
    } else if (util.isObject(value)) {
      const entries = Object.entries(value).map(([k, v]) => [k.toLowerCase(), v]);
      const mortal = entries.find(([k]) => k.toLowerCase() === 'mortalera');
      const immortal = entries.find(([k]) => k.toLowerCase() === 'immortalera');
      return mortal ? {
        MortalEra: mortal[1]
      } : immortal ? {
        ImmortalEra: immortal[1]
      } : {
        MortalEra: value
      };
    }
    throw new Error('Invalid data passed to Era');
  }
  class ImmortalEra extends Raw {
    constructor(registry, value) {
      super(registry, IMMORTAL_ERA);
    }
  }
  class MortalEra extends Tuple {
    constructor(registry, value) {
      super(registry, {
        period: u64,
        phase: u64
      }, decodeMortalEra(registry, value));
    }
    get encodedLength() {
      return 2;
    }
    get period() {
      return this[0];
    }
    get phase() {
      return this[1];
    }
    toHuman() {
      return {
        period: util.formatNumber(this.period),
        phase: util.formatNumber(this.phase)
      };
    }
    toJSON() {
      return this.toHex();
    }
    toU8a(isBare) {
      const period = this.period.toNumber();
      const encoded = Math.min(15, Math.max(1, getTrailingZeros(period) - 1)) + (this.phase.toNumber() / Math.max(period >> 12, 1) << 4);
      return new Uint8Array([encoded & 0xff, encoded >> 8]);
    }
    birth(current) {
      const phase = this.phase.toNumber();
      const period = this.period.toNumber();
      return ~~((Math.max(util.bnToBn(current).toNumber(), phase) - phase) / period) * period + phase;
    }
    death(current) {
      return this.birth(current) + this.period.toNumber();
    }
  }
  class GenericExtrinsicEra extends Enum {
    constructor(registry, value) {
      super(registry, {
        ImmortalEra,
        MortalEra
      }, decodeExtrinsicEra(value));
    }
    get encodedLength() {
      return this.isImmortalEra ? this.asImmortalEra.encodedLength : this.asMortalEra.encodedLength;
    }
    get asImmortalEra() {
      if (!this.isImmortalEra) {
        throw new Error(`Cannot convert '${this.type}' via asImmortalEra`);
      }
      return this.inner;
    }
    get asMortalEra() {
      if (!this.isMortalEra) {
        throw new Error(`Cannot convert '${this.type}' via asMortalEra`);
      }
      return this.inner;
    }
    get isImmortalEra() {
      return this.index === 0;
    }
    get isMortalEra() {
      return this.index > 0;
    }
    toU8a(isBare) {
      return this.isMortalEra ? this.asMortalEra.toU8a(isBare) : this.asImmortalEra.toU8a(isBare);
    }
  }

  const VERSIONS = ['ExtrinsicPayloadUnknown',
  'ExtrinsicPayloadUnknown', 'ExtrinsicPayloadUnknown', 'ExtrinsicPayloadUnknown', 'ExtrinsicPayloadV4'];
  function decodeExtrinsicPayload(registry, value, version = DEFAULT_VERSION) {
    if (value instanceof GenericExtrinsicPayload) {
      return value.unwrap();
    }
    return registry.createTypeUnsafe(VERSIONS[version] || VERSIONS[0], [value, {
      version
    }]);
  }
  class GenericExtrinsicPayload extends AbstractBase {
    constructor(registry, value, {
      version
    } = {}) {
      super(registry, decodeExtrinsicPayload(registry, value, version));
    }
    get blockHash() {
      return this.inner.blockHash;
    }
    get era() {
      return this.inner.era;
    }
    get genesisHash() {
      return this.inner.genesisHash || this.registry.createTypeUnsafe('Hash', []);
    }
    get method() {
      return this.inner.method;
    }
    get nonce() {
      return this.inner.nonce;
    }
    get specVersion() {
      return this.inner.specVersion || this.registry.createTypeUnsafe('u32', []);
    }
    get tip() {
      return this.inner.tip || this.registry.createTypeUnsafe('Compact<Balance>', []);
    }
    get transactionVersion() {
      return this.inner.transactionVersion || this.registry.createTypeUnsafe('u32', []);
    }
    eq(other) {
      return this.inner.eq(other);
    }
    sign(signerPair) {
      const signature = this.inner.sign(signerPair);
      return {
        signature: util.u8aToHex(signature)
      };
    }
    toHuman(isExtended) {
      return this.inner.toHuman(isExtended);
    }
    toJSON() {
      return this.toHex();
    }
    toString() {
      return this.toHex();
    }
    toU8a(isBare) {
      return super.toU8a(isBare ? {
        method: true
      } : false);
    }
  }

  class GenericExtrinsicPayloadUnknown extends Struct {
    constructor(registry, value, {
      version = 0
    } = {}) {
      super(registry, {});
      throw new Error(`Unsupported extrinsic payload version ${version}`);
    }
  }

  class GenericExtrinsicUnknown extends Struct {
    constructor(registry, value, {
      isSigned = false,
      version = 0
    } = {}) {
      super(registry, {});
      throw new Error(`Unsupported ${isSigned ? '' : 'un'}signed extrinsic version ${version & UNMASK_VERSION}`);
    }
  }

  const knownTypes = {
    address: 'Address',
    blockHash: 'Hash',
    blockNumber: 'BlockNumber',
    era: 'ExtrinsicEra',
    genesisHash: 'Hash',
    method: 'Call',
    nonce: 'Compact<Index>',
    runtimeVersion: 'RuntimeVersion',
    signedExtensions: 'Vec<Text>',
    tip: 'Compact<Balance>',
    version: 'u8'
  };
  class GenericSignerPayload extends Struct {
    #extraTypes;
    constructor(registry, value) {
      const extensionTypes = util.objectSpread({}, registry.getSignedExtensionTypes(), registry.getSignedExtensionExtra());
      super(registry, util.objectSpread({}, extensionTypes, knownTypes), value);
      this.#extraTypes = {};
      const getter = key => this.get(key);
      for (const [key, type] of Object.entries(extensionTypes)) {
        if (!knownTypes[key]) {
          this.#extraTypes[key] = type;
        }
        util.objectProperty(this, key, getter);
      }
    }
    get address() {
      return this.getT('address');
    }
    get blockHash() {
      return this.getT('blockHash');
    }
    get blockNumber() {
      return this.getT('blockNumber');
    }
    get era() {
      return this.getT('era');
    }
    get genesisHash() {
      return this.getT('genesisHash');
    }
    get method() {
      return this.getT('method');
    }
    get nonce() {
      return this.getT('nonce');
    }
    get runtimeVersion() {
      return this.getT('runtimeVersion');
    }
    get signedExtensions() {
      return this.getT('signedExtensions');
    }
    get tip() {
      return this.getT('tip');
    }
    get version() {
      return this.getT('version');
    }
    toPayload() {
      const result = {};
      const keys = Object.keys(this.#extraTypes);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = this.get(key);
        const isOption = value instanceof Option;
        if (!isOption || value.isSome) {
          result[key] = value.toHex();
        }
      }
      return util.objectSpread(result, {
        address: this.address.toString(),
        blockHash: this.blockHash.toHex(),
        blockNumber: this.blockNumber.toHex(),
        era: this.era.toHex(),
        genesisHash: this.genesisHash.toHex(),
        method: this.method.toHex(),
        nonce: this.nonce.toHex(),
        signedExtensions: this.signedExtensions.map(e => e.toString()),
        specVersion: this.runtimeVersion.specVersion.toHex(),
        tip: this.tip.toHex(),
        transactionVersion: this.runtimeVersion.transactionVersion.toHex(),
        version: this.version.toNumber()
      });
    }
    toRaw() {
      const payload = this.toPayload();
      const data = util.u8aToHex(this.registry.createTypeUnsafe('ExtrinsicPayload', [payload, {
        version: payload.version
      }])
      .toU8a({
        method: true
      }));
      return {
        address: payload.address,
        data,
        type: 'payload'
      };
    }
  }

  function sign(registry, signerPair, u8a, options) {
    const encoded = u8a.length > 256 ? registry.hash(u8a) : u8a;
    return signerPair.sign(encoded, options);
  }

  class GenericExtrinsicPayloadV4 extends Struct {
    #signOptions;
    constructor(registry, value) {
      super(registry, util.objectSpread({
        method: 'Bytes'
      }, registry.getSignedExtensionTypes(), registry.getSignedExtensionExtra()), value);
      this.#signOptions = {
        withType: registry.createTypeUnsafe('ExtrinsicSignature', []) instanceof Enum
      };
    }
    inspect() {
      return super.inspect({
        method: true
      });
    }
    get blockHash() {
      return this.getT('blockHash');
    }
    get era() {
      return this.getT('era');
    }
    get genesisHash() {
      return this.getT('genesisHash');
    }
    get method() {
      return this.getT('method');
    }
    get nonce() {
      return this.getT('nonce');
    }
    get specVersion() {
      return this.getT('specVersion');
    }
    get tip() {
      return this.getT('tip');
    }
    get transactionVersion() {
      return this.getT('transactionVersion');
    }
    get assetId() {
      return this.getT('assetId');
    }
    sign(signerPair) {
      return sign(this.registry, signerPair, this.toU8a({
        method: true
      }), this.#signOptions);
    }
  }

  const FAKE_SIGNATURE = new Uint8Array(256).fill(1);
  function toAddress(registry, address) {
    return registry.createTypeUnsafe('Address', [util.isU8a(address) ? util.u8aToHex(address) : address]);
  }
  class GenericExtrinsicSignatureV4 extends Struct {
    #signKeys;
    constructor(registry, value, {
      isSigned
    } = {}) {
      const signTypes = registry.getSignedExtensionTypes();
      super(registry, util.objectSpread(
      {
        signer: 'Address',
        signature: 'ExtrinsicSignature'
      }, signTypes), GenericExtrinsicSignatureV4.decodeExtrinsicSignature(value, isSigned));
      this.#signKeys = Object.keys(signTypes);
      util.objectProperties(this, this.#signKeys, k => this.get(k));
    }
    static decodeExtrinsicSignature(value, isSigned = false) {
      if (!value) {
        return EMPTY_U8A;
      } else if (value instanceof GenericExtrinsicSignatureV4) {
        return value;
      }
      return isSigned ? value : EMPTY_U8A;
    }
    get encodedLength() {
      return this.isSigned ? super.encodedLength : 0;
    }
    get isSigned() {
      return !this.signature.isEmpty;
    }
    get era() {
      return this.getT('era');
    }
    get nonce() {
      return this.getT('nonce');
    }
    get signature() {
      return this.multiSignature.value || this.multiSignature;
    }
    get multiSignature() {
      return this.getT('signature');
    }
    get signer() {
      return this.getT('signer');
    }
    get tip() {
      return this.getT('tip');
    }
    _injectSignature(signer, signature, payload) {
      for (let i = 0; i < this.#signKeys.length; i++) {
        const k = this.#signKeys[i];
        const v = payload.get(k);
        if (!util.isUndefined(v)) {
          this.set(k, v);
        }
      }
      this.set('signer', signer);
      this.set('signature', signature);
      return this;
    }
    addSignature(signer, signature, payload) {
      return this._injectSignature(toAddress(this.registry, signer), this.registry.createTypeUnsafe('ExtrinsicSignature', [signature]), new GenericExtrinsicPayloadV4(this.registry, payload));
    }
    createPayload(method, options) {
      const {
        era,
        runtimeVersion: {
          specVersion,
          transactionVersion
        }
      } = options;
      return new GenericExtrinsicPayloadV4(this.registry, util.objectSpread({}, options, {
        era: era || IMMORTAL_ERA,
        method: method.toHex(),
        specVersion,
        transactionVersion
      }));
    }
    sign(method, account, options) {
      if (!account || !account.addressRaw) {
        throw new Error(`Expected a valid keypair for signing, found ${util.stringify(account)}`);
      }
      const payload = this.createPayload(method, options);
      return this._injectSignature(toAddress(this.registry, account.addressRaw), this.registry.createTypeUnsafe('ExtrinsicSignature', [payload.sign(account)]), payload);
    }
    signFake(method, address, options) {
      if (!address) {
        throw new Error(`Expected a valid address for signing, found ${util.stringify(address)}`);
      }
      const payload = this.createPayload(method, options);
      return this._injectSignature(toAddress(this.registry, address), this.registry.createTypeUnsafe('ExtrinsicSignature', [FAKE_SIGNATURE]), payload);
    }
    toU8a(isBare) {
      return this.isSigned ? super.toU8a(isBare) : EMPTY_U8A;
    }
  }

  function decodeAccountId$1(value) {
    if (util.isU8a(value) || Array.isArray(value)) {
      return util.u8aToU8a(value);
    } else if (util.isHex(value) || utilCrypto.isEthereumAddress(value.toString())) {
      return util.hexToU8a(value.toString());
    } else if (util.isString(value)) {
      return util.u8aToU8a(value);
    }
    return value;
  }
  class GenericEthereumAccountId extends U8aFixed {
    constructor(registry, value = new Uint8Array()) {
      super(registry, decodeAccountId$1(value), 160);
    }
    eq(other) {
      return super.eq(decodeAccountId$1(other));
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.toString();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toString() {
      return utilCrypto.ethereumEncode(this);
    }
    toRawType() {
      return 'AccountId';
    }
  }

  const PREFIX_1BYTE = 0xef;
  const PREFIX_2BYTE = 0xfc;
  const PREFIX_4BYTE = 0xfd;
  const PREFIX_8BYTE = 0xfe;
  const MAX_1BYTE = new util.BN(PREFIX_1BYTE);
  const MAX_2BYTE = new util.BN(1).shln(16);
  const MAX_4BYTE = new util.BN(1).shln(32);
  function decodeAccountIndex(value) {
    if (value instanceof GenericAccountIndex) {
      return value.toBn();
    } else if (util.isBn(value) || util.isNumber(value) || util.isHex(value) || util.isU8a(value) || util.isBigInt(value)) {
      return value;
    }
    return decodeAccountIndex(utilCrypto.decodeAddress(value));
  }
  class GenericAccountIndex extends u32 {
    constructor(registry, value = new util.BN(0)) {
      super(registry, decodeAccountIndex(value));
    }
    static calcLength(_value) {
      const value = util.bnToBn(_value);
      if (value.lte(MAX_1BYTE)) {
        return 1;
      } else if (value.lt(MAX_2BYTE)) {
        return 2;
      } else if (value.lt(MAX_4BYTE)) {
        return 4;
      }
      return 8;
    }
    static readLength(input) {
      const first = input[0];
      if (first === PREFIX_2BYTE) {
        return [1, 2];
      } else if (first === PREFIX_4BYTE) {
        return [1, 4];
      } else if (first === PREFIX_8BYTE) {
        return [1, 8];
      }
      return [0, 1];
    }
    static writeLength(input) {
      switch (input.length) {
        case 2:
          return new Uint8Array([PREFIX_2BYTE]);
        case 4:
          return new Uint8Array([PREFIX_4BYTE]);
        case 8:
          return new Uint8Array([PREFIX_8BYTE]);
        default:
          return new Uint8Array([]);
      }
    }
    eq(other) {
      if (util.isBn(other) || util.isNumber(other)) {
        return super.eq(other);
      }
      return super.eq(this.registry.createTypeUnsafe('AccountIndex', [other]));
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.toString();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toString() {
      const length = GenericAccountIndex.calcLength(this);
      return utilCrypto.encodeAddress(this.toU8a().subarray(0, length), this.registry.chainSS58);
    }
    toRawType() {
      return 'AccountIndex';
    }
  }

  const ACCOUNT_ID_PREFIX$1 = new Uint8Array([0xff]);
  function decodeString$1(registry, value) {
    const decoded = utilCrypto.decodeAddress(value);
    return decoded.length === 20 ? registry.createTypeUnsafe('EthereumAccountId', [decoded]) : registry.createTypeUnsafe('AccountIndex', [util.u8aToBn(decoded)]);
  }
  function decodeU8a$3(registry, value) {
    if (value.length === 20) {
      return registry.createTypeUnsafe('EthereumAccountId', [value]);
    } else if (value[0] === 0xff) {
      return registry.createTypeUnsafe('EthereumAccountId', [value.subarray(1)]);
    }
    const [offset, length] = GenericAccountIndex.readLength(value);
    return registry.createTypeUnsafe('AccountIndex', [util.u8aToBn(value.subarray(offset, offset + length))]);
  }
  function decodeAddressOrIndex$1(registry, value) {
    return value instanceof GenericEthereumLookupSource ? value.inner : value instanceof GenericEthereumAccountId || value instanceof GenericAccountIndex ? value : util.isU8a(value) || Array.isArray(value) || util.isHex(value) ? decodeU8a$3(registry, util.u8aToU8a(value)) : util.isBn(value) || util.isNumber(value) || util.isBigInt(value) ? registry.createTypeUnsafe('AccountIndex', [value]) : decodeString$1(registry, value);
  }
  class GenericEthereumLookupSource extends AbstractBase {
    constructor(registry, value = new Uint8Array()) {
      super(registry, decodeAddressOrIndex$1(registry, value));
    }
    get encodedLength() {
      const rawLength = this._rawLength;
      return rawLength + (
      rawLength > 1 ? 1 : 0);
    }
    get _rawLength() {
      return this.inner instanceof GenericAccountIndex ? GenericAccountIndex.calcLength(this.inner) : this.inner.encodedLength;
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toRawType() {
      return 'Address';
    }
    toU8a(isBare) {
      const encoded = this.inner.toU8a().subarray(0, this._rawLength);
      return isBare ? encoded : util.u8aConcat(this.inner instanceof GenericAccountIndex ? GenericAccountIndex.writeLength(encoded) : ACCOUNT_ID_PREFIX$1, encoded);
    }
  }

  function decodeAccountId(value) {
    if (util.isU8a(value) || Array.isArray(value)) {
      return util.u8aToU8a(value);
    } else if (!value) {
      return new Uint8Array();
    } else if (util.isHex(value)) {
      return util.hexToU8a(value);
    } else if (util.isString(value)) {
      return utilCrypto.decodeAddress(value.toString());
    }
    throw new Error(`Unknown type passed to AccountId constructor, found typeof ${typeof value}`);
  }
  class BaseAccountId extends U8aFixed {
    constructor(registry, allowedBits = 256 | 264, value) {
      const decoded = decodeAccountId(value);
      const decodedBits = decoded.length * 8;
      if (decodedBits < allowedBits && decoded.some(b => b)) {
        throw new Error(`Invalid AccountId provided, expected ${allowedBits >> 3} bytes, found ${decoded.length}`);
      }
      super(registry, decoded, allowedBits);
    }
    eq(other) {
      return super.eq(decodeAccountId(other));
    }
    toHuman() {
      return this.toJSON();
    }
    toJSON() {
      return this.toString();
    }
    toPrimitive() {
      return this.toJSON();
    }
    toString() {
      return utilCrypto.encodeAddress(this, this.registry.chainSS58);
    }
    toRawType() {
      return 'AccountId';
    }
  }
  class GenericAccountId extends BaseAccountId {
    constructor(registry, value) {
      super(registry, 256, value);
    }
  }
  class GenericAccountId33 extends BaseAccountId {
    constructor(registry, value) {
      super(registry, 264, value);
    }
  }

  class GenericBlock extends Struct {
    constructor(registry, value) {
      super(registry, {
        header: 'Header',
        extrinsics: 'Vec<Extrinsic>'
      }, value);
    }
    get contentHash() {
      return this.registry.hash(this.toU8a());
    }
    get extrinsics() {
      return this.getT('extrinsics');
    }
    get hash() {
      return this.header.hash;
    }
    get header() {
      return this.getT('header');
    }
  }

  function getArgsDef(registry, meta) {
    return meta.fields.reduce((result, {
      name,
      type
    }, index) => {
      result[name.unwrapOr(`param${index}`).toString()] = registry.createLookupType(type);
      return result;
    }, {});
  }
  function decodeCallViaObject(registry, value, _meta) {
    const {
      args,
      callIndex
    } = value;
    const lookupIndex = callIndex instanceof GenericCallIndex ? callIndex.toU8a() : callIndex;
    const meta = _meta || registry.findMetaCall(lookupIndex).meta;
    return {
      args,
      argsDef: getArgsDef(registry, meta),
      callIndex,
      meta
    };
  }
  function decodeCallViaU8a(registry, value, _meta) {
    const callIndex = registry.firstCallIndex.slice();
    callIndex.set(value.subarray(0, 2), 0);
    const meta = _meta || registry.findMetaCall(callIndex).meta;
    return {
      args: value.subarray(2),
      argsDef: getArgsDef(registry, meta),
      callIndex,
      meta
    };
  }
  function decodeCall(registry, value = new Uint8Array(), _meta) {
    if (util.isU8a(value) || util.isHex(value)) {
      return decodeCallViaU8a(registry, util.u8aToU8a(value), _meta);
    } else if (util.isObject(value) && value.callIndex && value.args) {
      return decodeCallViaObject(registry, value, _meta);
    }
    throw new Error(`Call: Cannot decode value '${value}' of type ${typeof value}`);
  }
  class GenericCallIndex extends U8aFixed {
    constructor(registry, value) {
      super(registry, value, 16);
    }
    toPrimitive() {
      return this.toHex();
    }
  }
  class GenericCall extends Struct {
    constructor(registry, value, meta) {
      const decoded = decodeCall(registry, value, meta);
      try {
        super(registry, {
          callIndex: GenericCallIndex,
          args: Struct.with(decoded.argsDef)
        }, decoded);
      } catch (error) {
        let method = 'unknown.unknown';
        try {
          const c = registry.findMetaCall(decoded.callIndex);
          method = `${c.section}.${c.method}`;
        } catch (error) {
        }
        throw new Error(`Call: failed decoding ${method}:: ${error.message}`);
      }
      this._meta = decoded.meta;
    }
    get args() {
      return [...this.getT('args').values()];
    }
    get argsDef() {
      return getArgsDef(this.registry, this.meta);
    }
    get argsEntries() {
      return [...this.getT('args').entries()];
    }
    get callIndex() {
      return this.getT('callIndex').toU8a();
    }
    get data() {
      return this.getT('args').toU8a();
    }
    get meta() {
      return this._meta;
    }
    get method() {
      return this.registry.findMetaCall(this.callIndex).method;
    }
    get section() {
      return this.registry.findMetaCall(this.callIndex).section;
    }
    is(other) {
      return other.callIndex[0] === this.callIndex[0] && other.callIndex[1] === this.callIndex[1];
    }
    toHuman(isExpanded) {
      var _call, _call2;
      let call;
      try {
        call = this.registry.findMetaCall(this.callIndex);
      } catch (error) {
      }
      return util.objectSpread({
        args: this.argsEntries.reduce((args, [n, a]) => util.objectSpread(args, {
          [n]: a.toHuman(isExpanded)
        }), {}),
        method: (_call = call) === null || _call === void 0 ? void 0 : _call.method,
        section: (_call2 = call) === null || _call2 === void 0 ? void 0 : _call2.section
      }, isExpanded && call ? {
        docs: call.meta.docs.map(d => d.toString())
      } : null);
    }
    toRawType() {
      return 'Call';
    }
  }

  function createValue(registry, type, value, asArray = true) {
    if (value && util.isFunction(value.unwrapOrDefault)) {
      return value;
    }
    return registry.createTypeUnsafe(type, [asArray ? util.isNull(value) || util.isUndefined(value) ? null : Array.isArray(value) ? value : [value] : value]);
  }
  function decodeValue(registry, key, value) {
    return key === 'ss58Format' ? createValue(registry, 'Option<u32>', value, false) : key === 'tokenDecimals' ? createValue(registry, 'Option<Vec<u32>>', value) : key === 'tokenSymbol' ? createValue(registry, 'Option<Vec<Text>>', value) : value;
  }
  function decode(registry, value) {
    return (
    value && util.isFunction(value.entries) ? [...value.entries()] : Object.entries(value || {})).reduce((all, [key, value]) => {
      all[key] = decodeValue(registry, key, value);
      return all;
    }, {
      ss58Format: registry.createTypeUnsafe('Option<u32>', []),
      tokenDecimals: registry.createTypeUnsafe('Option<Vec<u32>>', []),
      tokenSymbol: registry.createTypeUnsafe('Option<Vec<Text>>', [])
    });
  }
  class GenericChainProperties extends Json {
    constructor(registry, value) {
      super(registry, decode(registry, value));
    }
    get ss58Format() {
      return this.getT('ss58Format');
    }
    get tokenDecimals() {
      return this.getT('tokenDecimals');
    }
    get tokenSymbol() {
      return this.getT('tokenSymbol');
    }
  }

  const CID_AURA = util.stringToU8a('aura');
  const CID_BABE = util.stringToU8a('BABE');
  const CID_GRPA = util.stringToU8a('FRNK');
  const CID_POW = util.stringToU8a('pow_');
  function getAuraAuthor(registry, bytes, sessionValidators) {
    return sessionValidators[registry.createTypeUnsafe('RawAuraPreDigest', [bytes.toU8a(true)]).slotNumber.mod(new util.BN(sessionValidators.length)).toNumber()];
  }
  function getBabeAuthor(registry, bytes, sessionValidators) {
    const digest = registry.createTypeUnsafe('RawBabePreDigestCompat', [bytes.toU8a(true)]);
    return sessionValidators[digest.value.toNumber()];
  }
  function getBytesAsAuthor(registry, bytes) {
    return registry.createTypeUnsafe('AccountId', [bytes]);
  }
  class GenericConsensusEngineId extends U8aFixed {
    constructor(registry, value) {
      super(registry, util.isNumber(value) ? util.bnToU8a(value, {
        isLe: false
      }) : value, 32);
    }
    get isAura() {
      return this.eq(CID_AURA);
    }
    get isBabe() {
      return this.eq(CID_BABE);
    }
    get isGrandpa() {
      return this.eq(CID_GRPA);
    }
    get isPow() {
      return this.eq(CID_POW);
    }
    extractAuthor(bytes, sessionValidators) {
      if (sessionValidators !== null && sessionValidators !== void 0 && sessionValidators.length) {
        if (this.isAura) {
          return getAuraAuthor(this.registry, bytes, sessionValidators);
        } else if (this.isBabe) {
          return getBabeAuthor(this.registry, bytes, sessionValidators);
        }
      }
      if (this.isPow || bytes.length === 20) {
        return getBytesAsAuthor(this.registry, bytes);
      }
      return undefined;
    }
    toHuman() {
      return this.toString();
    }
    toRawType() {
      return 'ConsensusEngineId';
    }
    toString() {
      return this.isAscii ? util.u8aToString(this) : util.u8aToHex(this);
    }
  }

  const ACCOUNT_ID_PREFIX = new Uint8Array([0xff]);
  function decodeString(registry, value) {
    const decoded = utilCrypto.decodeAddress(value);
    return decoded.length === 32 ? registry.createTypeUnsafe('AccountId', [decoded]) : registry.createTypeUnsafe('AccountIndex', [util.u8aToBn(decoded)]);
  }
  function decodeU8a$2(registry, value) {
    if (value.length === 32) {
      return registry.createTypeUnsafe('AccountId', [value]);
    } else if (value[0] === 0xff) {
      return registry.createTypeUnsafe('AccountId', [value.subarray(1)]);
    }
    const [offset, length] = GenericAccountIndex.readLength(value);
    return registry.createTypeUnsafe('AccountIndex', [util.u8aToBn(value.subarray(offset, offset + length))]);
  }
  function decodeAddressOrIndex(registry, value) {
    return value instanceof GenericLookupSource ? value.inner : value instanceof GenericAccountId || value instanceof GenericAccountIndex ? value : util.isBn(value) || util.isNumber(value) || util.isBigInt(value) ? registry.createTypeUnsafe('AccountIndex', [value]) : Array.isArray(value) || util.isHex(value) || util.isU8a(value) ? decodeU8a$2(registry, util.u8aToU8a(value)) : decodeString(registry, value);
  }
  class GenericLookupSource extends AbstractBase {
    constructor(registry, value = new Uint8Array()) {
      super(registry, decodeAddressOrIndex(registry, value));
    }
    get encodedLength() {
      const rawLength = this._rawLength;
      return rawLength + (
      rawLength > 1 ? 1 : 0);
    }
    get _rawLength() {
      return this.inner instanceof GenericAccountIndex ? GenericAccountIndex.calcLength(this.inner) : this.inner.encodedLength;
    }
    inspect() {
      const value = this.inner.toU8a().subarray(0, this._rawLength);
      return {
        outer: [new Uint8Array(this.inner instanceof GenericAccountIndex ? GenericAccountIndex.writeLength(value) : ACCOUNT_ID_PREFIX), value]
      };
    }
    toHex() {
      return util.u8aToHex(this.toU8a());
    }
    toRawType() {
      return 'Address';
    }
    toU8a(isBare) {
      const encoded = this.inner.toU8a().subarray(0, this._rawLength);
      return isBare ? encoded : util.u8aConcat(this.inner instanceof GenericAccountIndex ? GenericAccountIndex.writeLength(encoded) : ACCOUNT_ID_PREFIX, encoded);
    }
  }

  function decodeU8a$1(registry, u8a) {
    if ([0, 32].includes(u8a.length)) {
      return {
        Id: u8a
      };
    } else if (u8a.length === 20) {
      return {
        Address20: u8a
      };
    } else if (u8a.length <= 8) {
      return {
        Index: registry.createTypeUnsafe('AccountIndex', [u8a]).toNumber()
      };
    }
    return u8a;
  }
  function decodeMultiAny(registry, value) {
    if (value instanceof GenericAccountId) {
      return {
        Id: value
      };
    } else if (util.isU8a(value)) {
      return decodeU8a$1(registry, value);
    } else if (value instanceof GenericMultiAddress) {
      return value;
    } else if (value instanceof GenericAccountIndex || util.isBn(value) || util.isNumber(value)) {
      return {
        Index: util.isNumber(value) ? value : value.toNumber()
      };
    } else if (util.isString(value)) {
      return decodeU8a$1(registry, utilCrypto.decodeAddress(value.toString()));
    }
    return value;
  }
  class GenericMultiAddress extends Enum {
    constructor(registry, value) {
      super(registry, {
        Id: 'AccountId',
        Index: 'Compact<AccountIndex>',
        Raw: 'Bytes',
        Address32: 'H256',
        Address20: 'H160'
      }, decodeMultiAny(registry, value));
    }
    inspect() {
      const {
        inner,
        outer = []
      } = this.inner.inspect();
      return {
        inner,
        outer: [new Uint8Array([this.index]), ...outer]
      };
    }
    toString() {
      return this.value.toString();
    }
  }

  const AYE_BITS = 0b10000000;
  const NAY_BITS = 0b00000000;
  const CON_MASK = 0b01111111;
  const DEF_CONV = 0b00000000;
  function decodeVoteBool(value) {
    return value ? new Uint8Array([AYE_BITS | DEF_CONV]) : new Uint8Array([NAY_BITS]);
  }
  function decodeVoteU8a(value) {
    return value.length ? value.subarray(0, 1) : new Uint8Array([NAY_BITS]);
  }
  function decodeVoteType(registry, value) {
    return new Uint8Array([(new bool(registry, value.aye).isTrue ? AYE_BITS : NAY_BITS) | registry.createTypeUnsafe('Conviction', [value.conviction || DEF_CONV]).index]);
  }
  function decodeVote(registry, value) {
    if (util.isU8a(value)) {
      return decodeVoteU8a(value);
    } else if (util.isUndefined(value) || value instanceof Boolean || util.isBoolean(value)) {
      return decodeVoteBool(new bool(registry, value).isTrue);
    } else if (util.isNumber(value)) {
      return decodeVoteBool(value < 0);
    }
    return decodeVoteType(registry, value);
  }
  class GenericVote extends U8aFixed {
    #aye;
    #conviction;
    constructor(registry, value) {
      const decoded = decodeVote(registry, value);
      super(registry, decoded, 8);
      this.#aye = (decoded[0] & AYE_BITS) === AYE_BITS;
      this.#conviction = this.registry.createTypeUnsafe('Conviction', [decoded[0] & CON_MASK]);
    }
    get conviction() {
      return this.#conviction;
    }
    get isAye() {
      return this.#aye;
    }
    get isNay() {
      return !this.isAye;
    }
    toHuman(isExpanded) {
      return {
        conviction: this.conviction.toHuman(isExpanded),
        vote: this.isAye ? 'Aye' : 'Nay'
      };
    }
    toPrimitive() {
      return {
        aye: this.isAye,
        conviction: this.conviction.toPrimitive()
      };
    }
    toRawType() {
      return 'Vote';
    }
  }

  function decodeDataU8a(registry, value) {
    const indicator = value[0];
    if (!indicator) {
      return [undefined, undefined];
    } else if (indicator >= 1 && indicator <= 33) {
      const length = indicator - 1;
      const data = value.subarray(1, length + 1);
      return [registry.createTypeUnsafe('Raw', [data]), 1];
    } else if (indicator >= 34 && indicator <= 37) {
      return [value.subarray(1, 32 + 1), indicator - 32];
    }
    throw new Error(`Unable to decode Data, invalid indicator byte ${indicator}`);
  }
  function decodeData(registry, value) {
    if (util.isU8a(value) || util.isString(value)) {
      return decodeDataU8a(registry, util.u8aToU8a(value));
    } else if (!value) {
      return [undefined, undefined];
    }
    return [value, undefined];
  }
  class Data extends Enum {
    constructor(registry, value) {
      super(registry, {
        None: 'Null',
        Raw: 'Bytes',
        BlakeTwo256: 'H256',
        Sha256: 'H256',
        Keccak256: 'H256',
        ShaThree256: 'H256'
      }, ...decodeData(registry, value));
      if (this.isRaw && this.asRaw.length > 32) {
        throw new Error('Data.Raw values are limited to a maximum length of 32 bytes');
      }
    }
    get asBlakeTwo256() {
      return this.value;
    }
    get asKeccak256() {
      return this.value;
    }
    get asRaw() {
      return this.value;
    }
    get asSha256() {
      return this.value;
    }
    get asShaThree256() {
      return this.value;
    }
    get isBlakeTwo256() {
      return this.index === 2;
    }
    get isKeccak256() {
      return this.index === 4;
    }
    get isNone() {
      return this.index === 0;
    }
    get isRaw() {
      return this.index === 1;
    }
    get isSha256() {
      return this.index === 3;
    }
    get isShaThree256() {
      return this.index === 5;
    }
    get encodedLength() {
      return this.toU8a().length;
    }
    toU8a() {
      if (this.index === 0) {
        return new Uint8Array(1);
      } else if (this.index === 1) {
        const data = this.value.toU8a(true);
        const length = Math.min(data.length, 32);
        const u8a = new Uint8Array(length + 1);
        u8a.set([length + 1], 0);
        u8a.set(data.subarray(0, length), 1);
        return u8a;
      }
      const u8a = new Uint8Array(33);
      u8a.set([this.index + 32], 0);
      u8a.set(this.value.toU8a(), 1);
      return u8a;
    }
  }

  function flattenUniq(list, result = []) {
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (Array.isArray(entry)) {
        flattenUniq(entry, result);
      } else {
        result.push(entry);
      }
    }
    return [...new Set(result)];
  }

  function getSiName(lookup, type) {
    const typeDef = lookup.getTypeDef(type);
    return typeDef.lookupName || typeDef.type;
  }

  function extractSubSingle(_, {
    sub
  }) {
    const {
      lookupName,
      type
    } = sub;
    return extractTypes$1([lookupName || type]);
  }
  function extractSubArray(_, {
    sub
  }) {
    return extractTypes$1(sub.map(({
      lookupName,
      type
    }) => lookupName || type));
  }
  function unhandled(type, {
    info
  }) {
    throw new Error(`Unhandled: Unable to create and validate type from ${type} (info=${exports.TypeDefInfo[info]})`);
  }
  const mapping = {
    [exports.TypeDefInfo.BTreeMap]: extractSubArray,
    [exports.TypeDefInfo.BTreeSet]: extractSubSingle,
    [exports.TypeDefInfo.Compact]: extractSubSingle,
    [exports.TypeDefInfo.DoNotConstruct]: unhandled,
    [exports.TypeDefInfo.Enum]: extractSubArray,
    [exports.TypeDefInfo.HashMap]: extractSubArray,
    [exports.TypeDefInfo.Int]: unhandled,
    [exports.TypeDefInfo.Linkage]: extractSubSingle,
    [exports.TypeDefInfo.Null]: unhandled,
    [exports.TypeDefInfo.Option]: extractSubSingle,
    [exports.TypeDefInfo.Plain]: (_, typeDef) => typeDef.lookupName || typeDef.type,
    [exports.TypeDefInfo.Range]: extractSubSingle,
    [exports.TypeDefInfo.RangeInclusive]: extractSubSingle,
    [exports.TypeDefInfo.Result]: extractSubArray,
    [exports.TypeDefInfo.Set]: extractSubArray,
    [exports.TypeDefInfo.Si]: unhandled,
    [exports.TypeDefInfo.Struct]: extractSubArray,
    [exports.TypeDefInfo.Tuple]: extractSubArray,
    [exports.TypeDefInfo.UInt]: unhandled,
    [exports.TypeDefInfo.Vec]: extractSubSingle,
    [exports.TypeDefInfo.VecFixed]: extractSubSingle,
    [exports.TypeDefInfo.WrapperKeepOpaque]: extractSubSingle,
    [exports.TypeDefInfo.WrapperOpaque]: extractSubSingle
  };
  function extractTypes$1(types) {
    const count = types.length;
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      const type = types[i];
      const typeDef = getTypeDef(type);
      result[i] = mapping[typeDef.info](type, typeDef);
    }
    return result;
  }

  const l$2 = util.logger('metadata');
  function validateTypes(registry, throwError, types) {
    const missing = flattenUniq(extractTypes$1(types)).filter(type => !registry.hasType(type) && !registry.isLookupType(type)).sort();
    if (missing.length !== 0) {
      const message = `Unknown types found, no types for ${missing.join(', ')}`;
      if (throwError) {
        throw new Error(message);
      } else {
        l$2.warn(message);
      }
    }
    return types;
  }

  function extractTypes(lookup, types) {
    return types.map(({
      type
    }) => lookup.getTypeDef(type).type);
  }
  function extractFieldTypes(lookup, type) {
    return lookup.getSiType(type).def.asVariant.variants.map(({
      fields
    }) => extractTypes(lookup, fields));
  }
  function getPalletNames({
    lookup,
    pallets
  }) {
    return pallets.reduce((all, {
      calls,
      constants,
      events,
      storage
    }) => {
      all.push([extractTypes(lookup, constants)]);
      if (calls.isSome) {
        all.push(extractFieldTypes(lookup, calls.unwrap().type));
      }
      if (events.isSome) {
        all.push(extractFieldTypes(lookup, events.unwrap().type));
      }
      if (storage.isSome) {
        all.push(storage.unwrap().items.map(({
          type
        }) => {
          if (type.isPlain) {
            return [lookup.getTypeDef(type.asPlain).type];
          }
          const {
            hashers,
            key,
            value
          } = type.asMap;
          return hashers.length === 1 ? [lookup.getTypeDef(value).type, lookup.getTypeDef(key).type] : [lookup.getTypeDef(value).type, ...lookup.getSiType(key).def.asTuple.map(t => lookup.getTypeDef(t).type)];
        }));
      }
      return all;
    }, []);
  }
  function getUniqTypes(registry, meta, throwError) {
    return validateTypes(registry, throwError, flattenUniq(getPalletNames(meta)));
  }

  function trimDocs(docs) {
    const strings = docs.map(d => d.toString().trim());
    const firstEmpty = strings.findIndex(d => !d.length);
    return firstEmpty === -1 ? strings : strings.slice(0, firstEmpty);
  }
  function toCallsOnly(registry, {
    extrinsic,
    lookup,
    pallets
  }) {
    return registry.createTypeUnsafe('MetadataLatest', [{
      extrinsic,
      lookup: {
        types: lookup.types.map(({
          id,
          type
        }) => registry.createTypeUnsafe('PortableType', [{
          id,
          type: util.objectSpread({}, type, {
            docs: trimDocs(type.docs)
          })
        }]))
      },
      pallets: pallets.map(({
        calls,
        index,
        name
      }) => ({
        calls: registry.createTypeUnsafe('Option<PalletCallMetadataLatest>', [calls.unwrapOr(null)]),
        index,
        name
      }))
    }]).toJSON();
  }

  const HASHER_MAP = {
    Blake2_128: [16, false],
    Blake2_128Concat: [16, true],
    Blake2_256: [32, false],
    Identity: [0, true],
    Twox128: [16, false],
    Twox256: [32, false],
    Twox64Concat: [8, true]
  };
  function unwrapStorageSi(type) {
    return type.isPlain ? type.asPlain : type.asMap.value;
  }
  function unwrapStorageType(registry, type, isOptional) {
    const outputType = getSiName(registry.lookup, unwrapStorageSi(type));
    return isOptional ? `Option<${outputType}>` : outputType;
  }
  function decodeStorageKey(value) {
    if (util.isU8a(value) || !value || util.isString(value)) {
      return {
        key: value
      };
    } else if (value instanceof StorageKey) {
      return {
        key: value,
        method: value.method,
        section: value.section
      };
    } else if (util.isFunction(value)) {
      return {
        key: value(),
        method: value.method,
        section: value.section
      };
    } else if (Array.isArray(value)) {
      const [fn, args = []] = value;
      if (!util.isFunction(fn)) {
        throw new Error('Expected function input for key construction');
      }
      if (fn.meta && fn.meta.type.isMap) {
        const map = fn.meta.type.asMap;
        if (!Array.isArray(args) || args.length !== map.hashers.length) {
          throw new Error(`Expected an array of ${map.hashers.length} values as params to a Map query`);
        }
      }
      return {
        key: fn(...args),
        method: fn.method,
        section: fn.section
      };
    }
    throw new Error(`Unable to convert input ${value} to StorageKey`);
  }
  function decodeHashers(registry, value, hashers) {
    let offset = 32;
    const result = new Array(hashers.length);
    for (let i = 0; i < hashers.length; i++) {
      const [hasher, type] = hashers[i];
      const [hashLen, canDecode] = HASHER_MAP[hasher.type];
      const decoded = canDecode ? registry.createTypeUnsafe(getSiName(registry.lookup, type), [value.subarray(offset + hashLen)]) : registry.createTypeUnsafe('Raw', [value.subarray(offset, offset + hashLen)]);
      offset += hashLen + (canDecode ? decoded.encodedLength : 0);
      result[i] = decoded;
    }
    return result;
  }
  function decodeArgsFromMeta(registry, value, meta) {
    if (!meta || !meta.type.isMap) {
      return [];
    }
    const {
      hashers,
      key
    } = meta.type.asMap;
    const keys = hashers.length === 1 ? [key] : registry.lookup.getSiType(key).def.asTuple;
    return decodeHashers(registry, value, hashers.map((h, i) => [h, keys[i]]));
  }
  function getMeta(value) {
    if (value instanceof StorageKey) {
      return value.meta;
    } else if (util.isFunction(value)) {
      return value.meta;
    } else if (Array.isArray(value)) {
      const [fn] = value;
      return fn.meta;
    }
    return undefined;
  }
  function getType(registry, value) {
    if (value instanceof StorageKey) {
      return value.outputType;
    } else if (util.isFunction(value)) {
      return unwrapStorageType(registry, value.meta.type);
    } else if (Array.isArray(value)) {
      const [fn] = value;
      if (fn.meta) {
        return unwrapStorageType(registry, fn.meta.type);
      }
    }
    return 'Raw';
  }
  class StorageKey extends Bytes {
    #args;
    #meta;
    #outputType;
    #method;
    #section;
    constructor(registry, value, override = {}) {
      const {
        key,
        method,
        section
      } = decodeStorageKey(value);
      super(registry, key);
      this.#outputType = getType(registry, value);
      this.setMeta(getMeta(value), override.section || section, override.method || method);
    }
    get args() {
      return this.#args;
    }
    get meta() {
      return this.#meta;
    }
    get method() {
      return this.#method;
    }
    get outputType() {
      return this.#outputType;
    }
    get section() {
      return this.#section;
    }
    is(key) {
      return key.section === this.section && key.method === this.method;
    }
    setMeta(meta, section, method) {
      this.#meta = meta;
      this.#method = method || this.#method;
      this.#section = section || this.#section;
      if (meta) {
        this.#outputType = unwrapStorageType(this.registry, meta.type);
      }
      try {
        this.#args = decodeArgsFromMeta(this.registry, this.toU8a(true), meta);
      } catch (error) {
      }
      return this;
    }
    toHuman() {
      return this.#args.length ? this.#args.map(a => a.toHuman()) : super.toHuman();
    }
    toRawType() {
      return 'StorageKey';
    }
  }

  const baseTypes = /*#__PURE__*/Object.freeze({
    __proto__: null,
    GenericExtrinsic: GenericExtrinsic,
    GenericExtrinsicEra: GenericExtrinsicEra,
    GenericMortalEra: MortalEra,
    GenericImmortalEra: ImmortalEra,
    GenericExtrinsicPayload: GenericExtrinsicPayload,
    GenericExtrinsicPayloadUnknown: GenericExtrinsicPayloadUnknown,
    GenericExtrinsicUnknown: GenericExtrinsicUnknown,
    GenericSignerPayload: GenericSignerPayload,
    GenericExtrinsicV4: GenericExtrinsicV4,
    GenericExtrinsicPayloadV4: GenericExtrinsicPayloadV4,
    GenericExtrinsicSignatureV4: GenericExtrinsicSignatureV4,
    GenericAccountId: GenericAccountId,
    GenericAccountId32: GenericAccountId,
    GenericAccountId33: GenericAccountId33,
    GenericAccountIndex: GenericAccountIndex,
    GenericBlock: GenericBlock,
    GenericCall: GenericCall,
    GenericChainProperties: GenericChainProperties,
    GenericConsensusEngineId: GenericConsensusEngineId,
    GenericEvent: GenericEvent,
    GenericEventData: GenericEventData,
    GenericLookupSource: GenericLookupSource,
    GenericMultiAddress: GenericMultiAddress,
    GenericAddress: GenericMultiAddress,
    GenericVote: GenericVote,
    GenericEthereumAccountId: GenericEthereumAccountId,
    GenericEthereumLookupSource: GenericEthereumLookupSource,
    BitVec: BitVec,
    bool: bool,
    Bool: bool,
    Bytes: Bytes,
    f32: f32,
    F32: f32,
    f64: f64,
    F64: f64,
    i8: i8,
    I8: i8,
    i16: i16,
    I16: i16,
    i32: i32,
    I32: i32,
    i64: i64,
    I64: i64,
    i128: i128,
    I128: i128,
    i256: i256,
    I256: i256,
    Null: Null,
    OptionBool: OptionBool,
    Text: Text,
    Type: Type,
    u8: u8,
    U8: u8,
    u16: u16,
    U16: u16,
    u32: u32,
    U32: u32,
    u64: u64,
    U64: u64,
    u128: u128,
    U128: u128,
    u256: u256,
    U256: u256,
    usize: usize,
    USize: usize,
    Data: Data,
    StorageKey: StorageKey
  });

  function createStorageHasher(registry, hasher) {
    if (hasher.toNumber() >= 2) {
      return registry.createTypeUnsafe('StorageHasherV10', [hasher.toNumber() + 1]);
    }
    return registry.createTypeUnsafe('StorageHasherV10', [hasher]);
  }
  function createStorageType(registry, entryType) {
    if (entryType.isMap) {
      return [util.objectSpread({}, entryType.asMap, {
        hasher: createStorageHasher(registry, entryType.asMap.hasher)
      }), 1];
    }
    if (entryType.isDoubleMap) {
      return [util.objectSpread({}, entryType.asDoubleMap, {
        hasher: createStorageHasher(registry, entryType.asDoubleMap.hasher),
        key2Hasher: createStorageHasher(registry, entryType.asDoubleMap.key2Hasher)
      }), 2];
    }
    return [entryType.asPlain, 0];
  }
  function convertModule(registry, mod) {
    const storage = mod.storage.unwrapOr(null);
    return registry.createTypeUnsafe('ModuleMetadataV10', [util.objectSpread({}, mod, {
      storage: storage ? util.objectSpread({}, storage, {
        items: storage.items.map(item => util.objectSpread({}, item, {
          type: registry.createTypeUnsafe('StorageEntryTypeV10', createStorageType(registry, item.type))
        }))
      }) : null
    })]);
  }
  function toV10(registry, {
    modules
  }) {
    return registry.createTypeUnsafe('MetadataV10', [{
      modules: modules.map(mod => convertModule(registry, mod))
    }]);
  }

  function toV11(registry, {
    modules
  }) {
    return registry.createTypeUnsafe('MetadataV11', [{
      extrinsic: {
        signedExtensions: [],
        version: 0
      },
      modules
    }]);
  }

  function toV12(registry, {
    extrinsic,
    modules
  }) {
    return registry.createTypeUnsafe('MetadataV12', [{
      extrinsic,
      modules: modules.map(mod => registry.createTypeUnsafe('ModuleMetadataV12', [util.objectSpread({}, mod, {
        index: 255
      })]))
    }]);
  }

  function toV13(registry, metadata) {
    return registry.createTypeUnsafe('MetadataV13', [metadata]);
  }

  const typesAlias = {
    assets: {
      Approval: 'AssetApproval',
      ApprovalKey: 'AssetApprovalKey',
      Balance: 'TAssetBalance',
      DestroyWitness: 'AssetDestroyWitness'
    },
    babe: {
      EquivocationProof: 'BabeEquivocationProof'
    },
    balances: {
      Status: 'BalanceStatus'
    },
    beefy: {
      AuthorityId: 'BeefyId'
    },
    contracts: {
      StorageKey: 'ContractStorageKey'
    },
    electionProviderMultiPhase: {
      Phase: 'ElectionPhase'
    },
    ethereum: {
      Block: 'EthBlock',
      Header: 'EthHeader',
      Receipt: 'EthReceipt',
      Transaction: 'EthTransaction',
      TransactionStatus: 'EthTransactionStatus'
    },
    evm: {
      Account: 'EvmAccount',
      Log: 'EvmLog',
      Vicinity: 'EvmVicinity'
    },
    grandpa: {
      Equivocation: 'GrandpaEquivocation',
      EquivocationProof: 'GrandpaEquivocationProof'
    },
    identity: {
      Judgement: 'IdentityJudgement'
    },
    inclusion: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    paraDisputes: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    paraInclusion: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    paraScheduler: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    paraShared: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    parachains: {
      Id: 'ParaId'
    },
    parasDisputes: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    parasInclusion: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    parasScheduler: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    parasShared: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    proposeParachain: {
      Proposal: 'ParachainProposal'
    },
    proxy: {
      Announcement: 'ProxyAnnouncement'
    },
    scheduler: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    shared: {
      ValidatorIndex: 'ParaValidatorIndex'
    },
    society: {
      Judgement: 'SocietyJudgement',
      Vote: 'SocietyVote'
    },
    staking: {
      Compact: 'CompactAssignments'
    },
    treasury: {
      Proposal: 'TreasuryProposal'
    },
    xcm: {
      AssetId: 'XcmAssetId'
    },
    xcmPallet: {
      AssetId: 'XcmAssetId'
    }
  };
  function getAliasTypes({
    knownTypes
  }, section) {
    var _knownTypes$typesAlia;
    return util.objectSpread({}, typesAlias[section], (_knownTypes$typesAlia = knownTypes.typesAlias) === null || _knownTypes$typesAlia === void 0 ? void 0 : _knownTypes$typesAlia[section]);
  }

  const BOXES = [['<', '>'], ['<', ','], [',', '>'], ['(', ')'], ['(', ','], [',', ','], [',', ')']];
  function compatType(specs, _type) {
    const type = _type.toString();
    const index = specs.findIndex(({
      def
    }) => def.HistoricMetaCompat === type);
    if (index !== -1) {
      return index;
    }
    return specs.push({
      def: {
        HistoricMetaCompat: type
      }
    }) - 1;
  }
  function compatTypes(specs, ...types) {
    for (let i = 0; i < types.length; i++) {
      compatType(specs, types[i]);
    }
  }
  function makeTupleType(specs, entries) {
    return specs.push({
      def: {
        Tuple: entries
      }
    }) - 1;
  }
  function makeVariantType(modName, variantType, specs, variants) {
    return specs.push({
      def: {
        Variant: {
          variants
        }
      },
      path: [`pallet_${modName.toString()}`, 'pallet', variantType]
    }) - 1;
  }
  function registerOriginCaller(registry, modules, metaVersion) {
    registry.register({
      OriginCaller: {
        _enum: modules.map((mod, index) => [mod.name.toString(), metaVersion >= 12 ? mod.index.toNumber() : index]).sort((a, b) => a[1] - b[1]).reduce((result, [name, index]) => {
          for (let i = Object.keys(result).length; i < index; i++) {
            result[`Empty${i}`] = 'Null';
          }
          result[name] = knownOrigins[name] || 'Null';
          return result;
        }, {})
      }
    });
  }
  function setTypeOverride(sectionTypes, types) {
    types.forEach(type => {
      const override = Object.keys(sectionTypes).find(aliased => type.eq(aliased));
      if (override) {
        type.setOverride(sectionTypes[override]);
      } else {
        const orig = type.toString();
        const alias = Object.entries(sectionTypes).reduce((result, [src, dst]) => BOXES.reduce((result, [a, z]) => result.replace(`${a}${src}${z}`, `${a}${dst}${z}`), result), orig);
        if (orig !== alias) {
          type.setOverride(alias);
        }
      }
    });
  }
  function convertCalls(specs, registry, modName, calls, sectionTypes) {
    const variants = calls.map(({
      args,
      docs,
      name
    }, index) => {
      setTypeOverride(sectionTypes, args.map(({
        type
      }) => type));
      return registry.createTypeUnsafe('SiVariant', [{
        docs,
        fields: args.map(({
          name,
          type
        }) => registry.createTypeUnsafe('SiField', [{
          name,
          type: compatType(specs, type)
        }])),
        index,
        name
      }]);
    });
    return registry.createTypeUnsafe('PalletCallMetadataV14', [{
      type: makeVariantType(modName, 'Call', specs, variants)
    }]);
  }
  function convertConstants(specs, registry, constants, sectionTypes) {
    return constants.map(({
      docs,
      name,
      type,
      value
    }) => {
      setTypeOverride(sectionTypes, [type]);
      return registry.createTypeUnsafe('PalletConstantMetadataV14', [{
        docs,
        name,
        type: compatType(specs, type),
        value
      }]);
    });
  }
  function convertErrors(specs, registry, modName, errors, _sectionTypes) {
    const variants = errors.map(({
      docs,
      name
    }, index) => registry.createTypeUnsafe('SiVariant', [{
      docs,
      fields: [],
      index,
      name
    }]));
    return registry.createTypeUnsafe('PalletErrorMetadataV14', [{
      type: makeVariantType(modName, 'Error', specs, variants)
    }]);
  }
  function convertEvents(specs, registry, modName, events, sectionTypes) {
    const variants = events.map(({
      args,
      docs,
      name
    }, index) => {
      setTypeOverride(sectionTypes, args);
      return registry.createTypeUnsafe('SiVariant', [{
        docs,
        fields: args.map(t => registry.createTypeUnsafe('SiField', [{
          type: compatType(specs, t)
        }])),
        index,
        name
      }]);
    });
    return registry.createTypeUnsafe('PalletEventMetadataV14', [{
      type: makeVariantType(modName, 'Event', specs, variants)
    }]);
  }
  function createMapEntry(specs, registry, sectionTypes, {
    hashers,
    isLinked,
    isOptional,
    keys,
    value
  }) {
    setTypeOverride(sectionTypes, [value, ...(Array.isArray(keys) ? keys : [keys])]);
    return registry.createTypeUnsafe('StorageEntryTypeV14', [{
      Map: {
        hashers,
        key: hashers.length === 1 ? compatType(specs, keys[0]) : makeTupleType(specs, keys.map(t => compatType(specs, t))),
        value: isLinked
        ? compatType(specs, `(${isOptional ? `Option<${value.toString()}>` : value.toString()}, Linkage<${keys[0].toString()}>)`) : compatType(specs, value)
      }
    }]);
  }
  function convertStorage(specs, registry, {
    items,
    prefix
  }, sectionTypes) {
    return registry.createTypeUnsafe('PalletStorageMetadataV14', [{
      items: items.map(({
        docs,
        fallback,
        modifier,
        name,
        type
      }) => {
        let entryType;
        if (type.isPlain) {
          const plain = type.asPlain;
          setTypeOverride(sectionTypes, [plain]);
          entryType = registry.createTypeUnsafe('StorageEntryTypeV14', [{
            Plain: compatType(specs, plain)
          }]);
        } else if (type.isMap) {
          const map = type.asMap;
          entryType = createMapEntry(specs, registry, sectionTypes, {
            hashers: [map.hasher],
            isLinked: map.linked.isTrue,
            isOptional: modifier.isOptional,
            keys: [map.key],
            value: map.value
          });
        } else if (type.isDoubleMap) {
          const dm = type.asDoubleMap;
          entryType = createMapEntry(specs, registry, sectionTypes, {
            hashers: [dm.hasher, dm.key2Hasher],
            isLinked: false,
            isOptional: modifier.isOptional,
            keys: [dm.key1, dm.key2],
            value: dm.value
          });
        } else {
          const nm = type.asNMap;
          entryType = createMapEntry(specs, registry, sectionTypes, {
            hashers: nm.hashers,
            isLinked: false,
            isOptional: modifier.isOptional,
            keys: nm.keyVec,
            value: nm.value
          });
        }
        return registry.createTypeUnsafe('StorageEntryMetadataV14', [{
          docs,
          fallback,
          modifier,
          name,
          type: entryType
        }]);
      }),
      prefix
    }]);
  }
  function convertExtrinsic(registry, {
    signedExtensions,
    version
  }) {
    return registry.createTypeUnsafe('ExtrinsicMetadataV14', [{
      signedExtensions: signedExtensions.map(identifier => ({
        identifier,
        type: 0
      })),
      type: 0,
      version
    }]);
  }
  function createPallet(specs, registry, mod, {
    calls,
    constants,
    errors,
    events,
    storage
  }) {
    const sectionTypes = getAliasTypes(registry, util.stringCamelCase(mod.name));
    return registry.createTypeUnsafe('PalletMetadataV14', [{
      calls: calls && convertCalls(specs, registry, mod.name, calls, sectionTypes),
      constants: convertConstants(specs, registry, constants, sectionTypes),
      errors: errors && convertErrors(specs, registry, mod.name, errors),
      events: events && convertEvents(specs, registry, mod.name, events, sectionTypes),
      index: mod.index,
      name: mod.name,
      storage: storage && convertStorage(specs, registry, storage, sectionTypes)
    }]);
  }
  function toV14(registry, v13, metaVersion) {
    const specs = [];
    compatTypes(specs, 'Null', 'u8', 'u16', 'u32', 'u64');
    registerOriginCaller(registry, v13.modules, metaVersion);
    const extrinsic = convertExtrinsic(registry, v13.extrinsic);
    const pallets = v13.modules.map(mod => createPallet(specs, registry, mod, {
      calls: mod.calls.unwrapOr(null),
      constants: mod.constants,
      errors: mod.errors.length ? mod.errors : null,
      events: mod.events.unwrapOr(null),
      storage: mod.storage.unwrapOr(null)
    }));
    return registry.createTypeUnsafe('MetadataV14', [{
      extrinsic,
      lookup: {
        types: specs.map((type, id) => registry.createTypeUnsafe('PortableType', [{
          id,
          type
        }]))
      },
      pallets
    }]);
  }

  function toLatest(registry, v14, _metaVersion) {
    return v14;
  }

  const MAGIC_NUMBER = 0x6174656d;
  class MagicNumber extends u32 {
    constructor(registry, value) {
      super(registry, value);
      if (!this.isEmpty && !this.eq(MAGIC_NUMBER)) {
        throw new Error(`MagicNumber mismatch: expected ${registry.createTypeUnsafe('u32', [MAGIC_NUMBER]).toHex()}, found ${this.toHex()}`);
      }
    }
  }

  const KNOWN_VERSIONS = [14, 13, 12, 11, 10, 9];
  const LATEST_VERSION = KNOWN_VERSIONS[0];
  class MetadataVersioned extends Struct {
    #converted = new Map();
    constructor(registry, value) {
      super(registry, {
        magicNumber: MagicNumber,
        metadata: 'MetadataAll'
      }, value);
    }
    #assertVersion = version => {
      if (this.version > version) {
        throw new Error(`Cannot convert metadata from version ${this.version} to ${version}`);
      }
      return this.version === version;
    };
    #getVersion = (version, fromPrev) => {
      const asCurr = `asV${version}`;
      const asPrev = version === 'latest' ? `asV${LATEST_VERSION}` : `asV${version - 1}`;
      if (version !== 'latest' && this.#assertVersion(version)) {
        return this.#metadata()[asCurr];
      }
      if (!this.#converted.has(version)) {
        this.#converted.set(version, fromPrev(this.registry, this[asPrev], this.version));
      }
      return this.#converted.get(version);
    };
    #metadata = () => {
      return this.getT('metadata');
    };
    get asCallsOnly() {
      return new MetadataVersioned(this.registry, {
        magicNumber: this.magicNumber,
        metadata: this.registry.createTypeUnsafe('MetadataAll', [toCallsOnly(this.registry, this.asLatest), LATEST_VERSION])
      });
    }
    get asV9() {
      this.#assertVersion(9);
      return this.#metadata().asV9;
    }
    get asV10() {
      return this.#getVersion(10, toV10);
    }
    get asV11() {
      return this.#getVersion(11, toV11);
    }
    get asV12() {
      return this.#getVersion(12, toV12);
    }
    get asV13() {
      return this.#getVersion(13, toV13);
    }
    get asV14() {
      return this.#getVersion(14, toV14);
    }
    get asLatest() {
      return this.#getVersion('latest', toLatest);
    }
    get magicNumber() {
      return this.getT('magicNumber');
    }
    get version() {
      return this.#metadata().index;
    }
    getUniqTypes(throwError) {
      return getUniqTypes(this.registry, this.asLatest, throwError);
    }
    toJSON() {
      this.asLatest;
      return super.toJSON();
    }
  }

  const EMPTY_METADATA = new Uint8Array([0x6d, 0x65, 0x74, 0x61, 9]);
  const VERSION_IDX = EMPTY_METADATA.length - 1;
  function decodeU8a(registry, u8a) {
    if (u8a.length === 0) {
      return EMPTY_METADATA;
    } else if (u8a[VERSION_IDX] === 9) {
      try {
        return new MetadataVersioned(registry, u8a);
      } catch (error) {
        u8a[VERSION_IDX] = 10;
        return u8a;
      }
    }
    return u8a;
  }
  class Metadata extends MetadataVersioned {
    constructor(registry, value) {
      super(registry, util.isU8a(value) || util.isString(value) ? decodeU8a(registry, util.u8aToU8a(value)) : value);
    }
  }

  function convert(fn) {
    return ({
      name
    }) => fn(name);
  }
  const objectNameToCamel = convert(util.stringCamelCase);
  const objectNameToString = convert(n => n.toString());

  function decorateConstants(registry, {
    pallets
  }, _version) {
    const result = {};
    for (let i = 0; i < pallets.length; i++) {
      const {
        constants,
        name
      } = pallets[i];
      if (!constants.isEmpty) {
        util.lazyMethod(result, util.stringCamelCase(name), () => util.lazyMethods({}, constants, constant => {
          const codec = registry.createTypeUnsafe(registry.createLookupType(constant.type), [util.hexToU8a(constant.value.toHex())]);
          codec.meta = constant;
          return codec;
        }, objectNameToCamel));
      }
    }
    return result;
  }

  function variantToMeta(lookup, variant) {
    return util.objectSpread({
      args: variant.fields.map(({
        type
      }) => lookup.getTypeDef(type).type)
    }, variant);
  }
  function decorateErrors(registry, {
    lookup,
    pallets
  }, version) {
    const result = {};
    for (let i = 0; i < pallets.length; i++) {
      const {
        errors,
        index,
        name
      } = pallets[i];
      if (errors.isSome) {
        const sectionIndex = version >= 12 ? index.toNumber() : i;
        util.lazyMethod(result, util.stringCamelCase(name), () => lazyVariants(lookup, errors.unwrap(), objectNameToString, variant => ({
          is: errorMod => util.isCodec(errorMod) && util.isCodec(errorMod.index) && errorMod.index.eq(sectionIndex) && (util.isU8a(errorMod.error) ? errorMod.error[0] === variant.index.toNumber() : util.isCodec(errorMod.error) && errorMod.error.eq(variant.index)),
          meta: registry.createTypeUnsafe('ErrorMetadataLatest', [variantToMeta(lookup, variant)])
        })));
      }
    }
    return result;
  }

  function filterEventsSome({
    events
  }) {
    return events.isSome;
  }
  function decorateEvents(registry, {
    lookup,
    pallets
  }, version) {
    const result = {};
    const filtered = pallets.filter(filterEventsSome);
    for (let i = 0; i < filtered.length; i++) {
      const {
        events,
        index,
        name
      } = filtered[i];
      const sectionIndex = version >= 12 ? index.toNumber() : i;
      util.lazyMethod(result, util.stringCamelCase(name), () => lazyVariants(lookup, events.unwrap(), objectNameToString, variant => ({
        is: eventRecord => util.isCodec(eventRecord) && util.isU8a(eventRecord.index) && sectionIndex === eventRecord.index[0] && variant.index.eq(eventRecord.index[1]),
        meta: registry.createTypeUnsafe('EventMetadataLatest', [variantToMeta(lookup, variant)])
      })));
    }
    return result;
  }

  function isTx(tx, callIndex) {
    return tx.callIndex[0] === callIndex[0] && tx.callIndex[1] === callIndex[1];
  }
  function createUnchecked(registry, section, callIndex, callMetadata) {
    const expectedArgs = callMetadata.fields;
    const funcName = util.stringCamelCase(callMetadata.name);
    const extrinsicFn = (...args) => {
      if (expectedArgs.length !== args.length) {
        throw new Error(`Extrinsic ${section}.${funcName} expects ${expectedArgs.length} arguments, got ${args.length}.`);
      }
      return registry.createTypeUnsafe('Call', [{
        args,
        callIndex
      }, callMetadata]);
    };
    extrinsicFn.is = tx => isTx(tx, callIndex);
    extrinsicFn.callIndex = callIndex;
    extrinsicFn.meta = callMetadata;
    extrinsicFn.method = funcName;
    extrinsicFn.section = section;
    extrinsicFn.toJSON = () => callMetadata.toJSON();
    return extrinsicFn;
  }

  function filterCallsSome({
    calls
  }) {
    return calls.isSome;
  }
  function createCallFunction(registry, lookup, variant, sectionName, sectionIndex) {
    const {
      fields,
      index
    } = variant;
    const args = new Array(fields.length);
    for (let a = 0; a < fields.length; a++) {
      const {
        name,
        type,
        typeName
      } = fields[a];
      args[a] = util.objectSpread({
        name: util.stringCamelCase(name.unwrapOr(`param${a}`)),
        type: getSiName(lookup, type)
      }, typeName.isSome ? {
        typeName: typeName.unwrap()
      } : null);
    }
    return createUnchecked(registry, sectionName, new Uint8Array([sectionIndex, index.toNumber()]), registry.createTypeUnsafe('FunctionMetadataLatest', [util.objectSpread({
      args
    }, variant)]));
  }
  function decorateExtrinsics(registry, {
    lookup,
    pallets
  }, version) {
    const result = {};
    const filtered = pallets.filter(filterCallsSome);
    for (let i = 0; i < filtered.length; i++) {
      const {
        calls,
        index,
        name
      } = filtered[i];
      const sectionName = util.stringCamelCase(name);
      const sectionIndex = version >= 12 ? index.toNumber() : i;
      util.lazyMethod(result, sectionName, () => lazyVariants(lookup, calls.unwrap(), objectNameToCamel, variant => createCallFunction(registry, lookup, variant, sectionName, sectionIndex)));
    }
    return result;
  }

  const DEFAULT_FN = data => utilCrypto.xxhashAsU8a(data, 128);
  const HASHERS = {
    Blake2_128: data =>
    utilCrypto.blake2AsU8a(data, 128),
    Blake2_128Concat: data =>
    util.u8aConcat(utilCrypto.blake2AsU8a(data, 128), util.u8aToU8a(data)),
    Blake2_256: data =>
    utilCrypto.blake2AsU8a(data, 256),
    Identity: data => util.u8aToU8a(data),
    Twox128: data => utilCrypto.xxhashAsU8a(data, 128),
    Twox256: data => utilCrypto.xxhashAsU8a(data, 256),
    Twox64Concat: data => util.u8aConcat(utilCrypto.xxhashAsU8a(data, 64), util.u8aToU8a(data))
  };
  function getHasher(hasher) {
    return HASHERS[hasher.type] || DEFAULT_FN;
  }

  const NO_RAW_ARGS = {
    args: [],
    hashers: [],
    keys: []
  };
  function assertArgs({
    method,
    section
  }, {
    args,
    keys
  }) {
    if (!Array.isArray(args)) {
      throw new Error(`Call to ${util.stringCamelCase(section || 'unknown')}.${util.stringCamelCase(method || 'unknown')} needs ${keys.length} arguments`);
    } else if (args.filter(filterDefined).length !== keys.length) {
      throw new Error(`Call to ${util.stringCamelCase(section || 'unknown')}.${util.stringCamelCase(method || 'unknown')} needs ${keys.length} arguments, found [${args.join(', ')}]`);
    }
  }
  function createKeyRawParts(registry, itemFn, {
    args,
    hashers,
    keys
  }) {
    const extra = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      extra[i] = getHasher(hashers[i])(registry.createTypeUnsafe(registry.createLookupType(keys[i]), [args[i]]).toU8a());
    }
    return [[utilCrypto.xxhashAsU8a(itemFn.prefix, 128), utilCrypto.xxhashAsU8a(itemFn.method, 128)], extra];
  }
  function createKeyInspect(registry, itemFn, args) {
    assertArgs(itemFn, args);
    const {
      meta
    } = itemFn;
    const [prefix, extra] = createKeyRawParts(registry, itemFn, args);
    let types = [];
    if (meta.type.isMap) {
      const {
        hashers,
        key
      } = meta.type.asMap;
      types = hashers.length === 1 ? [`${hashers[0].type}(${getSiName(registry.lookup, key)})`] : registry.lookup.getSiType(key).def.asTuple.map((k, i) => `${hashers[i].type}(${getSiName(registry.lookup, k)})`);
    }
    const names = ['module', 'method'].concat(...args.args.map((_, i) => types[i]));
    return {
      inner: prefix.concat(...extra).map((v, i) => ({
        name: names[i],
        outer: [v]
      }))
    };
  }
  function createKeyRaw(registry, itemFn, args) {
    const [prefix, extra] = createKeyRawParts(registry, itemFn, args);
    return util.u8aConcat(...prefix, ...extra);
  }
  function filterDefined(a) {
    return !util.isUndefined(a);
  }
  function createKey(registry, itemFn, args) {
    assertArgs(itemFn, args);
    return util.compactAddLength(createKeyRaw(registry, itemFn, args));
  }
  function createStorageInspect(registry, itemFn, options) {
    const {
      meta: {
        type
      }
    } = itemFn;
    return (...args) => {
      if (type.isPlain) {
        return options.skipHashing ? {
          inner: [],
          name: 'wellKnown',
          outer: [util.u8aToU8a(options.key)]
        } : createKeyInspect(registry, itemFn, NO_RAW_ARGS);
      }
      const {
        hashers,
        key
      } = type.asMap;
      return hashers.length === 1 ? createKeyInspect(registry, itemFn, {
        args,
        hashers,
        keys: [key]
      }) : createKeyInspect(registry, itemFn, {
        args,
        hashers,
        keys: registry.lookup.getSiType(key).def.asTuple
      });
    };
  }
  function createStorageFn(registry, itemFn, options) {
    const {
      meta: {
        type
      }
    } = itemFn;
    let cacheKey = null;
    return (...args) => {
      if (type.isPlain) {
        if (!cacheKey) {
          cacheKey = options.skipHashing ? util.compactAddLength(util.u8aToU8a(options.key)) : createKey(registry, itemFn, NO_RAW_ARGS);
        }
        return cacheKey;
      }
      const {
        hashers,
        key
      } = type.asMap;
      return hashers.length === 1 ? createKey(registry, itemFn, {
        args,
        hashers,
        keys: [key]
      }) : createKey(registry, itemFn, {
        args,
        hashers,
        keys: registry.lookup.getSiType(key).def.asTuple
      });
    };
  }
  function createWithMeta(registry, itemFn, options) {
    const {
      meta,
      method,
      prefix,
      section
    } = itemFn;
    const storageFn = createStorageFn(registry, itemFn, options);
    storageFn.inspect = createStorageInspect(registry, itemFn, options);
    storageFn.meta = meta;
    storageFn.method = util.stringCamelCase(method);
    storageFn.prefix = prefix;
    storageFn.section = section;
    storageFn.toJSON = () => util.objectSpread({
      storage: {
        method,
        prefix,
        section
      }
    }, meta.toJSON());
    return storageFn;
  }
  function extendHeadMeta(registry, {
    meta: {
      docs,
      name,
      type
    },
    section
  }, {
    method
  }, iterFn) {
    const meta = registry.createTypeUnsafe('StorageEntryMetadataLatest', [{
      docs,
      fallback: registry.createTypeUnsafe('Bytes', []),
      modifier: registry.createTypeUnsafe('StorageEntryModifierLatest', [1]),
      name,
      type: registry.createTypeUnsafe('StorageEntryTypeLatest', [type.asMap.key, 0])
    }]);
    iterFn.meta = meta;
    const fn = (...args) => registry.createTypeUnsafe('StorageKey', [iterFn(...args), {
      method,
      section
    }]);
    fn.meta = meta;
    return fn;
  }
  function extendPrefixedMap(registry, itemFn, storageFn) {
    const {
      meta: {
        type
      },
      method,
      section
    } = itemFn;
    storageFn.iterKey = extendHeadMeta(registry, itemFn, storageFn, (...args) => {
      if (args.length && (type.isPlain || args.length >= type.asMap.hashers.length)) {
        throw new Error(`Iteration of ${util.stringCamelCase(section || 'unknown')}.${util.stringCamelCase(method || 'unknown')} needs arguments to be at least one less than the full arguments, found [${args.join(', ')}]`);
      }
      if (args.length) {
        if (type.isMap) {
          const {
            hashers,
            key
          } = type.asMap;
          const keysVec = hashers.length === 1 ? [key] : registry.lookup.getSiType(key).def.asTuple;
          return new Raw(registry, createKeyRaw(registry, itemFn, {
            args,
            hashers: hashers.slice(0, args.length),
            keys: keysVec.slice(0, args.length)
          }));
        }
      }
      return new Raw(registry, createKeyRaw(registry, itemFn, NO_RAW_ARGS));
    });
    return storageFn;
  }
  function createFunction(registry, itemFn, options) {
    const {
      meta: {
        type
      }
    } = itemFn;
    const storageFn = createWithMeta(registry, itemFn, options);
    if (type.isMap) {
      extendPrefixedMap(registry, itemFn, storageFn);
    }
    storageFn.keyPrefix = (...args) => storageFn.iterKey && storageFn.iterKey(...args) || util.compactStripLength(storageFn())[1];
    return storageFn;
  }

  function findSiPrimitive(registry, _prim) {
    const prim = _prim.toLowerCase();
    return registry.lookup.types.find(t => t.type.def.isPrimitive && t.type.def.asPrimitive.toString().toLowerCase() === prim || t.type.def.isHistoricMetaCompat && t.type.def.asHistoricMetaCompat.toString().toLowerCase() === prim);
  }
  function findSiType(registry, orig) {
    let portable = findSiPrimitive(registry, orig);
    if (!portable && orig === 'Bytes') {
      const u8 = findSiPrimitive(registry, 'u8');
      if (u8) {
        portable = registry.lookup.types.find(t => t.type.def.isSequence && t.type.def.asSequence.type.eq(u8.id) || t.type.def.isHistoricMetaCompat && t.type.def.asHistoricMetaCompat.eq(orig));
      }
    }
    if (!portable) {
      console.warn(`Unable to map ${orig} to a lookup index`);
    }
    return portable;
  }
  function createRuntimeFunction({
    method,
    prefix,
    section
  }, key, {
    docs,
    type
  }) {
    return registry => {
      var _findSiType;
      return createFunction(registry, {
        meta: registry.createTypeUnsafe('StorageEntryMetadataLatest', [{
          docs: registry.createTypeUnsafe('Vec<Text>', [[docs]]),
          modifier: registry.createTypeUnsafe('StorageEntryModifierLatest', ['Required']),
          name: registry.createTypeUnsafe('Text', [method]),
          toJSON: () => key,
          type: registry.createTypeUnsafe('StorageEntryTypeLatest', [{
            Plain: ((_findSiType = findSiType(registry, type)) === null || _findSiType === void 0 ? void 0 : _findSiType.id) || 0
          }])
        }]),
        method,
        prefix,
        section
      }, {
        key,
        skipHashing: true
      });
    };
  }

  const prefix = 'Substrate';
  const section = 'substrate';
  function createSubstrateFn(method, key, meta) {
    return createRuntimeFunction({
      method,
      prefix,
      section
    }, key, meta);
  }
  const substrate = {
    changesTrieConfig: createSubstrateFn('changesTrieConfig', ':changes_trie', {
      docs: 'Changes trie configuration is stored under this key.',
      type: 'u32'
    }),
    childStorageKeyPrefix: createSubstrateFn('childStorageKeyPrefix', ':child_storage:', {
      docs: 'Prefix of child storage keys.',
      type: 'u32'
    }),
    code: createSubstrateFn('code', ':code', {
      docs: 'Wasm code of the runtime.',
      type: 'Bytes'
    }),
    extrinsicIndex: createSubstrateFn('extrinsicIndex', ':extrinsic_index', {
      docs: 'Current extrinsic index (u32) is stored under this key.',
      type: 'u32'
    }),
    heapPages: createSubstrateFn('heapPages', ':heappages', {
      docs: 'Number of wasm linear memory pages required for execution of the runtime.',
      type: 'u64'
    })
  };

  function getStorage(registry) {
    const storage = {};
    const entries = Object.entries(substrate);
    for (let e = 0; e < entries.length; e++) {
      storage[entries[e][0]] = entries[e][1](registry);
    }
    return {
      substrate: storage
    };
  }

  const VERSION_NAME = 'palletVersion';
  const VERSION_KEY = ':__STORAGE_VERSION__:';
  const VERSION_DOCS = {
    docs: 'Returns the current pallet version from storage',
    type: 'u16'
  };
  function decorateStorage(registry, {
    pallets
  }, _metaVersion) {
    const result = getStorage(registry);
    for (let i = 0; i < pallets.length; i++) {
      const {
        name,
        storage
      } = pallets[i];
      if (storage.isSome) {
        const section = util.stringCamelCase(name);
        const {
          items,
          prefix: _prefix
        } = storage.unwrap();
        const prefix = _prefix.toString();
        util.lazyMethod(result, section, () => util.lazyMethods({
          palletVersion: createRuntimeFunction({
            method: VERSION_NAME,
            prefix,
            section
          }, createKeyRaw(registry, {
            method: VERSION_KEY,
            prefix: name.toString()
          }, NO_RAW_ARGS), VERSION_DOCS)(registry)
        }, items, meta => createFunction(registry, {
          meta,
          method: meta.name.toString(),
          prefix,
          section
        }, {}), objectNameToCamel));
      }
    }
    return result;
  }

  function expandMetadata(registry, metadata) {
    if (!(metadata instanceof Metadata)) {
      throw new Error('You need to pass a valid Metadata instance to Decorated');
    }
    const latest = metadata.asLatest;
    const version = metadata.version;
    return {
      consts: decorateConstants(registry, latest),
      errors: decorateErrors(registry, latest, version),
      events: decorateEvents(registry, latest, version),
      query: decorateStorage(registry, latest),
      registry,
      tx: decorateExtrinsics(registry, latest, version)
    };
  }

  function _classPrivateFieldBase(receiver, privateKey) {
    if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
      throw new TypeError("attempted to use private field on non-instance");
    }
    return receiver;
  }

  var id = 0;
  function _classPrivateFieldKey(name) {
    return "__private_" + id++ + "_" + name;
  }

  const l$1 = util.logger('PortableRegistry');
  const TYPE_UNWRAP = {
    toNumber: () => -1
  };
  const PRIMITIVE_ALIAS = {
    Char: 'u32',
    Str: 'Text'
  };
  const PATHS_ALIAS = splitNamespace([
  'sp_core::crypto::AccountId32', 'sp_runtime::generic::era::Era', 'sp_runtime::multiaddress::MultiAddress',
  'frame_support::weights::weight_v2::Weight', 'sp_weights::weight_v2::Weight',
  'account::AccountId20', 'polkadot_runtime_common::claims::EthereumAddress',
  '*_democracy::vote::Vote', '*_conviction_voting::vote::Vote', '*_identity::types::Data',
  'sp_core::OpaqueMetadata', 'sp_core::OpaquePeerId', 'sp_core::offchain::OpaqueMultiaddr',
  'primitive_types::*', 'sp_arithmetic::per_things::*',
  'ink_env::types::*']);
  const PATHS_SET = splitNamespace(['pallet_identity::types::BitFlags']);
  const BITVEC_NS_LSB = ['bitvec::order::Lsb0', 'BitOrderLsb0'];
  const BITVEC_NS_MSB = ['bitvec::order::Msb0', 'BitOrderMsb0'];
  const BITVEC_NS = [...BITVEC_NS_LSB, ...BITVEC_NS_MSB];
  const WRAPPERS = ['BoundedBTreeMap', 'BoundedBTreeSet', 'BoundedVec', 'Box', 'BTreeMap', 'BTreeSet', 'Cow', 'Option', 'Range', 'RangeInclusive', 'Result', 'WeakBoundedVec', 'WrapperKeepOpaque', 'WrapperOpaque'];
  const RESERVED = ['entries', 'hash', 'keys', 'new', 'size'];
  const PATH_RM_INDEX_1 = ['generic', 'misc', 'pallet', 'traits', 'types'];
  function sanitizeDocs(docs) {
    const result = new Array(docs.length);
    for (let i = 0; i < docs.length; i++) {
      result[i] = docs[i].toString();
    }
    return result;
  }
  function splitNamespace(values) {
    const result = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      result[i] = values[i].split('::');
    }
    return result;
  }
  function matchParts(first, second) {
    return first.length === second.length && first.every((a, index) => {
      const b = second[index].toString();
      if (a === '*' || a === b) {
        return true;
      }
      if (a.includes('*') && a.includes('_') && b.includes('_')) {
        let suba = a.split('_');
        let subb = b.split('_');
        if (suba[0] === '*') {
          const indexOf = subb.indexOf(suba[1]);
          if (indexOf !== -1) {
            suba = suba.slice(1);
            subb = subb.slice(indexOf);
          }
        }
        if (suba.length === 2 && suba[1] === '*' && suba[0] === subb[0]) {
          return true;
        }
        return matchParts(suba, subb);
      }
      return false;
    });
  }
  function getAliasPath(path) {
    return path.length && PATHS_ALIAS.some(a => matchParts(a, path)) ? path[path.length - 1].toString() : null;
  }
  function extractNameFlat(portable, lookupIndex, params, path, isInternal = false) {
    const count = path.length;
    if (count === 0 || WRAPPERS.includes(path[count - 1].toString())) {
      return null;
    }
    const camels = new Array(count);
    const lowers = new Array(count);
    for (let i = 0; i < count; i++) {
      const c = util.stringPascalCase(isInternal ? path[i].replace('pallet_', '') : path[i]);
      const l = c.toLowerCase();
      camels[i] = c;
      lowers[i] = l;
    }
    let name = '';
    for (let i = 0; i < count; i++) {
      const l = lowers[i];
      if (i !== 1 || !PATH_RM_INDEX_1.includes(l)) {
        if (l !== lowers[i + 1]) {
          name += camels[i];
        }
      }
    }
    if (camels[1] === 'RawOrigin' && count === 2 && params.length === 2 && params[1].type.isSome) {
      const instanceType = portable[params[1].type.unwrap().toNumber()];
      if (instanceType.type.path.length === 2) {
        name = `${name}${instanceType.type.path[1].toString()}`;
      }
    }
    return {
      lookupIndex,
      name,
      params
    };
  }
  function extractName(portable, lookupIndex, {
    type: {
      params,
      path
    }
  }) {
    return extractNameFlat(portable, lookupIndex, params, path);
  }
  function nextDupeMatches(name, startAt, names) {
    const result = [names[startAt]];
    for (let i = startAt + 1; i < names.length; i++) {
      const v = names[i];
      if (v.name === name) {
        result.push(v);
      }
    }
    return result;
  }
  function rewriteDupes(input, rewrite) {
    const count = input.length;
    for (let i = 0; i < count; i++) {
      const a = input[i];
      for (let j = i + 1; j < count; j++) {
        const b = input[j];
        if (a.lookupIndex !== b.lookupIndex && a.name === b.name) {
          return false;
        }
      }
    }
    for (let i = 0; i < count; i++) {
      const p = input[i];
      rewrite[p.lookupIndex] = p.name;
    }
    return true;
  }
  function removeDupeNames(lookup, portable, names) {
    const rewrite = {};
    return names.map((original, startAt) => {
      const {
        lookupIndex,
        name,
        params
      } = original;
      if (!name) {
        return null;
      } else if (rewrite[lookupIndex]) {
        return original;
      }
      const allSame = nextDupeMatches(name, startAt, names);
      if (allSame.length === 1) {
        return original;
      }
      const anyDiff = allSame.some(o => params.length !== o.params.length || params.some((p, index) => !p.name.eq(o.params[index].name) || p.type.unwrapOr(TYPE_UNWRAP).toNumber() !== o.params[index].type.unwrapOr(TYPE_UNWRAP).toNumber()));
      if (!anyDiff) {
        return original;
      }
      const paramIdx = params.findIndex(({
        type
      }, index) => allSame.every(({
        params
      }, aIndex) => params[index].type.isSome && (aIndex === 0 || !params[index].type.eq(type))));
      if (paramIdx === -1) {
        return original;
      }
      const adjusted = new Array(allSame.length);
      for (let i = 0; i < allSame.length; i++) {
        const {
          lookupIndex,
          name,
          params
        } = allSame[i];
        const {
          def,
          path
        } = lookup.getSiType(params[paramIdx].type.unwrap());
        if (!def.isPrimitive && !path.length) {
          return null;
        }
        adjusted[i] = {
          lookupIndex,
          name: def.isPrimitive ? `${name}${def.asPrimitive.toString()}` : `${name}${path[path.length - 1].toString()}`
        };
      }
      if (rewriteDupes(adjusted, rewrite)) {
        return original;
      }
      for (let i = 0; i < allSame.length; i++) {
        const {
          lookupIndex,
          name,
          params
        } = allSame[i];
        const {
          def,
          path
        } = lookup.getSiType(params[paramIdx].type.unwrap());
        const flat = extractNameFlat(portable, lookupIndex, params, path, true);
        if (def.isPrimitive || !flat) {
          return null;
        }
        adjusted[i] = {
          lookupIndex,
          name: `${name}${flat.name}`
        };
      }
      if (rewriteDupes(adjusted, rewrite)) {
        return original;
      }
      return null;
    }).filter(n => !!n).map(({
      lookupIndex,
      name,
      params
    }) => ({
      lookupIndex,
      name: rewrite[lookupIndex] || name,
      params
    }));
  }
  function registerTypes(lookup, lookups, names, params) {
    lookup.registry.register(lookups);
    if (params.SpRuntimeUncheckedExtrinsic) {
      const [addrParam,, sigParam] = params.SpRuntimeUncheckedExtrinsic;
      const siAddress = lookup.getSiType(addrParam.type.unwrap());
      const siSignature = lookup.getSiType(sigParam.type.unwrap());
      const nsSignature = siSignature.path.join('::');
      let nsAccountId = siAddress.path.join('::');
      const isMultiAddress = nsAccountId === 'sp_runtime::multiaddress::MultiAddress';
      if (isMultiAddress) {
        const [idParam] = siAddress.params;
        nsAccountId = lookup.getSiType(idParam.type.unwrap()).path.join('::');
      }
      lookup.registry.register({
        AccountId: ['sp_core::crypto::AccountId32'].includes(nsAccountId) ? 'AccountId32' : ['account::AccountId20', 'primitive_types::H160'].includes(nsAccountId) ? 'AccountId20' : 'AccountId32',
        Address: isMultiAddress ? 'MultiAddress' : 'AccountId',
        ExtrinsicSignature: ['sp_runtime::MultiSignature'].includes(nsSignature) ? 'MultiSignature' : names[sigParam.type.unwrap().toNumber()] || 'MultiSignature'
      });
    }
  }
  function extractAliases(params, isContract) {
    const hasParams = Object.keys(params).some(k => !k.startsWith('Pallet'));
    const alias = {};
    if (params.SpRuntimeUncheckedExtrinsic) {
      const [, {
        type
      }] = params.SpRuntimeUncheckedExtrinsic;
      alias[type.unwrap().toNumber()] = 'Call';
    } else if (hasParams && !isContract) {
      l$1.warn('Unable to determine runtime Call type, cannot inspect sp_runtime::generic::unchecked_extrinsic::UncheckedExtrinsic');
    }
    if (params.FrameSystemEventRecord) {
      const [{
        type
      }] = params.FrameSystemEventRecord;
      alias[type.unwrap().toNumber()] = 'Event';
    } else if (hasParams && !isContract) {
      l$1.warn('Unable to determine runtime Event type, cannot inspect frame_system::EventRecord');
    }
    return alias;
  }
  function extractTypeInfo(lookup, portable) {
    const nameInfo = [];
    const types = {};
    const porCount = portable.length;
    for (let i = 0; i < porCount; i++) {
      const type = portable[i];
      const lookupIndex = type.id.toNumber();
      const extracted = extractName(portable, lookupIndex, portable[i]);
      if (extracted) {
        nameInfo.push(extracted);
      }
      types[lookupIndex] = type;
    }
    const lookups = {};
    const names = {};
    const params = {};
    const dedup = removeDupeNames(lookup, portable, nameInfo);
    const dedupCount = dedup.length;
    for (let i = 0; i < dedupCount; i++) {
      const {
        lookupIndex,
        name,
        params: p
      } = dedup[i];
      names[lookupIndex] = name;
      lookups[name] = lookup.registry.createLookupType(lookupIndex);
      params[name] = p;
    }
    return {
      lookups,
      names,
      params,
      types
    };
  }
  var _alias = _classPrivateFieldKey("alias");
  var _lookups = _classPrivateFieldKey("lookups");
  var _names = _classPrivateFieldKey("names");
  var _params = _classPrivateFieldKey("params");
  var _typeDefs = _classPrivateFieldKey("typeDefs");
  var _types = _classPrivateFieldKey("types");
  var _createSiDef = _classPrivateFieldKey("createSiDef");
  var _getLookupId = _classPrivateFieldKey("getLookupId");
  var _extract = _classPrivateFieldKey("extract");
  var _extractArray = _classPrivateFieldKey("extractArray");
  var _extractBitSequence = _classPrivateFieldKey("extractBitSequence");
  var _extractCompact = _classPrivateFieldKey("extractCompact");
  var _extractComposite = _classPrivateFieldKey("extractComposite");
  var _extractCompositeSet = _classPrivateFieldKey("extractCompositeSet");
  var _extractFields = _classPrivateFieldKey("extractFields");
  var _extractFieldsAlias = _classPrivateFieldKey("extractFieldsAlias");
  var _extractHistoric = _classPrivateFieldKey("extractHistoric");
  var _extractPrimitive = _classPrivateFieldKey("extractPrimitive");
  var _extractAliasPath = _classPrivateFieldKey("extractAliasPath");
  var _extractSequence = _classPrivateFieldKey("extractSequence");
  var _extractTuple = _classPrivateFieldKey("extractTuple");
  var _extractVariant = _classPrivateFieldKey("extractVariant");
  var _extractVariantEnum = _classPrivateFieldKey("extractVariantEnum");
  class PortableRegistry extends Struct {
    constructor(registry, value, isContract) {
      super(registry, {
        types: 'Vec<PortableType>'
      }, value);
      Object.defineProperty(this, _extractVariantEnum, {
        value: _extractVariantEnum2
      });
      Object.defineProperty(this, _extractVariant, {
        value: _extractVariant2
      });
      Object.defineProperty(this, _extractTuple, {
        value: _extractTuple2
      });
      Object.defineProperty(this, _extractSequence, {
        value: _extractSequence2
      });
      Object.defineProperty(this, _extractAliasPath, {
        value: _extractAliasPath2
      });
      Object.defineProperty(this, _extractPrimitive, {
        value: _extractPrimitive2
      });
      Object.defineProperty(this, _extractHistoric, {
        value: _extractHistoric2
      });
      Object.defineProperty(this, _extractFieldsAlias, {
        value: _extractFieldsAlias2
      });
      Object.defineProperty(this, _extractFields, {
        value: _extractFields2
      });
      Object.defineProperty(this, _extractCompositeSet, {
        value: _extractCompositeSet2
      });
      Object.defineProperty(this, _extractComposite, {
        value: _extractComposite2
      });
      Object.defineProperty(this, _extractCompact, {
        value: _extractCompact2
      });
      Object.defineProperty(this, _extractBitSequence, {
        value: _extractBitSequence2
      });
      Object.defineProperty(this, _extractArray, {
        value: _extractArray2
      });
      Object.defineProperty(this, _extract, {
        value: _extract2
      });
      Object.defineProperty(this, _getLookupId, {
        value: _getLookupId2
      });
      Object.defineProperty(this, _createSiDef, {
        value: _createSiDef2
      });
      Object.defineProperty(this, _alias, {
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, _lookups, {
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, _names, {
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, _params, {
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, _typeDefs, {
        writable: true,
        value: {}
      });
      Object.defineProperty(this, _types, {
        writable: true,
        value: void 0
      });
      const {
        lookups,
        names,
        params: _params2,
        types
      } = extractTypeInfo(this, this.types);
      _classPrivateFieldBase(this, _alias)[_alias] = extractAliases(_params2, isContract);
      _classPrivateFieldBase(this, _lookups)[_lookups] = lookups;
      _classPrivateFieldBase(this, _names)[_names] = names;
      _classPrivateFieldBase(this, _params)[_params] = _params2;
      _classPrivateFieldBase(this, _types)[_types] = types;
    }
    get names() {
      return Object.values(_classPrivateFieldBase(this, _names)[_names]).sort();
    }
    get types() {
      return this.getT('types');
    }
    register() {
      registerTypes(this, _classPrivateFieldBase(this, _lookups)[_lookups], _classPrivateFieldBase(this, _names)[_names], _classPrivateFieldBase(this, _params)[_params]);
    }
    getName(lookupId) {
      return _classPrivateFieldBase(this, _names)[_names][_classPrivateFieldBase(this, _getLookupId)[_getLookupId](lookupId)];
    }
    getSiType(lookupId) {
      const found = (_classPrivateFieldBase(this, _types)[_types] || this.types)[_classPrivateFieldBase(this, _getLookupId)[_getLookupId](lookupId)];
      if (!found) {
        throw new Error(`PortableRegistry: Unable to find type with lookupId ${lookupId.toString()}`);
      }
      return found.type;
    }
    getTypeDef(lookupId) {
      const lookupIndex = _classPrivateFieldBase(this, _getLookupId)[_getLookupId](lookupId);
      if (!_classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex]) {
        const lookupName = _classPrivateFieldBase(this, _names)[_names][lookupIndex];
        const empty = {
          info: exports.TypeDefInfo.DoNotConstruct,
          lookupIndex,
          lookupName,
          type: this.registry.createLookupType(lookupIndex)
        };
        if (lookupName) {
          _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex] = empty;
        }
        const extracted = _classPrivateFieldBase(this, _extract)[_extract](this.getSiType(lookupId), lookupIndex);
        if (!lookupName) {
          _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex] = empty;
        }
        Object.keys(extracted).forEach(k => {
          if (k !== 'lookupName' || extracted[k]) {
            _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex][k] = extracted[k];
          }
        });
        if (extracted.info === exports.TypeDefInfo.Plain) {
          _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex].lookupNameRoot = _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex].lookupName;
          delete _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex].lookupName;
        }
      }
      return _classPrivateFieldBase(this, _typeDefs)[_typeDefs][lookupIndex];
    }
    sanitizeField(name) {
      let nameField = null;
      let nameOrig = null;
      if (name.isSome) {
        nameField = util.stringCamelCase(name.unwrap());
        if (nameField.includes('#')) {
          nameOrig = nameField;
          nameField = nameOrig.replace(/#/g, '_');
        } else if (RESERVED.includes(nameField)) {
          nameOrig = nameField;
          nameField = `${nameField}_`;
        }
      }
      return [nameField, nameOrig];
    }
  }
  function _createSiDef2(lookupId) {
    const typeDef = this.getTypeDef(lookupId);
    const lookupIndex = lookupId.toNumber();
    return [exports.TypeDefInfo.DoNotConstruct, exports.TypeDefInfo.Enum, exports.TypeDefInfo.Struct].includes(typeDef.info) && typeDef.lookupName ? {
      docs: typeDef.docs,
      info: exports.TypeDefInfo.Si,
      lookupIndex,
      lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex],
      type: this.registry.createLookupType(lookupId)
    } : typeDef;
  }
  function _getLookupId2(lookupId) {
    if (util.isString(lookupId)) {
      if (!this.registry.isLookupType(lookupId)) {
        throw new Error(`PortableRegistry: Expected a lookup string type, found ${lookupId}`);
      }
      return parseInt(lookupId.replace('Lookup', ''), 10);
    } else if (util.isNumber(lookupId)) {
      return lookupId;
    }
    return lookupId.toNumber();
  }
  function _extract2(type, lookupIndex) {
    const namespace = type.path.join('::');
    let typeDef;
    const aliasType = _classPrivateFieldBase(this, _alias)[_alias][lookupIndex] || getAliasPath(type.path);
    try {
      if (aliasType) {
        typeDef = _classPrivateFieldBase(this, _extractAliasPath)[_extractAliasPath](lookupIndex, aliasType);
      } else {
        switch (type.def.type) {
          case 'Array':
            typeDef = _classPrivateFieldBase(this, _extractArray)[_extractArray](lookupIndex, type.def.asArray);
            break;
          case 'BitSequence':
            typeDef = _classPrivateFieldBase(this, _extractBitSequence)[_extractBitSequence](lookupIndex, type.def.asBitSequence);
            break;
          case 'Compact':
            typeDef = _classPrivateFieldBase(this, _extractCompact)[_extractCompact](lookupIndex, type.def.asCompact);
            break;
          case 'Composite':
            typeDef = _classPrivateFieldBase(this, _extractComposite)[_extractComposite](lookupIndex, type, type.def.asComposite);
            break;
          case 'HistoricMetaCompat':
            typeDef = _classPrivateFieldBase(this, _extractHistoric)[_extractHistoric](lookupIndex, type.def.asHistoricMetaCompat);
            break;
          case 'Primitive':
            typeDef = _classPrivateFieldBase(this, _extractPrimitive)[_extractPrimitive](lookupIndex, type);
            break;
          case 'Sequence':
            typeDef = _classPrivateFieldBase(this, _extractSequence)[_extractSequence](lookupIndex, type.def.asSequence);
            break;
          case 'Tuple':
            typeDef = _classPrivateFieldBase(this, _extractTuple)[_extractTuple](lookupIndex, type.def.asTuple);
            break;
          case 'Variant':
            typeDef = _classPrivateFieldBase(this, _extractVariant)[_extractVariant](lookupIndex, type, type.def.asVariant);
            break;
          default:
            util.assertUnreachable(type.def.type);
        }
      }
    } catch (error) {
      throw new Error(`PortableRegistry: ${lookupIndex}${namespace ? ` (${namespace})` : ''}: Error extracting ${util.stringify(type)}: ${error.message}`);
    }
    return util.objectSpread({
      docs: sanitizeDocs(type.docs),
      namespace
    }, typeDef);
  }
  function _extractArray2(_, {
    len,
    type
  }) {
    const length = len.toNumber();
    if (length > 2048) {
      throw new Error('Only support for [Type; <length>], where length <= 2048');
    }
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.VecFixed,
      length,
      sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type)
    });
  }
  function _extractBitSequence2(_, {
    bitOrderType,
    bitStoreType
  }) {
    const a = _classPrivateFieldBase(this, _createSiDef)[_createSiDef](bitOrderType);
    const b = _classPrivateFieldBase(this, _createSiDef)[_createSiDef](bitStoreType);
    const [bitOrder, bitStore] = BITVEC_NS.includes(a.namespace || '') ? [a, b] : [b, a];
    if (!BITVEC_NS.includes(bitOrder.namespace || '')) {
      throw new Error(`Unexpected bitOrder found as ${bitOrder.namespace || '<unknown>'}`);
    } else if (bitStore.info !== exports.TypeDefInfo.Plain || bitStore.type !== 'u8') {
      throw new Error(`Only u8 bitStore is currently supported, found ${bitStore.type}`);
    }
    return {
      info: exports.TypeDefInfo.Plain,
      type: 'BitVec'
    };
  }
  function _extractCompact2(_, {
    type
  }) {
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.Compact,
      sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type)
    });
  }
  function _extractComposite2(lookupIndex, {
    params,
    path
  }, {
    fields
  }) {
    if (path.length) {
      const pathFirst = path[0].toString();
      const pathLast = path[path.length - 1].toString();
      if (path.length === 1 && pathFirst === 'BTreeMap') {
        if (params.length !== 2) {
          throw new Error(`BTreeMap requires 2 parameters, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: exports.TypeDefInfo.BTreeMap,
          sub: params.map(({
            type
          }) => _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type.unwrap()))
        });
      } else if (path.length === 1 && pathFirst === 'BTreeSet') {
        if (params.length !== 1) {
          throw new Error(`BTreeSet requires 1 parameter, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: exports.TypeDefInfo.BTreeSet,
          sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](params[0].type.unwrap())
        });
      } else if (['Range', 'RangeInclusive'].includes(pathFirst)) {
        if (params.length !== 1) {
          throw new Error(`Range requires 1 parameter, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: pathFirst === 'Range' ? exports.TypeDefInfo.Range : exports.TypeDefInfo.RangeInclusive,
          sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](params[0].type.unwrap()),
          type: pathFirst
        });
      } else if (['WrapperKeepOpaque', 'WrapperOpaque'].includes(pathLast)) {
        if (params.length !== 1) {
          throw new Error(`WrapperOpaque requires 1 parameter, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: pathLast === 'WrapperKeepOpaque' ? exports.TypeDefInfo.WrapperKeepOpaque : exports.TypeDefInfo.WrapperOpaque,
          sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](params[0].type.unwrap()),
          type: pathLast
        });
      }
    }
    return PATHS_SET.some(p => matchParts(p, path)) ? _classPrivateFieldBase(this, _extractCompositeSet)[_extractCompositeSet](lookupIndex, params, fields) : _classPrivateFieldBase(this, _extractFields)[_extractFields](lookupIndex, fields);
  }
  function _extractCompositeSet2(_, params, fields) {
    if (params.length !== 1 || fields.length !== 1) {
      throw new Error('Set handling expects param/field as single entries');
    }
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.Set,
      length: this.registry.createTypeUnsafe(this.registry.createLookupType(fields[0].type), []).bitLength(),
      sub: this.getSiType(params[0].type.unwrap()).def.asVariant.variants.map(({
        index,
        name
      }) => ({
        index: index.toNumber(),
        info: exports.TypeDefInfo.Plain,
        name: name.toString(),
        type: 'Null'
      }))
    });
  }
  function _extractFields2(lookupIndex, fields) {
    let isStruct = true;
    let isTuple = true;
    for (let f = 0; f < fields.length; f++) {
      const {
        name
      } = fields[f];
      isStruct = isStruct && name.isSome;
      isTuple = isTuple && name.isNone;
    }
    if (!isTuple && !isStruct) {
      throw new Error('Invalid fields type detected, expected either Tuple (all unnamed) or Struct (all named)');
    }
    if (fields.length === 0) {
      return {
        info: exports.TypeDefInfo.Null,
        type: 'Null'
      };
    } else if (isTuple && fields.length === 1) {
      const typeDef = _classPrivateFieldBase(this, _createSiDef)[_createSiDef](fields[0].type);
      return util.objectSpread({}, typeDef, lookupIndex === -1 ? null : {
        lookupIndex,
        lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex],
        lookupNameRoot: typeDef.lookupName
      }, fields[0].typeName.isSome ? {
        typeName: sanitize(fields[0].typeName.unwrap())
      } : null);
    }
    const [sub, alias] = _classPrivateFieldBase(this, _extractFieldsAlias)[_extractFieldsAlias](fields);
    return withTypeString(this.registry, util.objectSpread({
      info: isTuple
      ? exports.TypeDefInfo.Tuple : exports.TypeDefInfo.Struct,
      sub
    }, alias.size ? {
      alias
    } : null, lookupIndex === -1 ? null : {
      lookupIndex,
      lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex]
    }));
  }
  function _extractFieldsAlias2(fields) {
    const alias = new Map();
    const sub = new Array(fields.length);
    for (let i = 0; i < fields.length; i++) {
      const {
        docs,
        name,
        type,
        typeName
      } = fields[i];
      const typeDef = _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type);
      if (name.isNone) {
        sub[i] = typeDef;
      } else {
        const [nameField, nameOrig] = this.sanitizeField(name);
        if (nameField && nameOrig) {
          alias.set(nameField, nameOrig);
        }
        sub[i] = util.objectSpread({
          docs: sanitizeDocs(docs),
          name: nameField
        }, typeDef, typeName.isSome ? {
          typeName: sanitize(typeName.unwrap())
        } : null);
      }
    }
    return [sub, alias];
  }
  function _extractHistoric2(_, type) {
    return util.objectSpread({
      displayName: type.toString(),
      isFromSi: true
    }, getTypeDef(type));
  }
  function _extractPrimitive2(_, type) {
    const typeStr = type.def.asPrimitive.type.toString();
    return {
      info: exports.TypeDefInfo.Plain,
      type: PRIMITIVE_ALIAS[typeStr] || typeStr.toLowerCase()
    };
  }
  function _extractAliasPath2(_, type) {
    return {
      info: exports.TypeDefInfo.Plain,
      type
    };
  }
  function _extractSequence2(lookupIndex, {
    type
  }) {
    const sub = _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type);
    if (sub.type === 'u8') {
      return {
        info: exports.TypeDefInfo.Plain,
        type: 'Bytes'
      };
    }
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.Vec,
      lookupIndex,
      lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex],
      sub
    });
  }
  function _extractTuple2(lookupIndex, ids) {
    if (ids.length === 0) {
      return {
        info: exports.TypeDefInfo.Null,
        type: 'Null'
      };
    } else if (ids.length === 1) {
      return this.getTypeDef(ids[0]);
    }
    const sub = ids.map(t => _classPrivateFieldBase(this, _createSiDef)[_createSiDef](t));
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.Tuple,
      lookupIndex,
      lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex],
      sub
    });
  }
  function _extractVariant2(lookupIndex, {
    params,
    path
  }, {
    variants
  }) {
    if (path.length) {
      const specialVariant = path[0].toString();
      if (specialVariant === 'Option') {
        if (params.length !== 1) {
          throw new Error(`Option requires 1 parameter, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: exports.TypeDefInfo.Option,
          sub: _classPrivateFieldBase(this, _createSiDef)[_createSiDef](params[0].type.unwrap())
        });
      } else if (specialVariant === 'Result') {
        if (params.length !== 2) {
          throw new Error(`Result requires 2 parameters, found ${params.length}`);
        }
        return withTypeString(this.registry, {
          info: exports.TypeDefInfo.Result,
          sub: params.map(({
            type
          }, index) => util.objectSpread({
            name: ['Ok', 'Error'][index]
          }, _classPrivateFieldBase(this, _createSiDef)[_createSiDef](type.unwrap())))
        });
      }
    }
    if (variants.length === 0) {
      return {
        info: exports.TypeDefInfo.Null,
        type: 'Null'
      };
    }
    return _classPrivateFieldBase(this, _extractVariantEnum)[_extractVariantEnum](lookupIndex, variants);
  }
  function _extractVariantEnum2(lookupIndex, variants) {
    const sub = [];
    variants.slice().sort((a, b) => a.index.cmp(b.index)).forEach(({
      fields,
      index: bnIndex,
      name
    }) => {
      const index = bnIndex.toNumber();
      while (sub.length !== index) {
        sub.push({
          index: sub.length,
          info: exports.TypeDefInfo.Null,
          name: `__Unused${sub.length}`,
          type: 'Null'
        });
      }
      sub.push(util.objectSpread(_classPrivateFieldBase(this, _extractFields)[_extractFields](-1, fields), {
        index,
        name: name.toString()
      }));
    });
    return withTypeString(this.registry, {
      info: exports.TypeDefInfo.Enum,
      lookupIndex,
      lookupName: _classPrivateFieldBase(this, _names)[_names][lookupIndex],
      sub
    });
  }

  function convertType(key) {
    return (registry, {
      type
    }) => registry.createType('Si1TypeDef', {
      [key]: {
        type: type.toNumber()
      }
    });
  }
  function convertArray(registry, {
    len,
    type
  }) {
    return registry.createType('Si1TypeDef', {
      Array: {
        len,
        type: type.toNumber()
      }
    });
  }
  function convertBitSequence(registry, {
    bitOrderType,
    bitStoreType
  }) {
    return registry.createType('Si1TypeDef', {
      BitSequence: {
        bitOrderType: bitOrderType.toNumber(),
        bitStoreType: bitStoreType.toNumber()
      }
    });
  }
  const convertCompact = convertType('Compact');
  function convertComposite(registry, {
    fields
  }) {
    return registry.createType('Si1TypeDef', {
      Composite: {
        fields: convertFields(registry, fields)
      }
    });
  }
  function convertFields(registry, fields) {
    return fields.map(({
      docs,
      name,
      type,
      typeName
    }) => registry.createType('Si1Field', {
      docs,
      name,
      type: type.toNumber(),
      typeName
    }));
  }
  function convertPhantom(registry, path) {
    console.warn(`Converting phantom type ${path.map(p => p.toString()).join('::')} to empty tuple`);
    return registry.createType('Si1TypeDef', {
      Tuple: []
    });
  }
  function convertPrimitive(registry, prim) {
    return registry.createType('Si1TypeDef', {
      Primitive: prim.toString()
    });
  }
  const convertSequence = convertType('Sequence');
  function convertTuple(registry, types) {
    return registry.createType('Si1TypeDef', {
      Tuple: types.map(t => t.toNumber())
    });
  }
  function convertVariant(registry, {
    variants
  }) {
    return registry.createType('Si1TypeDef', {
      Variant: {
        variants: variants.map(({
          discriminant,
          docs,
          fields,
          name
        }, index) => registry.createType('Si1Variant', {
          docs,
          fields: convertFields(registry, fields),
          index: discriminant.isSome ? discriminant.unwrap().toNumber() : index,
          name
        }))
      }
    });
  }
  function convertDef(registry, {
    def,
    path
  }) {
    let result;
    switch (def.type) {
      case 'Array':
        result = convertArray(registry, def.asArray);
        break;
      case 'BitSequence':
        result = convertBitSequence(registry, def.asBitSequence);
        break;
      case 'Compact':
        result = convertCompact(registry, def.asCompact);
        break;
      case 'Composite':
        result = convertComposite(registry, def.asComposite);
        break;
      case 'Phantom':
        result = convertPhantom(registry, path);
        break;
      case 'Primitive':
        result = convertPrimitive(registry, def.asPrimitive);
        break;
      case 'Sequence':
        result = convertSequence(registry, def.asSequence);
        break;
      case 'Tuple':
        result = convertTuple(registry, def.asTuple);
        break;
      case 'Variant':
        result = convertVariant(registry, def.asVariant);
        break;
      default:
        util.assertUnreachable(def.type);
    }
    return result;
  }
  function toV1(registry, types) {
    return types.map((t, index) => registry.createType('PortableType', {
      id: index + 1,
      type: {
        def: convertDef(registry, t),
        docs: [],
        params: t.params.map(p => registry.createType('Si1TypeParameter', {
          type: p.toNumber()
        })),
        path: t.path.map(p => p.toString())
      }
    }));
  }

  const DEFAULT_FIRST_CALL_IDX = new Uint8Array(2);
  const l = util.logger('registry');
  function sortDecimalStrings(a, b) {
    return parseInt(a, 10) - parseInt(b, 10);
  }
  function valueToString(v) {
    return v.toString();
  }
  function getFieldArgs(lookup, fields) {
    const args = new Array(fields.length);
    for (let i = 0; i < fields.length; i++) {
      args[i] = lookup.getTypeDef(fields[i].type).type;
    }
    return args;
  }
  function clearRecord(record) {
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      delete record[keys[i]];
    }
  }
  function getVariantStringIdx({
    index
  }) {
    return index.toString();
  }
  function injectErrors(_, {
    lookup,
    pallets
  }, version, result) {
    clearRecord(result);
    for (let i = 0; i < pallets.length; i++) {
      const {
        errors,
        index,
        name
      } = pallets[i];
      if (errors.isSome) {
        const sectionName = util.stringCamelCase(name);
        util.lazyMethod(result, version >= 12 ? index.toNumber() : i, () => lazyVariants(lookup, errors.unwrap(), getVariantStringIdx, ({
          docs,
          fields,
          index,
          name
        }) => ({
          args: getFieldArgs(lookup, fields),
          docs: docs.map(valueToString),
          fields,
          index: index.toNumber(),
          method: name.toString(),
          name: name.toString(),
          section: sectionName
        })));
      }
    }
  }
  function injectEvents(registry, {
    lookup,
    pallets
  }, version, result) {
    const filtered = pallets.filter(filterEventsSome);
    clearRecord(result);
    for (let i = 0; i < filtered.length; i++) {
      const {
        events,
        index,
        name
      } = filtered[i];
      util.lazyMethod(result, version >= 12 ? index.toNumber() : i, () => lazyVariants(lookup, events.unwrap(), getVariantStringIdx, variant => {
        const meta = registry.createType('EventMetadataLatest', util.objectSpread({}, variant, {
          args: getFieldArgs(lookup, variant.fields)
        }));
        return class extends GenericEventData {
          constructor(registry, value) {
            super(registry, value, meta, util.stringCamelCase(name), variant.name.toString());
          }
        };
      }));
    }
  }
  function injectExtrinsics(registry, {
    lookup,
    pallets
  }, version, result, mapping) {
    const filtered = pallets.filter(filterCallsSome);
    clearRecord(result);
    clearRecord(mapping);
    for (let i = 0; i < filtered.length; i++) {
      const {
        calls,
        index,
        name
      } = filtered[i];
      const sectionIndex = version >= 12 ? index.toNumber() : i;
      const sectionName = util.stringCamelCase(name);
      const allCalls = calls.unwrap();
      util.lazyMethod(result, sectionIndex, () => lazyVariants(lookup, allCalls, getVariantStringIdx, variant => createCallFunction(registry, lookup, variant, sectionName, sectionIndex)));
      const {
        path
      } = registry.lookup.getSiType(allCalls.type);
      const palletIdx = path.findIndex(v => v.eq('pallet'));
      if (palletIdx !== -1) {
        const name = util.stringCamelCase(path.slice(0, palletIdx).map((p, i) => i === 0
        ? p.replace(/^(frame|pallet)_/, '') : p).join(' '));
        if (!mapping[name]) {
          mapping[name] = [sectionName];
        } else {
          mapping[name].push(sectionName);
        }
      }
    }
  }
  function extractProperties(registry, metadata) {
    const original = registry.getChainProperties();
    const constants = decorateConstants(registry, metadata.asLatest, metadata.version);
    const ss58Format = constants.system && (constants.system.sS58Prefix || constants.system.ss58Prefix);
    if (!ss58Format) {
      return original;
    }
    const {
      tokenDecimals,
      tokenSymbol
    } = original || {};
    return registry.createTypeUnsafe('ChainProperties', [{
      ss58Format,
      tokenDecimals,
      tokenSymbol
    }]);
  }
  class TypeRegistry {
    #classes = new Map();
    #definitions = new Map();
    #firstCallIndex = null;
    #lookup;
    #metadata;
    #metadataVersion = 0;
    #metadataCalls = {};
    #metadataErrors = {};
    #metadataEvents = {};
    #moduleMap = {};
    #unknownTypes = new Map();
    #chainProperties;
    #hasher = utilCrypto.blake2AsU8a;
    #knownDefaults;
    #knownDefinitions;
    #knownTypes = {};
    #signedExtensions = fallbackExtensions;
    #userExtensions;
    constructor(createdAtHash) {
      this.#knownDefaults = util.objectSpread({
        Json,
        Metadata,
        PortableRegistry,
        Raw
      }, baseTypes);
      this.#knownDefinitions = definitions;
      const allKnown = Object.values(this.#knownDefinitions);
      for (let i = 0; i < allKnown.length; i++) {
        this.register(allKnown[i].types);
      }
      if (createdAtHash) {
        this.createdAtHash = this.createType('Hash', createdAtHash);
      }
    }
    get chainDecimals() {
      var _this$chainProperties;
      if ((_this$chainProperties = this.#chainProperties) !== null && _this$chainProperties !== void 0 && _this$chainProperties.tokenDecimals.isSome) {
        const allDecimals = this.#chainProperties.tokenDecimals.unwrap();
        if (allDecimals.length) {
          return allDecimals.map(b => b.toNumber());
        }
      }
      return [12];
    }
    get chainSS58() {
      var _this$chainProperties2;
      return (_this$chainProperties2 = this.#chainProperties) !== null && _this$chainProperties2 !== void 0 && _this$chainProperties2.ss58Format.isSome ? this.#chainProperties.ss58Format.unwrap().toNumber() : undefined;
    }
    get chainTokens() {
      var _this$chainProperties3;
      if ((_this$chainProperties3 = this.#chainProperties) !== null && _this$chainProperties3 !== void 0 && _this$chainProperties3.tokenSymbol.isSome) {
        const allTokens = this.#chainProperties.tokenSymbol.unwrap();
        if (allTokens.length) {
          return allTokens.map(valueToString);
        }
      }
      return [util.formatBalance.getDefaults().unit];
    }
    get firstCallIndex() {
      return this.#firstCallIndex || DEFAULT_FIRST_CALL_IDX;
    }
    isLookupType(value) {
      return /Lookup\d+$/.test(value);
    }
    createLookupType(lookupId) {
      return `Lookup${lookupId.toString()}`;
    }
    get knownTypes() {
      return this.#knownTypes;
    }
    get lookup() {
      return util.assertReturn(this.#lookup, 'Lookup has not been set on this registry');
    }
    get metadata() {
      return util.assertReturn(this.#metadata, 'Metadata has not been set on this registry');
    }
    get unknownTypes() {
      return [...this.#unknownTypes.keys()];
    }
    get signedExtensions() {
      return this.#signedExtensions;
    }
    clearCache() {
      this.#classes = new Map();
    }
    createClass(type) {
      return createClassUnsafe(this, type);
    }
    createClassUnsafe(type) {
      return createClassUnsafe(this, type);
    }
    createType(type, ...params) {
      return createTypeUnsafe(this, type, params);
    }
    createTypeUnsafe(type, params, options) {
      return createTypeUnsafe(this, type, params, options);
    }
    findMetaCall(callIndex) {
      const [section, method] = [callIndex[0], callIndex[1]];
      return util.assertReturn(this.#metadataCalls[`${section}`] && this.#metadataCalls[`${section}`][`${method}`], () => `findMetaCall: Unable to find Call with index [${section}, ${method}]/[${callIndex.toString()}]`);
    }
    findMetaError(errorIndex) {
      const [section, method] = util.isU8a(errorIndex) ? [errorIndex[0], errorIndex[1]] : [errorIndex.index.toNumber(), util.isU8a(errorIndex.error) ? errorIndex.error[0] : errorIndex.error.toNumber()];
      return util.assertReturn(this.#metadataErrors[`${section}`] && this.#metadataErrors[`${section}`][`${method}`], () => `findMetaError: Unable to find Error with index [${section}, ${method}]/[${errorIndex.toString()}]`);
    }
    findMetaEvent(eventIndex) {
      const [section, method] = [eventIndex[0], eventIndex[1]];
      return util.assertReturn(this.#metadataEvents[`${section}`] && this.#metadataEvents[`${section}`][`${method}`], () => `findMetaEvent: Unable to find Event with index [${section}, ${method}]/[${eventIndex.toString()}]`);
    }
    get(name, withUnknown, knownTypeDef) {
      return this.getUnsafe(name, withUnknown, knownTypeDef);
    }
    getUnsafe(name, withUnknown, knownTypeDef) {
      let Type = this.#classes.get(name) || this.#knownDefaults[name];
      if (!Type) {
        const definition = this.#definitions.get(name);
        let BaseType;
        if (definition) {
          BaseType = createClassUnsafe(this, definition);
        } else if (knownTypeDef) {
          BaseType = constructTypeClass(this, knownTypeDef);
        } else if (withUnknown) {
          l.warn(`Unable to resolve type ${name}, it will fail on construction`);
          this.#unknownTypes.set(name, true);
          BaseType = DoNotConstruct.with(name);
        }
        if (BaseType) {
          Type = class extends BaseType {};
          this.#classes.set(name, Type);
          if (knownTypeDef && util.isNumber(knownTypeDef.lookupIndex)) {
            this.#classes.set(this.createLookupType(knownTypeDef.lookupIndex), Type);
          }
        }
      }
      return Type;
    }
    getChainProperties() {
      return this.#chainProperties;
    }
    getClassName(Type) {
      const names = [];
      for (const [name, Clazz] of Object.entries(this.#knownDefaults)) {
        if (Type === Clazz) {
          names.push(name);
        }
      }
      for (const [name, Clazz] of this.#classes.entries()) {
        if (Type === Clazz) {
          names.push(name);
        }
      }
      names.sort().reverse();
      return names.length ? names[0] : undefined;
    }
    getDefinition(typeName) {
      return this.#definitions.get(typeName);
    }
    getModuleInstances(specName, moduleName) {
      var _this$knownTypes, _this$knownTypes$type, _this$knownTypes$type2, _this$knownTypes$type3, _this$knownTypes$type4;
      return ((_this$knownTypes = this.#knownTypes) === null || _this$knownTypes === void 0 ? void 0 : (_this$knownTypes$type = _this$knownTypes.typesBundle) === null || _this$knownTypes$type === void 0 ? void 0 : (_this$knownTypes$type2 = _this$knownTypes$type.spec) === null || _this$knownTypes$type2 === void 0 ? void 0 : (_this$knownTypes$type3 = _this$knownTypes$type2[specName.toString()]) === null || _this$knownTypes$type3 === void 0 ? void 0 : (_this$knownTypes$type4 = _this$knownTypes$type3.instances) === null || _this$knownTypes$type4 === void 0 ? void 0 : _this$knownTypes$type4[moduleName]) || this.#moduleMap[moduleName];
    }
    getOrThrow(name, msg) {
      const Clazz = this.get(name);
      if (!Clazz) {
        throw new Error(msg || `type ${name} not found`);
      }
      return Clazz;
    }
    getOrUnknown(name) {
      return this.get(name, true);
    }
    getSignedExtensionExtra() {
      return expandExtensionTypes(this.#signedExtensions, 'payload', this.#userExtensions);
    }
    getSignedExtensionTypes() {
      return expandExtensionTypes(this.#signedExtensions, 'extrinsic', this.#userExtensions);
    }
    hasClass(name) {
      return this.#classes.has(name) || !!this.#knownDefaults[name];
    }
    hasDef(name) {
      return this.#definitions.has(name);
    }
    hasType(name) {
      return !this.#unknownTypes.get(name) && (this.hasClass(name) || this.hasDef(name));
    }
    hash(data) {
      return this.createType('CodecHash', this.#hasher(data));
    }
    register(arg1, arg2) {
      if (util.isFunction(arg1)) {
        this.#classes.set(arg1.name, arg1);
      } else if (util.isString(arg1)) {
        if (!util.isFunction(arg2)) {
          throw new Error(`Expected class definition passed to '${arg1}' registration`);
        } else if (arg1 === arg2.toString()) {
          throw new Error(`Unable to register circular ${arg1} === ${arg1}`);
        }
        this.#classes.set(arg1, arg2);
      } else {
        this._registerObject(arg1);
      }
    }
    _registerObject(obj) {
      const entries = Object.entries(obj);
      for (let e = 0; e < entries.length; e++) {
        const [name, type] = entries[e];
        if (util.isFunction(type)) {
          this.#classes.set(name, type);
        } else {
          const def = util.isString(type) ? type : util.stringify(type);
          if (name === def) {
            throw new Error(`Unable to register circular ${name} === ${def}`);
          }
          if (this.#classes.has(name)) {
            this.#classes.delete(name);
          }
          this.#definitions.set(name, def);
        }
      }
    }
    setChainProperties(properties) {
      if (properties) {
        this.#chainProperties = properties;
      }
    }
    setHasher(hasher) {
      this.#hasher = hasher || utilCrypto.blake2AsU8a;
    }
    setKnownTypes(knownTypes) {
      this.#knownTypes = knownTypes;
    }
    setLookup(lookup) {
      this.#lookup = lookup;
      lookup.register();
    }
    setMetadata(metadata, signedExtensions, userExtensions) {
      this.#metadata = metadata.asLatest;
      this.#metadataVersion = metadata.version;
      this.#firstCallIndex = null;
      this.setLookup(this.#metadata.lookup);
      injectExtrinsics(this, this.#metadata, this.#metadataVersion, this.#metadataCalls, this.#moduleMap);
      injectErrors(this, this.#metadata, this.#metadataVersion, this.#metadataErrors);
      injectEvents(this, this.#metadata, this.#metadataVersion, this.#metadataEvents);
      const [defSection] = Object.keys(this.#metadataCalls).sort(sortDecimalStrings);
      if (defSection) {
        const [defMethod] = Object.keys(this.#metadataCalls[defSection]).sort(sortDecimalStrings);
        if (defMethod) {
          this.#firstCallIndex = new Uint8Array([parseInt(defSection, 10), parseInt(defMethod, 10)]);
        }
      }
      this.setSignedExtensions(signedExtensions || (this.#metadata.extrinsic.version.gt(util.BN_ZERO)
      ? this.#metadata.extrinsic.signedExtensions.map(({
        identifier
      }) => identifier.toString()) : fallbackExtensions), userExtensions);
      this.setChainProperties(extractProperties(this, metadata));
    }
    setSignedExtensions(signedExtensions = fallbackExtensions, userExtensions) {
      this.#signedExtensions = signedExtensions;
      this.#userExtensions = userExtensions;
      const unknown = findUnknownExtensions(this.#signedExtensions, this.#userExtensions);
      if (unknown.length) {
        l.warn(`Unknown signed extensions ${unknown.join(', ')} found, treating them as no-effect`);
      }
    }
  }

  const packageInfo = {
    name: '@polkadot/types',
    path: (({ url: (typeof document === 'undefined' && typeof location === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : typeof document === 'undefined' ? location.href : (document.currentScript && document.currentScript.src || new URL('bundle-polkadot-types.js', document.baseURI).href)) }) && (typeof document === 'undefined' && typeof location === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : typeof document === 'undefined' ? location.href : (document.currentScript && document.currentScript.src || new URL('bundle-polkadot-types.js', document.baseURI).href))) ? new URL((typeof document === 'undefined' && typeof location === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : typeof document === 'undefined' ? location.href : (document.currentScript && document.currentScript.src || new URL('bundle-polkadot-types.js', document.baseURI).href))).pathname.substring(0, new URL((typeof document === 'undefined' && typeof location === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : typeof document === 'undefined' ? location.href : (document.currentScript && document.currentScript.src || new URL('bundle-polkadot-types.js', document.baseURI).href))).pathname.lastIndexOf('/') + 1) : 'auto',
    type: 'esm',
    version: '9.4.1'
  };

  exports.BTreeMap = BTreeMap;
  exports.BTreeSet = BTreeSet;
  exports.BitVec = BitVec;
  exports.Bool = bool;
  exports.Bytes = Bytes;
  exports.CodecMap = CodecMap;
  exports.CodecSet = CodecSet;
  exports.Compact = Compact;
  exports.Data = Data;
  exports.DoNotConstruct = DoNotConstruct;
  exports.Enum = Enum;
  exports.F32 = f32;
  exports.F64 = f64;
  exports.GenericAccountId = GenericAccountId;
  exports.GenericAccountId32 = GenericAccountId;
  exports.GenericAccountId33 = GenericAccountId33;
  exports.GenericAccountIndex = GenericAccountIndex;
  exports.GenericAddress = GenericMultiAddress;
  exports.GenericBlock = GenericBlock;
  exports.GenericCall = GenericCall;
  exports.GenericChainProperties = GenericChainProperties;
  exports.GenericConsensusEngineId = GenericConsensusEngineId;
  exports.GenericEthereumAccountId = GenericEthereumAccountId;
  exports.GenericEthereumLookupSource = GenericEthereumLookupSource;
  exports.GenericEvent = GenericEvent;
  exports.GenericEventData = GenericEventData;
  exports.GenericExtrinsic = GenericExtrinsic;
  exports.GenericExtrinsicEra = GenericExtrinsicEra;
  exports.GenericExtrinsicPayload = GenericExtrinsicPayload;
  exports.GenericExtrinsicPayloadUnknown = GenericExtrinsicPayloadUnknown;
  exports.GenericExtrinsicPayloadV4 = GenericExtrinsicPayloadV4;
  exports.GenericExtrinsicSignatureV4 = GenericExtrinsicSignatureV4;
  exports.GenericExtrinsicUnknown = GenericExtrinsicUnknown;
  exports.GenericExtrinsicV4 = GenericExtrinsicV4;
  exports.GenericImmortalEra = ImmortalEra;
  exports.GenericLookupSource = GenericLookupSource;
  exports.GenericMortalEra = MortalEra;
  exports.GenericMultiAddress = GenericMultiAddress;
  exports.GenericSignerPayload = GenericSignerPayload;
  exports.GenericVote = GenericVote;
  exports.HashMap = HashMap;
  exports.I128 = i128;
  exports.I16 = i16;
  exports.I256 = i256;
  exports.I32 = i32;
  exports.I64 = i64;
  exports.I8 = i8;
  exports.Int = Int;
  exports.Json = Json;
  exports.Linkage = Linkage;
  exports.Map = CodecMap;
  exports.Metadata = Metadata;
  exports.Null = Null;
  exports.Option = Option;
  exports.OptionBool = OptionBool;
  exports.PortableRegistry = PortableRegistry;
  exports.Range = Range;
  exports.RangeInclusive = RangeInclusive;
  exports.Raw = Raw;
  exports.Result = Result;
  exports.Set = CodecSet;
  exports.StorageKey = StorageKey;
  exports.Struct = Struct;
  exports.Text = Text;
  exports.Tuple = Tuple;
  exports.Type = Type;
  exports.TypeRegistry = TypeRegistry;
  exports.U128 = u128;
  exports.U16 = u16;
  exports.U256 = u256;
  exports.U32 = u32;
  exports.U64 = u64;
  exports.U8 = u8;
  exports.U8aFixed = U8aFixed;
  exports.UInt = UInt;
  exports.USize = usize;
  exports.Vec = Vec;
  exports.VecFixed = VecFixed;
  exports.WrapperKeepOpaque = WrapperKeepOpaque;
  exports.WrapperOpaque = WrapperOpaque;
  exports.XCM_MAPPINGS = XCM_MAPPINGS;
  exports.bool = bool;
  exports.constructTypeClass = constructTypeClass;
  exports.convertSiV0toV1 = toV1;
  exports.createClass = createClass;
  exports.createClassUnsafe = createClassUnsafe;
  exports.createType = createType;
  exports.createTypeUnsafe = createTypeUnsafe;
  exports.decorateConstants = decorateConstants;
  exports.decorateExtrinsics = decorateExtrinsics;
  exports.decorateStorage = decorateStorage;
  exports.encodeTypeDef = encodeTypeDef;
  exports.expandMetadata = expandMetadata;
  exports.f32 = f32;
  exports.f64 = f64;
  exports.getTypeClass = getTypeClass;
  exports.getTypeDef = getTypeDef;
  exports.i128 = i128;
  exports.i16 = i16;
  exports.i256 = i256;
  exports.i32 = i32;
  exports.i64 = i64;
  exports.i8 = i8;
  exports.lazyVariants = lazyVariants;
  exports.mapXcmTypes = mapXcmTypes;
  exports.packageInfo = packageInfo;
  exports.paramsNotation = paramsNotation;
  exports.rpcDefinitions = jsonrpc$1;
  exports.typeDefinitions = definitions;
  exports.typeSplit = typeSplit;
  exports.u128 = u128;
  exports.u16 = u16;
  exports.u256 = u256;
  exports.u32 = u32;
  exports.u64 = u64;
  exports.u8 = u8;
  exports.unwrapStorageType = unwrapStorageType;
  exports.usize = usize;
  exports.withTypeString = withTypeString;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
