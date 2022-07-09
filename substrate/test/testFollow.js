#!/usr/bin/env node
 // Usage:  getAccount account dataGroup
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    // follow 2 accounts (fill in)
    let fromAddress = "";
    let toAddress = "";
    let toAddress2 = "";
    await query.followUser(fromAddress, toAddress);
    await query.followUser(fromAddress, toAddress2);
    let isFollowing = await query.isFollowing(fromAddress, toAddress);
    let isFollowing2 = await query.isFollowing(fromAddress, toAddress2);
    console.log("after follow-isFollowing", isFollowing, isFollowing2)
    let followers = await query.getFollowers(toAddress);
    console.log("after follow-followers", followers)
    let following = await query.getFollowing(fromAddress);
    console.log("after follow-following", following)

    let feed = await query.getAccountFeed(fromAddress, "feed");
    console.log("after follow-feed", feed.data.length)

    // unfollow 2 accounts
    await query.unfollowUser(fromAddress, toAddress);
    await query.unfollowUser(fromAddress, toAddress2);
    isFollowing = await query.getFollowers(fromAddress, toAddress);
    isFollowing2 = await query.getFollowers(fromAddress, toAddress2);
    console.log("after unfollow-isFollowing", isFollowing, isFollowing2)

    // this should be 0
    followers = await query.getFollowers(toAddress);
    console.log("after unfollow-followers", followers)

    // this should be 0
    following = await query.getFollowing(fromAddress);
    console.log("after unfollow-following", following)

    // this should be 0
    feed = await query.getAccountFeed(fromAddress, "feed");
    console.log("after unfollow-feed", feed.data.length)
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });