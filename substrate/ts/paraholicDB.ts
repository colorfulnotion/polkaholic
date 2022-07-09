"use strict";

const mysql = require("mysql2");

const assetTypeERC20 = "ERC20";
const assetTypeERC20LiquidityPair = "ERC20LP";
const assetTypeToken = "Token";
const assetTypeLoan = "Loan";
const assetTypeLiquidityPair = "LiquidityPair";


type ChainID = number;
type Decimals = number;
type AssetSymbol = string;
type AssetString = string;
type AssetChainString = string;
type AssetType = typeof assetTypeERC20 | typeof assetTypeERC20LiquidityPair | typeof assetTypeToken | typeof assetTypeLiquidityPair | typeof assetTypeLoan;

function makeAssetChain(asset: AssetString, chainID: ChainID) : AssetChainString {
  return(asset + "#" + chainID);
}

function parseAssetChain( ac : AssetChainString ) : [ AssetString, ChainID  ] {
  let sa = ac.split("#");
  let asset : AssetString = sa[0];
  let chainID : ChainID = parseInt(sa[1], 10); // TypeScript INSISTS!
  return [ asset, chainID ];
}

interface PriceUSDPath {
  route: AssetString;
  dest:  AssetString;
  symbol: AssetSymbol;
  token0Symbol:  AssetSymbol;
  token1Symbol:  AssetSymbol;
  s : number;
};

interface IAsset {
  assetType: AssetType;
  asset:     AssetString;  // 0x.... or [] or {} etc
  assetName: string;
  chainID:   ChainID;
  decimals:  Decimals;
  assetChain: AssetChainString;
  priceUSDpaths: Array<PriceUSDPath>;
};

interface IAssetLiquidityPair extends IAsset {
  token0: AssetString;
  token1: AssetString;
  token0Symbol: AssetSymbol;
  token1Symbol: AssetSymbol;
  token0Decimals: Decimals;
  token1Decimals: Decimals;
  token0Supply: number;   // decimal(36,18)
  token1Supply: number;   // decimal(36,18)
};

class Asset  implements IAsset {
  assetChain: AssetChainString;
  asset:     AssetString;
  assetType: AssetType;
  assetName: string;
  chainID:   ChainID;
  decimals:  number;
  priceUSDpaths: Array<PriceUSDPath>;
}

class AssetLiquidityPair extends Asset implements IAssetLiquidityPair {
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0Supply: number;   // decimal(36,18)
  token1Supply: number;   // decimal(36,18)
}

class Loan<Asset> extends Asset {
  issuance : number;
  debitExchangeRate: number;
}

class PolkaholicDB {
  assetInfo : Map<AssetString,IAsset>;
  connConfig : any = {
            host: "db00",
            user: "root",
            password: "c0v1d19w9lk3r!",
            database: "defi",
            charset: "utf8mb4",
        };

  async init() {
     this.assetInfo = new Map<AssetChainString,IAsset>();

     var pool = mysql.createPool(this.connConfig);
     const promisePool = pool.promise();
     let [assetRecs, __] = await promisePool.query("select asset.asset, asset.chainID, chain.chainName, assetType, asset.assetName, asset.decimals, asset.symbol, \
  asset.assetPair, asset.token0, asset.token1, asset.token0Symbol, asset.token1Symbol, asset.token0Decimals, asset.token1Decimals, \
  asset.isUSD, asset.numHolders, priceUSDpaths \
from asset, chain where asset.chainID = chain.chainID \
  and assetType in ('Loan','ERC20','LiquidityPair','ERC20LiquidityPair','Token')  \
   and priceUSDpaths is not null \
  order by chainID, assetType, asset limit 20");
     var pool = mysql.createPool(this.connConfig);
     promisePool.end();

     for (let i = 0 ; i < assetRecs.length; i++) {
          let r = assetRecs[i];
	  if ( r.assetType == assetTypeERC20 || r.assetType == assetTypeToken ) {
	    let a : IAsset = new Asset();
       	    a.assetType = r.assetType;
  	    a.chainID = r.chainID;
     	    a.decimals = r.decimals;
  	    a.assetName = r.assetName;
	    a.asset = r.asset;
	    a.assetChain = makeAssetChain(a.asset, a.chainID);
	    a.priceUSDpaths = JSON.parse(r.priceUSDpaths);
	    this.assetInfo.set(a.assetChain, a);
	  } else if ( r.assetType == assetTypeERC20LiquidityPair || r.assetType == assetTypeLiquidityPair ) {
            let b = new AssetLiquidityPair();
	    b.assetType = r.assetType;
  	    b.chainID = r.chainID;
     	    b.decimals = r.decimals;
  	    b.assetName = r.assetName;
	    b.asset = r.asset;
	    b.token0Symbol = r.token0Symbol;
	    b.token1Symbol = r.token1Symbol;
	    b.token0Decimals = r.token0Decimals;
	    b.token1Decimals = r.token1Decimals;
	    b.assetChain = makeAssetChain(b.asset, b.chainID);
	    this.assetInfo.set(b.assetChain, b);
	  } else if ( r.assetType == assetTypeLoan ) {
            let c = new Loan<Asset>();
       	    c.assetType = r.assetType;
  	    c.chainID = r.chainID;
     	    c.decimals = r.decimals;
  	    c.assetName = r.assetName;
	    c.asset = r.asset;
	    c.assetChain = makeAssetChain(c.asset, c.chainID);
	    c.issuance = 1234;
	    c.debitExchangeRate = 56789;
	    this.assetInfo.set(c.assetChain, c);
	  }
     }
     let entries = this.assetInfo.entries();
     for (let ac of entries) {
  	console.log(ac) // parseAssetChain(ac);
     }
   }
}


let p = new PolkaholicDB();

p.init();
