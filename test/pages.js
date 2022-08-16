//run with: npx mocha test/pages.js

var isProduction = false
var endpoint = "http://kusama-internal.polkaholic.io:3001"
const request = require("supertest")(endpoint);
const {
    assert
} = require('chai')

describe("GET /account pagination", function() {
    this.timeout(30000);

    // extrinsics pagination test
    describe("GET /account/extrinsics/<address>", function() {
        let address = "0x2c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a47";
        it("returns specific account extrinsics", async function() {
            let nextPage = `/account/extrinsics/${address}?limit=1`
            let cnt = 0;
            do {
                const response = await request.get(nextPage);
                assert(response.status == 200, "account extrinsics");
                assert(response.body.data.length == 1, "length");
                assert(typeof response.body.data[0].extrinsicID == "string", "extrinsicID");
                nextPage = response.body.nextPage;
                console.log(cnt, response.body.data[0].extrinsicID, nextPage);
                cnt++;
            } while (nextPage);

            // asking for exactly that all at once should give us all the data obtained one by one
            let allPage = `/account/extrinsics/${address}?limit=${cnt}`
            response = await request.get(allPage);
            assert(response.status == 200, "account extrinsics");
            assert(response.body.data.length == cnt, "length check1");
            console.log(`passed check 1: expected ${cnt} extrinsic recs, got ${response.body.data.length}`);
            // asking for more than that shouldn't make a difference
            let allPagePlus1 = `/account/extrinsics/${address}?limit=${cnt+1}`
            response = await request.get(allPagePlus1);
            assert(response.status == 200, "account extrinsics");
            assert(response.body.data.length == cnt, "length check2");
            console.log(`passed check 2: expected ${cnt} extrinsic recs, got ${response.body.data.length}`);
        });
    });

    // transfers pagination test
    describe("GET /account/transfers/<address>", function() {
        let address = "0x2c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a47";
        it("returns specific account transfers", async function() {
            let nextPage = `/account/transfers/${address}?limit=1`
            let cnt = 0;
            do {
                const response = await request.get(nextPage);
                assert(response.status == 200, "account transfers");
                assert(response.body.data.length == 1, "length");
                assert(typeof response.body.data[0].eventID == "string", "eventID");
                nextPage = response.body.nextPage;
                console.log(cnt, nextPage, response.body.data[0].eventID);
                cnt++;
            } while (nextPage);

            // asking for exactly that all at once should give us all the data obtained one by one
            let allPage = `/account/transfers/${address}?limit=${cnt}`
            response = await request.get(allPage);
            assert(response.status == 200, "account transfers");
            assert(response.body.data.length == cnt, "length check1");
            console.log("passed check1");
            // asking for more than that shouldn't make a difference
            let allPagePlus1 = `/account/transfers/${address}?limit=${cnt+1}`
            response = await request.get(allPagePlus1);
            assert(response.status == 200, "account transfers");
            assert(response.body.data.length == cnt, "length check2");
            console.log("passed check2");
        });
    });

    // rewards pagination test
    describe("GET /account/rewards/<address>", function() {
        let address = "0x0008613991fac19927ac7d40cce798776444f09701a7fc9dd404afb6e2b69729";
        it("returns specific account rewards", async function() {
            let nextPage = `/account/rewards/${address}?limit=1`
            let cnt = 0;
            do {
                const response = await request.get(nextPage);
                assert(response.status == 200, "account rewards");
                assert(response.body.data.length == 1, "length");
                assert(typeof response.body.data[0].eventID == "string", "eventID");
                nextPage = response.body.nextPage;
                console.log(cnt, response.body.data[0].extrinsicID, nextPage);
                cnt++;
            } while (nextPage);

            // asking for exactly that all at once should give us all the data obtained one by one
            let allPage = `/account/rewards/${address}?limit=${cnt}`
            response = await request.get(allPage);
            assert(response.status == 200, "account rewards");
            assert(response.body.data.length == cnt, "length check1");
            console.log(`passed check 1: expected ${cnt} rewards recs, got ${response.body.data.length}`);
            // asking for more than that shouldn't make a difference
            let allPagePlus1 = `/account/rewards/${address}?limit=${cnt+1}`
            response = await request.get(allPagePlus1);
            assert(response.status == 200, "account rewards");
            console.log(`passed check 2: expected ${cnt} rewards recs, got ${response.body.data.length}`);
            assert(response.body.data.length == cnt, "length check2");
        });
    });

    // crowdloans pagination test
    describe("GET /account/crowdloans/<address>", function() {
        let address = "0x0008e21fa2c31e3f230bee099e44bb639a75f9caf9aa39b7b355488c5f275441";
        it("returns specific account crowdloans", async function() {
            let nextPage = `/account/crowdloans/${address}?limit=1`
            let cnt = 0;
            do {
                const response = await request.get(nextPage);
                assert(response.status == 200, "account crowdloans");
                assert(response.body.data.length == 1, "length");
                assert(typeof response.body.data[0].eventID == "string", "eventID");
                nextPage = response.body.nextPage;
                console.log(cnt, response.body.data[0].extrinsicID, nextPage);
                cnt++;
            } while (nextPage);

            // asking for exactly that all at once should give us all the data obtained one by one
            let allPage = `/account/crowdloans/${address}?limit=${cnt}`
            response = await request.get(allPage);
            assert(response.status == 200, "account crowdloans");
            assert(response.body.data.length == cnt, "length check1");
            console.log(`passed check 1: expected ${cnt} crowdloans recs, got ${response.body.data.length}`);
            // asking for more than that shouldn't make a difference
            let allPagePlus1 = `/account/crowdloans/${address}?limit=${cnt+1}`
            response = await request.get(allPagePlus1);
            assert(response.status == 200, "account crowdloans");
            console.log(`passed check 2: expected ${cnt} crowdloans recs, got ${response.body.data.length}`);
            assert(response.body.data.length == cnt, "length check2");
        });
    });

});