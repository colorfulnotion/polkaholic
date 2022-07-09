// Copyright 2018-2021 @polkadot/ui-shared authors & contributors
// SPDX-License-Identifier: Apache-2.0
const {
    Keyring,
    decodeAddress,
    encodeAddress
} = require("@polkadot/keyring");

"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.polkadotIcon = void 0;
var util_crypto_1 = require("@polkadot/util-crypto");
var blake2 = function(value) {
    return util_crypto_1.blake2AsU8a(value, 512);
};
var S = 64;
var C = S / 2;
var Z = S / 64 * 5;
var ZERO = blake2(new Uint8Array(32));
/* eslint-disable sort-keys */
var SCHEMA = {
    target: {
        colors: [0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 1],
        freq: 1
    },
    cube: {
        colors: [0, 1, 3, 2, 4, 3, 0, 1, 3, 2, 4, 3, 0, 1, 3, 2, 4, 3, 5],
        freq: 20
    },
    quazar: {
        colors: [1, 2, 3, 1, 2, 4, 5, 5, 4, 1, 2, 3, 1, 2, 4, 5, 5, 4, 0],
        freq: 16
    },
    flower: {
        colors: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 3],
        freq: 32
    },
    cyclic: {
        colors: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 6],
        freq: 32
    },
    vmirror: {
        colors: [0, 1, 2, 3, 4, 5, 3, 4, 2, 0, 1, 6, 7, 8, 9, 7, 8, 6, 10],
        freq: 128
    },
    hmirror: {
        colors: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 6, 7, 5, 3, 4, 2, 11],
        freq: 128
    }
};
/* eslint-enable sort-keys */
var OUTER_CIRCLE = {
    cx: C,
    cy: C,
    fill: '#eee',
    r: C
};

function getRotation(isSixPoint) {
    var r = isSixPoint ?
        (C / 8 * 5) :
        (C / 4 * 3);
    var rroot3o2 = r * Math.sqrt(3) / 2;
    var ro2 = r / 2;
    var rroot3o4 = r * Math.sqrt(3) / 4;
    var ro4 = r / 4;
    var r3o4 = r * 3 / 4;
    return {
        r: r,
        r3o4: r3o4,
        ro2: ro2,
        ro4: ro4,
        rroot3o2: rroot3o2,
        rroot3o4: rroot3o4
    };
}

function getCircleXY(isSixPoint) {
    var _a = getRotation(isSixPoint),
        r = _a.r,
        r3o4 = _a.r3o4,
        ro2 = _a.ro2,
        ro4 = _a.ro4,
        rroot3o2 = _a.rroot3o2,
        rroot3o4 = _a.rroot3o4;
    return [
        [C, C - r],
        [C, C - ro2],
        [C - rroot3o4, C - r3o4],
        [C - rroot3o2, C - ro2],
        [C - rroot3o4, C - ro4],
        [C - rroot3o2, C],
        [C - rroot3o2, C + ro2],
        [C - rroot3o4, C + ro4],
        [C - rroot3o4, C + r3o4],
        [C, C + r],
        [C, C + ro2],
        [C + rroot3o4, C + r3o4],
        [C + rroot3o2, C + ro2],
        [C + rroot3o4, C + ro4],
        [C + rroot3o2, C],
        [C + rroot3o2, C - ro2],
        [C + rroot3o4, C - ro4],
        [C + rroot3o4, C - r3o4],
        [C, C]
    ];
}

function findScheme(d) {
    var cum = 0;
    var schema = Object.values(SCHEMA).find(function(schema) {
        cum += schema.freq;
        return d < cum;
    });
    if (!schema) {
        throw new Error('Unable to find schema');
    }
    return schema;
}

function addressToId(address) {
    return blake2(util_crypto_1.decodeAddress(address)).map(function(x, i) {
        return (x + 256 - ZERO[i]) % 256;
    });
}

function getColors(address) {
    var total = Object.values(SCHEMA).map(function(s) {
        return s.freq;
    }).reduce(function(a, b) {
        return a + b;
    });
    var id = addressToId(address);
    var d = Math.floor((id[30] + id[31] * 256) % total);
    var rot = (id[28] % 6) * 3;
    var sat = (Math.floor(id[29] * 70 / 256 + 26) % 80) + 30;
    var scheme = findScheme(d);
    var palette = Array.from(id).map(function(x, i) {
        var b = (x + i % 28 * 58) % 256;
        if (b === 0) {
            return '#444';
        } else if (b === 255) {
            return 'transparent';
        }
        var h = Math.floor(b % 64 * 360 / 64);
        var l = [53, 15, 35, 75][Math.floor(b / 64)];
        return "hsl(" + h + ", " + sat + "%, " + l + "%)";
    });
    return scheme.colors.map(function(_, i) {
        return palette[scheme.colors[i < 18 ? (i + rot) % 18 : 18]];
    });
}
/**
 * @description Generate a array of the circles that make up an identicon
 */
function polkadotIcon(address, isAlternative = true) {
    var colors = getColors(address);
    return [OUTER_CIRCLE].concat(getCircleXY(isAlternative).map(function(_a, index) {
        var cx = _a[0],
            cy = _a[1];
        return ({
            cx: Math.round(cx),
            cy: Math.round(cy),
            fill: colors[index],
            r: Z
        });
    }));
}

module.exports = {
    generateIdenticon: function(address, isAlternative = true, size = 64) {
        const circles = polkadotIcon(address, isAlternative).map(({
                cx,
                cy,
                fill,
                r
            }) =>
            `<circle cx="${cx}" cy="${cy}" fill="${fill}" r="${r}"/>`
        ).join('');
        return `<svg  version="1.1" xmlns="http://www.w3.org/2000/svg" height="${size}" viewBox='0 0 64 64' width="${size}">${circles}</svg>`;
    }
}