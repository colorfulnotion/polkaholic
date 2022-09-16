const { ethers } = require('ethers');
const { Address }  = require('cluster');
const  fs   = require('fs');


async function main() {
    const stellaRouter = JSON.parse(fs.readFileSync("stella.js"));
    const solarflareRouter = JSON.parse(fs.readFileSync("solarflare.js"));

    const routes = {
    "Stella LP": [
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x87894a4dd3228abcb1891795fd4d7c3719636220",
            "0xbd174c9d2a564b2eb187bd6556ae1d12256d5add",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xfa9343c3897324496a05fc75abed6bac29f8a40f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xfa9343c3897324496a05fc75abed6bac29f8a40f",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x46fa30c4f9a1350f7ae69a04c8c80fc457ba71cb",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x3795c36e7d12a8c252a20c5a7b455f7c57b60283",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x3d632d9e1a60a0880dd45e61f279d919b5748377",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x3405a1bd46b85c5c029483fbecf2f3e611026e45",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x765277eebeca2e31912c9946eae1021199b39c61",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x511ab53f793683763e5a8829738301368a2411e3",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x3d632d9e1a60a0880dd45e61f279d919b5748377",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0x3405a1bd46b85c5c029483fbecf2f3e611026e45",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xbd174c9d2a564b2eb187bd6556ae1d12256d5add",
            "0x87894a4dd3228abcb1891795fd4d7c3719636220",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xfa9343c3897324496a05fc75abed6bac29f8a40f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0x27292cf0016e5df1d8b37306b2a98588acbd6fca",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0xfa9343c3897324496a05fc75abed6bac29f8a40f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x46fa30c4f9a1350f7ae69a04c8c80fc457ba71cb",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x511ab53f793683763e5a8829738301368a2411e3",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xc9baa8cfdde8e328787e29b4b078abf2dadc2055",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x765277eebeca2e31912c9946eae1021199b39c61",
            "0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x2dfc76901bb2ac2a5fa5fc479590a490bbb10a5f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x3795c36e7d12a8c252a20c5a7b455f7c57b60283",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xffffffff52c56a9257bb97f4b2b6f7b2d624ecda",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xffffffff52c56a9257bb97f4b2b6f7b2d624ecda",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xffffffff1fcacbd218edc0eba20fc2308c778080",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0xa649325aa7c5093d12d6f98eb4378deae68ce23f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x27292cf0016e5df1d8b37306b2a98588acbd6fca",
            "0x8f552a71efe5eefc207bf75485b356a0b3f01ec9",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ]
    ],
    "Uniswap V2": [
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe6a991ffa8cfe62b0bf6bf72959a3d4f11b2e0f5",
            "0xbd2949f67dcdc549c6ebe98696449fa79d988a9f",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xbd2949f67dcdc549c6ebe98696449fa79d988a9f",
            "0xe6a991ffa8cfe62b0bf6bf72959a3d4f11b2e0f5",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ]
    ],
    "Flare LP Token": [
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0x08c98ad2d4856bec0a0eaf18c2a06e7201613f90",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0x31dab3430f3081dff3ccd80f17ad98583437b213",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xb60590313975f0d98821b6cab5ea2a6d9641d7b6",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0x0db6729c03c85b0708166ca92801bcb5cac781fc",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0db6729c03c85b0708166ca92801bcb5cac781fc",
            "0x08c98ad2d4856bec0a0eaf18c2a06e7201613f90",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x0db6729c03c85b0708166ca92801bcb5cac781fc",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x8e70cd5b4ff3f62659049e74b6649c6603a0e594",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0xb60590313975f0d98821b6cab5ea2a6d9641d7b6",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x08c98ad2d4856bec0a0eaf18c2a06e7201613f90",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x08c98ad2d4856bec0a0eaf18c2a06e7201613f90",
            "0x0db6729c03c85b0708166ca92801bcb5cac781fc",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x31dab3430f3081dff3ccd80f17ad98583437b213",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0x8e70cd5b4ff3f62659049e74b6649c6603a0e594",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ],
        [
            "0xacc15dc74880c9944775448304b263d191c6077f",
            "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "0xe3e43888fa7803cdc7bea478ab327cf1a0dc11a7",
            "0xacc15dc74880c9944775448304b263d191c6077f"
        ]
    ]
    };
    
    const providerRPC = {
	moonbeam: {
	    name: 'moonbeam',
	    rpc: 'http://moonbeam-internal.polkaholic.io:9100',
	    chainId: 1284, // 0x504 in hex,
	},
    };
    
    const provider = new ethers.providers.JsonRpcProvider(
	providerRPC.moonbeam.rpc, 
	{
	    chainId: providerRPC.moonbeam.chainId,
	    name: providerRPC.moonbeam.name,
	}
    );
    const pk = await fs.readFileSync("/root/.walletevm2")
    let prk = pk.toString();
    console.log(prk);
    const account_from = {
	privateKey: prk
    };

    let wallet = new ethers.Wallet(account_from.privateKey, provider);
    const stellaContract = new ethers.Contract('0x70085a09D30D6f8C4ecF6eE10120d1847383BB57', stellaRouter, wallet);
    let stellaPaths = routes["Stella LP"];
    for ( const path of stellaPaths ) {
	try {
	    const q = await stellaContract.getAmountsOut(1000000000000000000n, path);
	    let result = q.toString().split(",");
	    let last = result[result.length-1] / 10 ** 18;
	    if ( last > .90) console.log("STELLA", path, last);
	} catch (err) {
	    
	}
    }
    let nm = "Flare LP Token";
    const solarflareContract = new ethers.Contract('0xd3b02ff30c218c7f7756ba14bca075bf7c2c951e', solarflareRouter, wallet);
    let solarflarePaths = routes[nm];
    for ( const path of solarflarePaths ) {
	try {
	    const q = await solarflareContract.getAmountsOut(1000000000000000000n, path);
	    let result = q.toString().split(",");
	    let last = result[result.length-1] / 10 ** 18;
	    if ( last > .90) console.log(nm, path, last);
	} catch (err) {
	    
	}
    }
    process.exit(0);
    let addr = "0xeaf3223589ed19bcd171875ac1d0f99d31a5969c";
    let deadline = 1663357697+86400;
    let amountOutMin = 200;
    
    let value = "123450000000000000";  // .12345 GLMR
    const gasEst = await stellaContract.estimateGas.swapExactETHForTokens(amountOutMin, path, addr, deadline, { value });
    let gasLimit = gasEst.mul(150).div(100).toString();
    console.log("gasLimit", gasLimit);
    const receipt = await stellaContract.swapExactETHForTokens(amountOutMin, path, addr, deadline, { value, gasLimit });
    console.log(receipt)
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
