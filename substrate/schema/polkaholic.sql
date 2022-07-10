-- MySQL dump 10.13  Distrib 5.7.38, for Linux (x86_64)
--
-- Host: db00.polkaholic.internal    Database: defi
-- ------------------------------------------------------
-- Server version	5.7.37-google-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- Table structure for table `account`
--

DROP TABLE IF EXISTS `account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `account` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numFollowers` int(11) DEFAULT '0',
  `numFollowing` int(11) DEFAULT '0',
  `verified` tinyint(4) DEFAULT '0',
  `verifyDT` datetime DEFAULT NULL,
  `judgements` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `info` blob,
  `judgementsKSM` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `infoKSM` blob,
  PRIMARY KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `address`
--

DROP TABLE IF EXISTS `address`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `address` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `balanceUSD` double DEFAULT NULL,
  `balanceUSDupdateDT` datetime DEFAULT NULL,
  `symbols` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exchanges` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numChains` int(11) DEFAULT NULL,
  `numAssets` int(11) DEFAULT NULL,
  `tags` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransfersIn` int(11) DEFAULT NULL,
  `transferInFirstTS` int(11) DEFAULT '0',
  `transferInLastTS` int(11) DEFAULT '0',
  `avgTransferInUSD` double DEFAULT NULL,
  `sumTransferInUSD` double DEFAULT NULL,
  `numTransfersOut` int(11) DEFAULT NULL,
  `transferOutFirstTS` int(11) DEFAULT '0',
  `transferOutLastTS` int(11) DEFAULT '0',
  `avgTransferOutUSD` double DEFAULT NULL,
  `sumTransferOutUSD` double DEFAULT NULL,
  `numExtrinsics` int(11) DEFAULT '0',
  `numExtrinsicsDefi` int(11) DEFAULT '0',
  `extrinsicFirstTS` int(11) DEFAULT NULL,
  `extrinsicLastTS` int(11) DEFAULT NULL,
  `numCrowdloans` int(11) DEFAULT '0',
  `crowdloansUSD` double DEFAULT NULL,
  `numSubAccounts` int(11) DEFAULT '0',
  `numRewards` int(11) DEFAULT '0',
  `rewardsUSD` double DEFAULT NULL,
  PRIMARY KEY (`address`),
  KEY `balanceUSD` (`balanceUSD`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `addressTopN`
--

DROP TABLE IF EXISTS `addressTopN`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `addressTopN` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `topN` enum('balanceUSD','numChains','numAssets','numTransfersIn','avgTransferInUSD','sumTransferInUSD','numTransfersOut','avgTransferOutUSD','sumTransferOutUSD','numExtrinsics','numExtrinsicsDefi','numCrowdloans','numSubAccounts','numRewards','rewardsUSD') COLLATE utf8mb4_unicode_ci NOT NULL,
  `N` int(11) NOT NULL DEFAULT '0',
  `balanceUSD` double DEFAULT '0',
  `val` double DEFAULT '0',
  PRIMARY KEY (`topN`,`N`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `addressoffer`
--

DROP TABLE IF EXISTS `addressoffer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `addressoffer` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `offerID` int(11) NOT NULL,
  `startDT` datetime DEFAULT NULL,
  `rewardAmount` double DEFAULT '0',
  `rewardSymbol` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rewardClaimed` tinyint(4) DEFAULT '0',
  `chainID` int(11) DEFAULT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `blockTS` int(11) DEFAULT NULL,
  `extrinsicID` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claimDT` datetime DEFAULT NULL,
  PRIMARY KEY (`address`,`offerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `apikey`
--

DROP TABLE IF EXISTS `apikey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `apikey` (
  `apikey` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  `deleted` tinyint(4) DEFAULT '0',
  `deleteDT` datetime DEFAULT NULL,
  `planID` int(11) DEFAULT '0',
  PRIMARY KEY (`apikey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset`
--

DROP TABLE IF EXISTS `asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asset` (
  `asset` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainName` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `abiRaw` mediumblob,
  `numTransactions` int(11) DEFAULT '0',
  `assetType` enum('Unknown','Contract','ERC20','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','ERC20LP','Special','CDP','CDP_Supply','CDP_Borrow') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assetName` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decimals` int(11) DEFAULT NULL,
  `totalSupply` decimal(65,18) DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastUpdateDT` datetime DEFAULT NULL,
  `currencyID` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAtTx` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  `numHolders` int(11) DEFAULT '0',
  `metadata` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastState` blob,
  `assetPair` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0Symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0Decimals` int(11) DEFAULT NULL,
  `token1` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token1Symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token1Decimals` int(11) DEFAULT NULL,
  `token0Supply` decimal(36,18) DEFAULT NULL,
  `token1Supply` decimal(36,18) DEFAULT NULL,
  `erc721isMetadata` tinyint(4) DEFAULT '0',
  `erc721isEnumerable` tinyint(4) DEFAULT '0',
  `tokenBaseURI` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipfsUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priceUSD` double DEFAULT '0',
  `priceUSDPercentChange` double DEFAULT '0',
  `lastPriceUpdateDT` datetime DEFAULT NULL,
  `isUSD` tinyint(4) DEFAULT '0',
  `priceUSDpaths` blob,
  `isWrapped` tinyint(4) DEFAULT '0',
  `isNativeChain` tinyint(4) DEFAULT '0',
  `nativeAssetChain` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalFree` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalReserved` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalMiscFrozen` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalFrozen` decimal(65,18) DEFAULT '0.000000000000000000',
  `coingeckoID` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coingeckoLastUpdateDT` datetime DEFAULT NULL,
  PRIMARY KEY (`asset`,`chainID`),
  KEY `assetType` (`assetType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetInit`
--

DROP TABLE IF EXISTS `assetInit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetInit` (
  `asset` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainName` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `abiRaw` mediumblob,
  `numTransactions` int(11) DEFAULT '0',
  `assetType` enum('Unknown','Contract','ERC20','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','ERC20LP','Special') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assetName` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decimals` int(11) DEFAULT NULL,
  `totalSupply` decimal(65,18) DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastUpdateDT` datetime DEFAULT NULL,
  `currencyID` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAtTx` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  `numHolders` int(11) DEFAULT '0',
  `metadata` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastState` blob,
  `assetPair` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0Symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token0Decimals` int(11) DEFAULT NULL,
  `token1` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token1Symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token1Decimals` int(11) DEFAULT NULL,
  `token0Supply` decimal(36,18) DEFAULT NULL,
  `token1Supply` decimal(36,18) DEFAULT NULL,
  `erc721isMetadata` tinyint(4) DEFAULT '0',
  `erc721isEnumerable` tinyint(4) DEFAULT '0',
  `tokenBaseURI` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipfsUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priceUSD` double DEFAULT '0',
  `priceUSDPercentChange` double DEFAULT '0',
  `lastPriceUpdateDT` datetime DEFAULT NULL,
  `isUSD` tinyint(4) DEFAULT '0',
  `priceUSDpaths` blob,
  `isWrapped` tinyint(4) DEFAULT '0',
  `isNativeChain` tinyint(4) DEFAULT '0',
  `nativeAssetChain` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalFree` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalReserved` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalMiscFrozen` decimal(65,18) DEFAULT '0.000000000000000000',
  `totalFrozen` decimal(65,18) DEFAULT '0.000000000000000000',
  PRIMARY KEY (`asset`,`chainID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder0`
--

DROP TABLE IF EXISTS `assetholder0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder0` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder1000`
--

DROP TABLE IF EXISTS `assetholder1000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder1000` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2`
--

DROP TABLE IF EXISTS `assetholder2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2000`
--

DROP TABLE IF EXISTS `assetholder2000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2000` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2002`
--

DROP TABLE IF EXISTS `assetholder2002`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2002` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2004`
--

DROP TABLE IF EXISTS `assetholder2004`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2004` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2006`
--

DROP TABLE IF EXISTS `assetholder2006`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2006` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2007`
--

DROP TABLE IF EXISTS `assetholder2007`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2007` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2011`
--

DROP TABLE IF EXISTS `assetholder2011`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2011` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2012`
--

DROP TABLE IF EXISTS `assetholder2012`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2012` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2013`
--

DROP TABLE IF EXISTS `assetholder2013`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2013` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2019`
--

DROP TABLE IF EXISTS `assetholder2019`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2019` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2021`
--

DROP TABLE IF EXISTS `assetholder2021`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2021` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2026`
--

DROP TABLE IF EXISTS `assetholder2026`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2026` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2028`
--

DROP TABLE IF EXISTS `assetholder2028`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2028` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2030`
--

DROP TABLE IF EXISTS `assetholder2030`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2030` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2031`
--

DROP TABLE IF EXISTS `assetholder2031`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2031` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2032`
--

DROP TABLE IF EXISTS `assetholder2032`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2032` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2034`
--

DROP TABLE IF EXISTS `assetholder2034`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2034` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2035`
--

DROP TABLE IF EXISTS `assetholder2035`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2035` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2037`
--

DROP TABLE IF EXISTS `assetholder2037`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2037` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2040`
--

DROP TABLE IF EXISTS `assetholder2040`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2040` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder2043`
--

DROP TABLE IF EXISTS `assetholder2043`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder2043` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder21000`
--

DROP TABLE IF EXISTS `assetholder21000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder21000` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder21001`
--

DROP TABLE IF EXISTS `assetholder21001`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder21001` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22000`
--

DROP TABLE IF EXISTS `assetholder22000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22000` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22001`
--

DROP TABLE IF EXISTS `assetholder22001`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22001` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22004`
--

DROP TABLE IF EXISTS `assetholder22004`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22004` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22007`
--

DROP TABLE IF EXISTS `assetholder22007`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22007` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22011`
--

DROP TABLE IF EXISTS `assetholder22011`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22011` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22012`
--

DROP TABLE IF EXISTS `assetholder22012`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22012` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22015`
--

DROP TABLE IF EXISTS `assetholder22015`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22015` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22023`
--

DROP TABLE IF EXISTS `assetholder22023`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22023` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22048`
--

DROP TABLE IF EXISTS `assetholder22048`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22048` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22084`
--

DROP TABLE IF EXISTS `assetholder22084`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22084` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22085`
--

DROP TABLE IF EXISTS `assetholder22085`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22085` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22086`
--

DROP TABLE IF EXISTS `assetholder22086`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22086` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22087`
--

DROP TABLE IF EXISTS `assetholder22087`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22087` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22088`
--

DROP TABLE IF EXISTS `assetholder22088`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22088` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22090`
--

DROP TABLE IF EXISTS `assetholder22090`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22090` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22092`
--

DROP TABLE IF EXISTS `assetholder22092`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22092` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22095`
--

DROP TABLE IF EXISTS `assetholder22095`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22095` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22096`
--

DROP TABLE IF EXISTS `assetholder22096`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22096` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22100`
--

DROP TABLE IF EXISTS `assetholder22100`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22100` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22101`
--

DROP TABLE IF EXISTS `assetholder22101`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22101` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22102`
--

DROP TABLE IF EXISTS `assetholder22102`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22102` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22105`
--

DROP TABLE IF EXISTS `assetholder22105`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22105` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22106`
--

DROP TABLE IF EXISTS `assetholder22106`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22106` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22107`
--

DROP TABLE IF EXISTS `assetholder22107`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22107` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22110`
--

DROP TABLE IF EXISTS `assetholder22110`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22110` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22114`
--

DROP TABLE IF EXISTS `assetholder22114`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22114` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetholder22115`
--

DROP TABLE IF EXISTS `assetholder22115`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetholder22115` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `reserved` decimal(65,18) DEFAULT NULL,
  `miscFrozen` decimal(65,18) DEFAULT NULL,
  `frozen` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  PRIMARY KEY (`asset`,`chainID`,`holder`),
  KEY `holder` (`holder`),
  KEY `free` (`free`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assetlog`
--

DROP TABLE IF EXISTS `assetlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `assetlog` (
  `asset` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainName` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainID` int(11) NOT NULL DEFAULT '1',
  `source` enum('coingecko','oracle','onchain') COLLATE utf8mb4_unicode_ci NOT NULL,
  `indexTS` int(11) NOT NULL,
  `priceUSD` float DEFAULT NULL,
  `total_volumes` float DEFAULT NULL,
  `market_caps` float DEFAULT NULL,
  `low` float DEFAULT '0',
  `high` float DEFAULT '0',
  `open` float DEFAULT '0',
  `close` float DEFAULT '0',
  `assetPair` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lp0` float DEFAULT '0',
  `lp1` float DEFAULT '0',
  `token0Volume` decimal(36,18) DEFAULT NULL,
  `token1Volume` decimal(36,18) DEFAULT NULL,
  `issuance` decimal(65,18) DEFAULT NULL,
  `debitExchangeRate` decimal(36,18) DEFAULT NULL,
  `supplyExchangeRate` decimal(36,18) DEFAULT NULL,
  `borrowExchangeRate` decimal(36,18) DEFAULT NULL,
  `state` blob,
  PRIMARY KEY (`asset`,`chainID`,`indexTS`,`source`),
  KEY `indexTS2` (`asset`,`chainID`,`indexTS`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auditHashes`
--

DROP TABLE IF EXISTS `auditHashes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auditHashes` (
  `hash` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `audit` blob,
  PRIMARY KEY (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block0`
--

DROP TABLE IF EXISTS `block0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block0` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block1000`
--

DROP TABLE IF EXISTS `block1000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block1000` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2`
--

DROP TABLE IF EXISTS `block2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2000`
--

DROP TABLE IF EXISTS `block2000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2000` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT NULL,
  `gasLimit` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlLogsEVM` tinyint(4) DEFAULT '1',
  `numLogsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2002`
--

DROP TABLE IF EXISTS `block2002`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2002` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlReceiptsEVM` tinyint(4) DEFAULT '1',
  `crawlTraceEVM` tinyint(4) DEFAULT '1',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT NULL,
  `gasLimit` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2004`
--

DROP TABLE IF EXISTS `block2004`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2004` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlReceiptsEVM` tinyint(4) DEFAULT '1',
  `crawlTraceEVM` tinyint(4) DEFAULT '1',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT NULL,
  `gasLimit` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2006`
--

DROP TABLE IF EXISTS `block2006`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2006` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlReceiptsEVM` tinyint(4) DEFAULT '1',
  `crawlTraceEVM` tinyint(4) DEFAULT '1',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT NULL,
  `gasLimit` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2007`
--

DROP TABLE IF EXISTS `block2007`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2007` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2011`
--

DROP TABLE IF EXISTS `block2011`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2011` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2012`
--

DROP TABLE IF EXISTS `block2012`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2012` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2013`
--

DROP TABLE IF EXISTS `block2013`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2013` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2019`
--

DROP TABLE IF EXISTS `block2019`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2019` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2021`
--

DROP TABLE IF EXISTS `block2021`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2021` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2026`
--

DROP TABLE IF EXISTS `block2026`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2026` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2028`
--

DROP TABLE IF EXISTS `block2028`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2028` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2030`
--

DROP TABLE IF EXISTS `block2030`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2030` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2031`
--

DROP TABLE IF EXISTS `block2031`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2031` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2032`
--

DROP TABLE IF EXISTS `block2032`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2032` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2034`
--

DROP TABLE IF EXISTS `block2034`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2034` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2035`
--

DROP TABLE IF EXISTS `block2035`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2035` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2037`
--

DROP TABLE IF EXISTS `block2037`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2037` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2040`
--

DROP TABLE IF EXISTS `block2040`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2040` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block2043`
--

DROP TABLE IF EXISTS `block2043`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block2043` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block21000`
--

DROP TABLE IF EXISTS `block21000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block21000` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block21001`
--

DROP TABLE IF EXISTS `block21001`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block21001` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22000`
--

DROP TABLE IF EXISTS `block22000`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22000` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22001`
--

DROP TABLE IF EXISTS `block22001`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22001` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22004`
--

DROP TABLE IF EXISTS `block22004`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22004` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22007`
--

DROP TABLE IF EXISTS `block22007`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22007` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlReceiptsEVM` tinyint(4) DEFAULT '1',
  `crawlTraceEVM` tinyint(4) DEFAULT '1',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT '0',
  `gasLimit` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22008`
--

DROP TABLE IF EXISTS `block22008`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22008` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22011`
--

DROP TABLE IF EXISTS `block22011`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22011` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22012`
--

DROP TABLE IF EXISTS `block22012`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22012` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22015`
--

DROP TABLE IF EXISTS `block22015`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22015` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22018`
--

DROP TABLE IF EXISTS `block22018`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22018` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22023`
--

DROP TABLE IF EXISTS `block22023`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22023` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `crawlBlockEVM` tinyint(4) DEFAULT '1',
  `crawlReceiptsEVM` tinyint(4) DEFAULT '1',
  `crawlTraceEVM` tinyint(4) DEFAULT '1',
  `blockHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHashEVM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  `gasUsed` int(11) DEFAULT NULL,
  `gasLimit` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22048`
--

DROP TABLE IF EXISTS `block22048`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22048` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22084`
--

DROP TABLE IF EXISTS `block22084`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22084` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22085`
--

DROP TABLE IF EXISTS `block22085`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22085` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22086`
--

DROP TABLE IF EXISTS `block22086`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22086` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22087`
--

DROP TABLE IF EXISTS `block22087`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22087` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22088`
--

DROP TABLE IF EXISTS `block22088`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22088` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22090`
--

DROP TABLE IF EXISTS `block22090`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22090` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22092`
--

DROP TABLE IF EXISTS `block22092`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22092` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22094`
--

DROP TABLE IF EXISTS `block22094`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22094` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22095`
--

DROP TABLE IF EXISTS `block22095`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22095` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22096`
--

DROP TABLE IF EXISTS `block22096`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22096` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22100`
--

DROP TABLE IF EXISTS `block22100`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22100` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22101`
--

DROP TABLE IF EXISTS `block22101`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22101` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22102`
--

DROP TABLE IF EXISTS `block22102`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22102` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22105`
--

DROP TABLE IF EXISTS `block22105`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22105` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22106`
--

DROP TABLE IF EXISTS `block22106`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22106` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22107`
--

DROP TABLE IF EXISTS `block22107`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22107` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22110`
--

DROP TABLE IF EXISTS `block22110`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22110` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22114`
--

DROP TABLE IF EXISTS `block22114`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22114` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22115`
--

DROP TABLE IF EXISTS `block22115`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22115` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22116`
--

DROP TABLE IF EXISTS `block22116`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22116` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block22118`
--

DROP TABLE IF EXISTS `block22118`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `block22118` (
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockDT` datetime DEFAULT NULL,
  `lastTraceDT` datetime DEFAULT NULL,
  `lastFeedDT` datetime DEFAULT NULL,
  `crawlBlock` tinyint(4) DEFAULT '0',
  `crawlTrace` tinyint(4) DEFAULT '0',
  `crawlFeed` tinyint(4) DEFAULT '0',
  `attempted` tinyint(4) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` float DEFAULT '0',
  PRIMARY KEY (`blockNumber`),
  KEY `blockDT` (`blockDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocklog`
--

DROP TABLE IF EXISTS `blocklog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blocklog` (
  `chainID` int(11) NOT NULL,
  `logDT` date NOT NULL,
  `startBN` int(11) DEFAULT '0',
  `endBN` int(11) DEFAULT '0',
  `numTraces` int(11) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` double DEFAULT '0',
  `numTransactionsEVM` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `gasUsed` bigint(20) DEFAULT NULL,
  `gasLimit` bigint(20) DEFAULT NULL,
  `numEVMBlocks` int(11) DEFAULT '0',
  PRIMARY KEY (`chainID`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blockunfinalized`
--

DROP TABLE IF EXISTS `blockunfinalized`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blockunfinalized` (
  `chainID` int(11) NOT NULL,
  `blockNumber` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blockDT` datetime DEFAULT NULL,
  `numExtrinsics` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `valueTransfersUSD` double DEFAULT '0',
  PRIMARY KEY (`chainID`,`blockNumber`,`blockHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bqlog`
--

DROP TABLE IF EXISTS `bqlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bqlog` (
  `logDT` date NOT NULL,
  `indexTS` int(11) DEFAULT NULL,
  `loadDT` datetime DEFAULT NULL,
  `loaded` tinyint(4) DEFAULT '0',
  `readyForIndexing` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`logDT`),
  UNIQUE KEY `logDT` (`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chain`
--

DROP TABLE IF EXISTS `chain`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chain` (
  `chainID` int(11) NOT NULL,
  `id` varchar(128) DEFAULT NULL,
  `prefix` int(11) DEFAULT NULL,
  `chainName` varchar(32) DEFAULT NULL,
  `relayChain` varchar(32) DEFAULT NULL,
  `WSEndpoint` varchar(255) DEFAULT NULL,
  `WSEndpoint2` varchar(255) DEFAULT NULL,
  `WSEndpoint3` varchar(255) DEFAULT NULL,
  `onfinalityID` varchar(32) DEFAULT NULL,
  `onfinalityStatus` varchar(32) DEFAULT NULL,
  `onfinalityConfig` blob,
  `WSBackfill` varchar(255) DEFAULT NULL,
  `RPCBackfill` varchar(255) DEFAULT NULL,
  `evmRPC` varchar(255) DEFAULT NULL,
  `evmRPCInternal` varchar(255) DEFAULT NULL,
  `isEVM` tinyint(4) DEFAULT '0',
  `blocksCovered` int(11) DEFAULT NULL,
  `blocksFinalized` int(11) DEFAULT NULL,
  `lastCleanChainTS` int(11) DEFAULT NULL,
  `blocksCleaned` int(11) DEFAULT '0',
  `displayName` varchar(64) DEFAULT NULL,
  `standardAccount` varchar(32) DEFAULT NULL,
  `decimals` varchar(32) DEFAULT '[]',
  `symbols` varchar(32) DEFAULT '[]',
  `website` varchar(128) DEFAULT NULL,
  `coingeckoID` varchar(40) DEFAULT NULL,
  `coingeckoLastUpdateDT` datetime DEFAULT NULL,
  `symbol` varchar(16) DEFAULT NULL,
  `asset` varchar(32) DEFAULT NULL,
  `firstSeenBlockTS` int(11) DEFAULT '0',
  `ss58Format` int(11) DEFAULT '42',
  `crawling` tinyint(4) DEFAULT '0',
  `crawlingStatus` varchar(255) DEFAULT '',
  `lastCrawlDT` datetime DEFAULT NULL,
  `lastFinalizedDT` datetime DEFAULT NULL,
  `lastUpdateChainAssetsTS` int(11) DEFAULT '0',
  `traceTSLast` int(11) DEFAULT '0',
  `backfillLookback` int(11) DEFAULT '1',
  `reindexer` varchar(128) DEFAULT NULL,
  `reindexerCount` tinyint(4) DEFAULT '0',
  `lastUpdateStorageKeysTS` int(11) DEFAULT NULL,
  `iconUrl` varchar(255) DEFAULT NULL,
  `active` tinyint(4) DEFAULT '0',
  `paraID` int(11) DEFAULT '0',
  `numTraces` int(11) DEFAULT '0',
  `numTraces7d` int(11) DEFAULT '0',
  `numTraces30d` int(11) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numExtrinsics7d` int(11) DEFAULT '0',
  `numExtrinsics30d` int(11) DEFAULT '0',
  `numSignedExtrinsics` int(11) DEFAULT '0',
  `numSignedExtrinsics7d` int(11) DEFAULT '0',
  `numSignedExtrinsics30d` int(11) DEFAULT '0',
  `numTransfers` int(11) DEFAULT '0',
  `numTransfers7d` int(11) DEFAULT '0',
  `numTransfers30d` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numEvents7d` int(11) DEFAULT '0',
  `numEvents30d` int(11) DEFAULT '0',
  `valueTransfersUSD` double DEFAULT NULL,
  `valueTransfersUSD7d` double DEFAULT NULL,
  `valueTransfersUSD30d` double DEFAULT NULL,
  `numHolders` int(11) DEFAULT '0',
  `totalIssuance` bigint(20) DEFAULT '0',
  `numCrawlBlock` int(11) DEFAULT '0',
  `numCrawlTrace` int(11) DEFAULT '0',
  `numCrawlFeed` int(11) DEFAULT '0',
  `numTransactionsEVM` int(11) DEFAULT '0',
  `numTransactionsEVM7d` int(11) DEFAULT '0',
  `numTransactionsEVM30d` int(11) DEFAULT '0',
  `numReceiptsEVM` int(11) DEFAULT '0',
  `numReceiptsEVM7d` int(11) DEFAULT '0',
  `numReceiptsEVM30d` int(11) DEFAULT '0',
  `gasUsed` bigint(20) DEFAULT '0',
  `gasUsed7d` bigint(20) DEFAULT '0',
  `gasUsed30d` bigint(20) DEFAULT '0',
  `gasLimit` bigint(20) DEFAULT '0',
  `gasLimit7d` bigint(20) DEFAULT '0',
  `gasLimit30d` bigint(20) DEFAULT '0',
  `numEVMBlocks` int(11) DEFAULT '0',
  `numEVMBlocks7d` int(11) DEFAULT '0',
  `numEVMBlocks30d` int(11) DEFAULT '0',
  `WSEndpointSelfHosted` tinyint(4) DEFAULT '0',
  `isRelay` int(2) DEFAULT NULL,
  `renewal` tinyint(4) DEFAULT '0',
  `numXCMTransferIncoming` int(11) DEFAULT '0',
  `numXCMTransferIncoming7d` int(11) DEFAULT '0',
  `numXCMTransferIncoming30d` int(11) DEFAULT '0',
  `numXCMTransferOutgoing` int(11) DEFAULT '0',
  `numXCMTransferOutgoing7d` int(11) DEFAULT '0',
  `numXCMTransferOutgoing30d` int(11) DEFAULT '0',
  `valXCMTransferIncomingUSD` double DEFAULT NULL,
  `valXCMTransferIncomingUSD7d` double DEFAULT NULL,
  `valXCMTransferIncomingUSD30d` double DEFAULT NULL,
  `valXCMTransferOutgoingUSD` double DEFAULT NULL,
  `valXCMTransferOutgoingUSD7d` double DEFAULT NULL,
  `valXCMTransferOutgoingUSD30d` double DEFAULT NULL,
  PRIMARY KEY (`chainID`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chainEndpoint`
--

DROP TABLE IF EXISTS `chainEndpoint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chainEndpoint` (
  `chainName` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relayChain` enum('polkadot','kusama','testnet') COLLATE utf8mb4_unicode_ci NOT NULL,
  `homepage` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paraID` int(11) DEFAULT '0',
  `RPCEndpoint` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint2` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint3` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isUnreachable` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`chainName`,`relayChain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chainPalletStorage`
--

DROP TABLE IF EXISTS `chainPalletStorage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chainPalletStorage` (
  `palletName` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storageName` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) DEFAULT NULL,
  `modifier` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` blob,
  `fallback` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `docs` blob,
  `storageKey` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skip` tinyint(4) DEFAULT '0',
  `lastUpdateDT` date DEFAULT NULL,
  PRIMARY KEY (`palletName`,`storageName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chainhostnameendpoint`
--

DROP TABLE IF EXISTS `chainhostnameendpoint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chainhostnameendpoint` (
  `chainID` int(11) NOT NULL,
  `hostname` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` tinyint(4) DEFAULT NULL,
  `updateDT` datetime DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  PRIMARY KEY (`chainID`,`hostname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chainparachain`
--

DROP TABLE IF EXISTS `chainparachain`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chainparachain` (
  `chainID` int(11) NOT NULL,
  `relaychain` enum('polkadot','kusama','unknown') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paraID` int(11) NOT NULL,
  `parachainID` int(11) DEFAULT NULL,
  `paratype` enum('Parathread','Parachain','Onboarding') COLLATE utf8mb4_unicode_ci DEFAULT 'Parathread',
  `firstSeenDT` datetime DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  PRIMARY KEY (`chainID`,`paraID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `coingecko`
--

DROP TABLE IF EXISTS `coingecko`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coingecko` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `crawling` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `coingecko_market_chart`
--

DROP TABLE IF EXISTS `coingecko_market_chart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coingecko_market_chart` (
  `coingeckoID` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chartDT` date NOT NULL,
  `priceUSD` float DEFAULT NULL,
  `total_volume` float DEFAULT NULL,
  `market_cap` float DEFAULT NULL,
  PRIMARY KEY (`coingeckoID`,`chartDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contractabi`
--

DROP TABLE IF EXISTS `contractabi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contractabi` (
  `name` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fingerprintID` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signatureID` varchar(70) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signatureRaw` blob,
  `signature` blob,
  `abi` blob,
  `abiType` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numContracts` int(11) DEFAULT '0',
  `topicLength` int(11) DEFAULT '0',
  PRIMARY KEY (`fingerprintID`),
  KEY `numContracts` (`numContracts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crowdloan`
--

DROP TABLE IF EXISTS `crowdloan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crowdloan` (
  `extrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extrinsicID` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL,
  `blockNumber` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ts` int(11) DEFAULT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` float DEFAULT NULL,
  `memo` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remark` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paraID` int(11) DEFAULT NULL,
  PRIMARY KEY (`extrinsicHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `events` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numStars` int(11) DEFAULT '0',
  `numEvents` int(11) DEFAULT '0',
  `numEvents7d` int(11) DEFAULT '0',
  `numEvents30d` int(11) DEFAULT '0',
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eventslog`
--

DROP TABLE IF EXISTS `eventslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `eventslog` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date NOT NULL,
  `numEvents` int(11) DEFAULT '0',
  PRIMARY KEY (`chainID`,`section`,`method`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evmtxs`
--

DROP TABLE IF EXISTS `evmtxs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `evmtxs` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numStars` int(11) DEFAULT '0',
  `numTransactionsEVM` int(11) DEFAULT '0',
  `numTransactionsEVM7d` int(11) DEFAULT '0',
  `numTransactionsEVM30d` int(11) DEFAULT '0',
  `docs` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evmtxslog`
--

DROP TABLE IF EXISTS `evmtxslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `evmtxslog` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date NOT NULL,
  `numTransactionsEVM` int(11) DEFAULT '0',
  PRIMARY KEY (`chainID`,`section`,`method`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `extrinsicdocs`
--

DROP TABLE IF EXISTS `extrinsicdocs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `extrinsicdocs` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numStars` int(11) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numExtrinsics7d` int(11) DEFAULT '0',
  `numExtrinsics30d` int(11) DEFAULT '0',
  `docs` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `extrinsics`
--

DROP TABLE IF EXISTS `extrinsics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `extrinsics` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numStars` int(11) DEFAULT '0',
  `numExtrinsics` int(11) DEFAULT '0',
  `numExtrinsics7d` int(11) DEFAULT '0',
  `numExtrinsics30d` int(11) DEFAULT '0',
  `docs` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valueUSD` double DEFAULT NULL,
  `valueUSD7d` double DEFAULT NULL,
  `valueUSD30d` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `extrinsicslog`
--

DROP TABLE IF EXISTS `extrinsicslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `extrinsicslog` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date NOT NULL,
  `numExtrinsics` int(11) DEFAULT '0',
  `numExtrinsicsDefi` int(11) DEFAULT '0',
  `valueUSD` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `extrinsicsrecent`
--

DROP TABLE IF EXISTS `extrinsicsrecent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `extrinsicsrecent` (
  `extrinsicID` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date DEFAULT NULL,
  `hr` int(11) DEFAULT NULL,
  `chainID` int(11) NOT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `extrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ts` int(11) DEFAULT NULL,
  `result` int(11) DEFAULT NULL,
  `signed` int(11) DEFAULT NULL,
  PRIMARY KEY (`chainID`,`extrinsicID`),
  KEY `logDT` (`logDT`,`hr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `follow`
--

DROP TABLE IF EXISTS `follow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `follow` (
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toAddress` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `followDT` datetime DEFAULT NULL,
  `isFollowing` tinyint(4) DEFAULT '1',
  PRIMARY KEY (`fromAddress`,`toAddress`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `indexlog`
--

DROP TABLE IF EXISTS `indexlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `indexlog` (
  `chainID` int(11) NOT NULL,
  `indexTS` int(11) NOT NULL DEFAULT '0',
  `logDT` date NOT NULL,
  `hr` tinyint(4) NOT NULL,
  `indexDT` datetime DEFAULT NULL,
  `elapsedSeconds` int(11) DEFAULT '0',
  `indexed` tinyint(4) DEFAULT '0',
  `readyForIndexing` tinyint(4) DEFAULT '0',
  `specVersion` int(11) DEFAULT '0',
  `bqExists` tinyint(4) DEFAULT '0',
  `numIndexingErrors` int(11) DEFAULT '0',
  `numIndexingWarns` int(11) DEFAULT '0',
  `attempted` int(11) DEFAULT '0',
  `lastAttemptStartDT` datetime DEFAULT NULL,
  `bqlogExtrinsics` tinyint(4) DEFAULT '0',
  `bqlogEvents` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`chainID`,`indexTS`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `method`
--

DROP TABLE IF EXISTS `method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `method` (
  `methodID` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abi` blob,
  `signature` blob,
  `numContracts` int(11) DEFAULT '0',
  PRIMARY KEY (`methodID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `multisigaccount`
--

DROP TABLE IF EXISTS `multisigaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `multisigaccount` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `threshold` int(11) NOT NULL,
  `signatories` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signatorycnt` int(11) NOT NULL,
  PRIMARY KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `offer`
--

DROP TABLE IF EXISTS `offer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `offer` (
  `offerID` int(11) NOT NULL,
  `addressSponsor` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `offerURL` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balanceUSDMin` double DEFAULT '100',
  `status` enum('Active','Paused','Deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `description` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reward` float DEFAULT NULL,
  `symbol` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  `targeting` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`offerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `proxyaccount`
--

DROP TABLE IF EXISTS `proxyaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `proxyaccount` (
  `chainID` int(11) NOT NULL,
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delegate` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proxyType` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT 'Unknown',
  `delay` int(11) DEFAULT '0',
  `removed` int(11) DEFAULT '0',
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastcrawlBN` int(11) DEFAULT '1',
  PRIMARY KEY (`chainID`,`address`,`delegate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rewards`
--

DROP TABLE IF EXISTS `rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rewards` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numRewards` int(11) DEFAULT NULL,
  `numRewards7d` int(11) DEFAULT NULL,
  `numRewards30d` int(11) DEFAULT NULL,
  `valueUSD` double DEFAULT NULL,
  `valueUSD7d` double DEFAULT NULL,
  `valueUSD30d` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rewardslog`
--

DROP TABLE IF EXISTS `rewardslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rewardslog` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date NOT NULL,
  `numRewards` int(11) DEFAULT NULL,
  `valueUSD` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `specVersions`
--

DROP TABLE IF EXISTS `specVersions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `specVersions` (
  `chainID` int(11) NOT NULL,
  `specVersion` int(11) NOT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firstSeenDT` datetime DEFAULT NULL,
  `lastBlockNumber` int(11) DEFAULT '0',
  `metadata` mediumblob,
  PRIMARY KEY (`chainID`,`specVersion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subaccount`
--

DROP TABLE IF EXISTS `subaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subaccount` (
  `address` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parentKSM` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subNameKSM` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `talismanEndpoint`
--

DROP TABLE IF EXISTS `talismanEndpoint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `talismanEndpoint` (
  `paraID` int(11) NOT NULL,
  `relayChain` enum('polkadot','kusama','testnet') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainName` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coingeckoID` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prefix` int(11) DEFAULT NULL,
  `decimals` int(11) DEFAULT NULL,
  `symbol` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint2` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `WSEndpoint3` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`paraID`,`relayChain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `testParseTraces`
--

DROP TABLE IF EXISTS `testParseTraces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `testParseTraces` (
  `chainID` int(11) NOT NULL,
  `bn` int(11) NOT NULL,
  `blockHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `p` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `s` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `k` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `v` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `traceType` enum('subscribeStorage','state_traceBlock') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subscribeStorageParseV` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correctValue` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `testGroup` int(11) DEFAULT '1',
  `traceBlockV` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `traceBlockParseV` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pass` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`chainID`,`bn`,`s`,`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `token1155holder`
--

DROP TABLE IF EXISTS `token1155holder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `token1155holder` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenID` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  `metadata` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data` varchar(1204) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `free` float DEFAULT '0',
  PRIMARY KEY (`asset`,`chainID`,`holder`,`tokenID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tokenholder`
--

DROP TABLE IF EXISTS `tokenholder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tokenholder` (
  `asset` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainID` int(11) NOT NULL DEFAULT '0',
  `tokenID` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `holder` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `free` decimal(65,18) DEFAULT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `lastUpdateBN` int(11) DEFAULT '1',
  `lastCrawlBN` int(11) DEFAULT '1',
  `lastState` blob,
  `metadata` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` blob,
  `tokenURI` blob,
  PRIMARY KEY (`asset`,`chainID`,`tokenID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transfers`
--

DROP TABLE IF EXISTS `transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transfers` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numTransfers` int(11) DEFAULT NULL,
  `numTransfers7d` int(11) DEFAULT NULL,
  `numTransfers30d` int(11) DEFAULT NULL,
  `valueUSD` double DEFAULT NULL,
  `valueUSD7d` double DEFAULT NULL,
  `valueUSD30d` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transferslog`
--

DROP TABLE IF EXISTS `transferslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transferslog` (
  `chainID` int(11) NOT NULL,
  `section` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date NOT NULL,
  `numTransfers` int(11) DEFAULT '0',
  `valueUSD` double DEFAULT NULL,
  PRIMARY KEY (`chainID`,`section`,`method`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transfersrecent`
--

DROP TABLE IF EXISTS `transfersrecent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transfersrecent` (
  `extrinsicID` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logDT` date DEFAULT NULL,
  `hr` int(11) DEFAULT NULL,
  `chainID` int(11) DEFAULT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `extrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ts` int(11) DEFAULT NULL,
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rawAsset` varchar(127) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decimals` int(11) DEFAULT NULL,
  `amount` decimal(65,18) DEFAULT NULL,
  `rawAmount` decimal(65,18) DEFAULT NULL,
  `priceUSD` float DEFAULT '0',
  `amountUSD` float DEFAULT '0',
  PRIMARY KEY (`extrinsicID`),
  KEY `logDT` (`logDT`,`hr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `email` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(130) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createDT` datetime DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmlog`
--

DROP TABLE IF EXISTS `xcmlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmlog` (
  `chainID` int(11) NOT NULL,
  `chainIDDest` int(11) NOT NULL,
  `logDT` date NOT NULL,
  `numXCMTransfer` int(11) DEFAULT NULL,
  `amountSentUSD` float DEFAULT '0',
  `amountReceivedUSD` float DEFAULT '0',
  PRIMARY KEY (`chainID`,`chainIDDest`,`logDT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmmap`
--

DROP TABLE IF EXISTS `xcmmap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmmap` (
  `chainID` int(11) NOT NULL,
  `chainIDDest` int(11) NOT NULL,
  `concept` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assetChain` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdateDT` datetime DEFAULT NULL,
  `cnt` int(11) DEFAULT '0',
  PRIMARY KEY (`chainID`,`chainIDDest`,`concept`,`assetChain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmmessages`
--

DROP TABLE IF EXISTS `xcmmessages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmmessages` (
  `chainID` int(11) DEFAULT NULL,
  `chainIDDest` int(11) DEFAULT NULL,
  `incoming` int(11) NOT NULL,
  `msgHash` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `msgType` enum('dmp','hrmp','ump','unknown') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msgHex` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msgStr` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockTS` int(11) DEFAULT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `sentAt` int(11) DEFAULT NULL,
  `relayChain` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `path` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `potentialAssetChains` blob,
  `concept` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`msgHash`,`incoming`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmmessagesrecent`
--

DROP TABLE IF EXISTS `xcmmessagesrecent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmmessagesrecent` (
  `xcmID` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chainIDDest` int(11) DEFAULT NULL,
  `chainID` int(11) DEFAULT NULL,
  `msgType` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incoming` int(11) DEFAULT NULL,
  `msgHex` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msgHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msgStr` varchar(4096) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockTS` int(11) DEFAULT NULL,
  `blockNumber` int(11) DEFAULT NULL,
  `sentAt` int(11) DEFAULT NULL,
  `relayChain` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`xcmID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmtransfer`
--

DROP TABLE IF EXISTS `xcmtransfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmtransfer` (
  `extrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transferIndex` tinyint(4) NOT NULL DEFAULT '0',
  `xcmIndex` int(11) NOT NULL DEFAULT '0',
  `extrinsicID` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sectionMethod` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainID` int(11) NOT NULL,
  `paraID` int(11) DEFAULT NULL,
  `chainIDDest` int(11) NOT NULL,
  `paraIDDest` int(11) DEFAULT NULL,
  `blockNumber` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destAddress` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rawAsset` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeAssetChain` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blockNumberDest` int(11) DEFAULT NULL,
  `sourceTS` int(11) DEFAULT NULL,
  `destTS` int(11) DEFAULT NULL,
  `amountSent` decimal(65,18) DEFAULT NULL,
  `amountReceived` decimal(65,18) DEFAULT NULL,
  `amountSentUSD` float DEFAULT NULL,
  `amountReceivedUSD` float DEFAULT NULL,
  `priceUSD` float DEFAULT '0',
  `relayChain` enum('polkadot','kusama') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msgHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('NonFinalizedSource','FinalizedSource','NonFinalizedDest','FinalizedDest') COLLATE utf8mb4_unicode_ci DEFAULT 'NonFinalizedSource',
  `matched` tinyint(4) DEFAULT '0',
  `matchedEventID` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matchedExtrinsicID` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incomplete` tinyint(4) DEFAULT '0',
  `isFeeItem` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`extrinsicHash`,`transferIndex`,`xcmIndex`),
  KEY `sourceTS` (`sourceTS`),
  KEY `asset` (`asset`),
  KEY `chainIDDest` (`chainIDDest`),
  KEY `destAddress` (`destAddress`),
  KEY `matched` (`matched`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `xcmtransferdestcandidate`
--

DROP TABLE IF EXISTS `xcmtransferdestcandidate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `xcmtransferdestcandidate` (
  `eventID` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extrinsicID` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chainIDDest` int(11) NOT NULL,
  `fromAddress` varchar(67) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blockNumberDest` int(11) DEFAULT NULL,
  `asset` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rawAsset` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nativeAssetChain` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destTS` int(11) DEFAULT NULL,
  `amountReceived` decimal(65,18) DEFAULT NULL,
  `paraIDs` blob,
  `matched` tinyint(4) DEFAULT '0',
  `matchedExtrinsicHash` varchar(67) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`eventID`,`fromAddress`),
  KEY `destTS` (`destTS`),
  KEY `asset` (`destTS`),
  KEY `chainIDDest` (`chainIDDest`),
  KEY `fromAddress` (`fromAddress`),
  KEY `matched` (`matched`),
  KEY `extrinsicID` (`extrinsicID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- GTID state at the end of the backup 
--

SET @@GLOBAL.GTID_PURGED='7ce1b1ea-f5c8-11ec-b2f4-42010a000104:1-51214111';
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2022-07-10 10:34:00
