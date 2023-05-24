const PolkaholicDB = require("./polkaholicDB");
const {
    AnalyticsHubServiceClient
} = require('@google-cloud/bigquery-data-exchange').v1beta1;

module.exports = class Analytics extends PolkaholicDB {
    dataexchangeClient = null;

    constructor() {
        super("manager")
        this.dataexchangeClient = new AnalyticsHubServiceClient();
    }

    async function createDataExchange(parent, dataExchangeId, dataExchange) {
        const request = {
            parent,
            dataExchangeId,
            dataExchange
        };
        const response = await this.dataexchangeClient.createDataExchange(request);
        console.log(response);
    }

    async function createListing(parent, listingId, listing) {
        const request = {
            parent,
            listingId,
            listing
        };
        const response = await this.dataexchangeClient.createListing(request);
        console.log(response);
    }

    async function getDataExchange(name) {
        const request = {
            name,
        };
        const response = await this.dataexchangeClient.getDataExchange(request);
        console.log(response);
    }

    async function getListing(name) {
        const request = {
            name,
        };

        const response = await this.dataexchangeClient.getListing(request);
        console.log(response);
    }

    async function listDataExchanges(parent) {
        const request = {
            parent,
        };
        const iterable = await dataexchangeClient.listDataExchangesAsync(request);
        for await (const response of iterable) {
            console.log(response);
        }
    }
}