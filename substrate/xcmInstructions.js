module.exports = {
    getInstructionSet: function() {
        let instructionSet = {
            'withdrawAsset': { // Remove the on-chain asset(s) (assets) and accrue them into Holding
                MultiAssets: ['assets'],
                MultiAssetFilter: ['assets'], //v0
                Effects: ['effects'], //v0
		model: {
		    "kusama": {
			refTime: 20385000,
			reads: 1,
			writes: 1
		    }
		}
            },
            'reserveAssetDeposited': { // Accrue into Holding derivative assets to represent the asset(s) (assets) on Origin.
                MultiAssets: ['assets'],
		model: {
		    "kusama": {
			refTime: 2000000000000
		    }
		}
            },
            'receiveTeleportedAsset': {
                MultiAssets: ['assets'],
		model: {
		    "kusama": {
			refTime: 19595000,
			reads: 1,
			writes: 1
		    }
		}
            },
            'queryResponse': {
		model: {
		    "moonbeam": {
			refTime: 24677000,
			reads: 1,
		    }
		}
	    },
            'transferAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
		model: {
		    "kusama": {
			refTime: 3275600,
			reads: 2,
			writes: 2
		    }
		}
            },
            'transferReserveAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm'],
		model: {
		    "kusama": {
			refTime: 50645000,
			reads: 8,
			writes: 5
		    }
		}
            },
            'transact': {
                Call: ['call'],
		model: {
		    "moonbeam": {
			refTime: 31_693_000,
			reads: 1,
		    }
		}
            },
            'hrmpNewChannelOpenRequest': {},
            'hrmpChannelAccepted': {},
            'hrmpChannelClosing': {},
            'clearOrigin': {
	    	model: {
                    "moonbeam": {
                        refTime: 8268000,
                    }
		}
	    },
            'descendOrigin': {
		model: {
                    "moonbeam": {
                        refTime: 9620000,
                    }
		}
	    },
            'reportError': {
		model: {
                    "moonbeam": {
                        refTime: 24787000,
			reads: 5,
			writes: 2
                    }
		}
	    },
            'depositAsset': { // Subtract the asset(s) (assets) from Holding and deposit on-chain equivalent assets under the ownership of beneficiary.
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
		refTime: 21763000,
		reads: 1,
		writes: 1,
            },
            'depositReserveAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
                XCM: ['xcm'],
		refTime: 40930000,
		reads: 7,
		writes: 4,
            },
            'exchangeAsset': {
                MultiAssetFilter: ['give'],
                MultiAssets: ['receive']
            },
            'initiateReserveWithdraw': {
                MultiAssetFilter: ['assets'],
                XCM: ['xcm'],
		model: {
		    "moonbeam": {
			refTime: 465091000,
			reads: 5,
			writes: 2,
		    }
		}
            },
            'initiateTeleport': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm'],
		model: {
		    "kusama": {
			refTime: 40788000,
			reads: 7,
			writes: 4
		    }
		}
            },
            'queryHolding': {
                MultiLocation: ['destination'],
                MultiAssetFilter: ['assets'],
		model: {
		    "moonbeam": {
			refTime: 392_845_000,
			reads: 5,
			writes: 2
		    }
		}
            },
            'buyExecution': { //Pay for the execution of the current message from Holding.
                MultiAsset: ['fees'],
		model: {
		    "moonbeam": {
			refTime: 130_464_000,
			reads: 4
		    }
		}
            },
            'refundSurplus': {
		model: {
		    "moonbeam": {
			refTime: 25506000,
		    }
		}
	    },
            'setErrorHandler': {
		model: {
		    "moonbeam": {
			refTime: 8089000,
		    }
		}
	    },
            'setAppendix': {
		model: {
		    "moonbeam": {
			refTime: 8110000,
		    }
		}
	    },
            'clearError': {
		model: {
		    "moonbeam": {
			refTime: 8222000,
		    }
		}
	    },
            'claimAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['ticket'],
		model: {
                    "moonbeam": {
                        refTime: 17798000,
			reads: 1,
			writes: 1
                    }
                }
            },
            'trap': {
		model: {
                    "moonbeam": {
                        refTime: 8424000,
                    }
                }
	    },
            'subscribeVersion': {
		model: {
                    "moonbeam": {
                        refTime: 30_071_000,
			reads: 6,
			writes: 3,
                    }
                }
	    },
            'unsubscribeVersion': {
		model: {
                    "moonbeam": {
                        refTime: 12_915_000,
			writes: 1,
                    }
                }
	    },
            'burnAsset': {
                MultiAsset: ['assets']
            },
            'expectAsset': {
                MultiAsset: ['assets']
            },
            'expectOrigin': {
                MultiLocation: ['origin']
            },
            'expectError': {},
            //V1
            'reserveAssetDeposited': {
                MultiAssetFilter: ['assets'],
                Effects: ['effects'],
		refTime: 2000000000000,
            },
            //V0
            'teleportAsset': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
            },
            'reserveAssetDeposit': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
		refTime: 2000000000000,
            }
        }
        return instructionSet
    }
}
