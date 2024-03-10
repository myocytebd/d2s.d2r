/**
 *  Copyright (C) 2024 myocytebd
 * 
 *  This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License
 *  as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *  This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 *  of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *  You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let testMod = process.argv[2] === 'mod';

let cfgStock = {
    txtDirs: [ '../../../d2r.modding/data.org/global/excel', ],
    jsonDirs: [ '../../../d2r.modding/data.org/local/lng/strings', ],
    saveDir: '../../../../users/ulp/Saved Games/Diablo II Resurrected',
    charaName: 'aaa',
};

let cfgMod = {
    txtDirs: [
        '../../mods/D2RMM/D2RMM.mpq/data/global/excel',
        '../../mods/data.input/excel.mod',
    ],
    jsonDirs: [
        '../../mods/D2RMM/D2RMM.mpq/data/local/lng/strings',
        '../../../d2r.modding/data.org/local/lng/strings',
    ],
    saveDir: '../../../../users/ulp/Saved Games/Diablo II Resurrected/mods/D2RMM',
    charaName: 'sandro',
};

const buffers = {};
for (let txt of [ 'CharStats', 'PlayerClass', 'SkillDesc', 'skills', 'RareSuffix', 'RarePrefix', 'MagicPrefix', 'MagicSuffix', 'Properties',
                  'ItemStatCost', 'Runes', 'SetItems', 'UniqueItems', 'ItemTypes', 'Armor', 'Weapons', 'Misc', 'Gems' ].map(s => s.toLowerCase())) {
    for (let txtDir of (testMod ? cfgMod : cfgStock).txtDirs) {
        let txtFile = path.join(txtDir, txt + '.txt');
        if (fs.existsSync(txtFile)) {
            buffers[txt + '.txt'] = fs.readFileSync(txtFile, 'utf-8');
            break;
        }
    }
}
for (let json of [ 'item-gems.json', 'item-modifiers.json', 'item-nameaffixes.json', 'item-names.json', 'item-runes.json', 'skills.json' ]) {
    for (let jsonDir of (testMod ? cfgMod : cfgStock).jsonDirs) {
        let jsonFile = path.join(jsonDir, json);
        if (fs.existsSync(jsonFile)) {
            buffers[json] = fs.readFileSync(jsonFile, 'utf-8');
            break;
        }
    }
}
console.log(Object.keys(buffers))

let d = require('.');
let cd = d.readConstantData(buffers);
console.debug(util.inspect(cd, { depth: null, maxArrayLength: null }));

function toHex(ivalue) {
    let sign = Math.sign(ivalue), ustr = Math.abs(ivalue).toString(16);
    return `${sign < 0 ? '-' : ''}0x${ustr.padStart((ustr.length + 1) & -2, '0')}`;
}

function diffBufferToConsole(buf0, buf1, desc = 'unk') {
    const cfgMaxDiffCount = 100;
    if (Buffer.compare(buf0, buf1) === 0) return;
    if (buf0.length !== buf1.length) console.warn(`diffBuffer-${desc}: size mismatch: ${buf0.length} vs ${buf1.length}`);
    let diffCount = 0, printedSize = false;
    for (let i = 0, len = Math.min(buf0.length, buf1.length); i < len; i++) {
        const shortPrintSlice = (buf, pos) => Buffer.from(buf.slice(pos, pos + Math.min(80, len))).toString('hex');
        if (buf0[i] !== buf1[i]) {
            if (!printedSize && buf0.length === buf1.length) {
                printedSize = true;
                console.info(`diffBuffer-${desc}: same size: ${buf0.length}`);
            }
            console.warn(`diffBuffer-${desc}: first byte diff at: ${i}/${toHex(i)}, ${buf0[i]} vs ${buf1[i]}`);
            console.warn(`diffBuffer-${desc}: src[${toHex(i)}]: ${shortPrintSlice(buf0, i)}}`);
            console.warn(`diffBuffer-${desc}: dst[${toHex(i)}]: ${shortPrintSlice(buf1, i)}}`);
            if (++diffCount >= cfgMaxDiffCount) break;
        }
    }
}

async function main() {
    let saveDir = (testMod ? cfgMod : cfgStock).saveDir;
    let charaName = (testMod ? cfgMod : cfgStock).charaName;
    {
        let orgCharaBuf = fs.readFileSync(path.join(saveDir, charaName + '.d2s'));
        globalThis.cs = await d.read(orgCharaBuf, cd);
        // console.debug(`character-${charaName}`, util.inspect(globalThis.cs, { depth: null, maxArrayLength: null }));
        fs.writeFileSync('chara_org.json', JSON.stringify(global.cs, null, 2), 'utf-8');
        let newCharaBuf = await d.write(globalThis.cs, cd);
        fs.writeFileSync('chara_new.json', JSON.stringify(await d.read(newCharaBuf, cd), null, 2), 'utf-8');
        diffBufferToConsole(orgCharaBuf, newCharaBuf, charaName);
        assert(Buffer.compare(orgCharaBuf, newCharaBuf) === 0); // fixme

        let orgCharaJsonStr = JSON.stringify(globalThis.cs);
        let newCharaBuf1 = await d.write(JSON.parse(orgCharaJsonStr), cd);
        assert(Buffer.compare(orgCharaBuf, newCharaBuf1) === 0);
    }
    if (d.readss) {
        let orgStashBuf = fs.readFileSync(path.join(saveDir, 'SharedStashSoftCoreV2.d2i'));
        globalThis.rs = await d.readss(orgStashBuf, cd);
        console.debug('shared-stash', util.inspect(globalThis.rs, { depth: null, maxArrayLength: null }));
        let newStashBuf = await d.write(globalThis.rs, cd);
        diffBufferToConsole(orgStashBuf, newStashBuf, 'SharedStashSoftCoreV2');
        assert(Buffer.compare(orgStashBuf, newStashBuf) === 0);

        let orgStashJsonStr = JSON.stringify(globalThis.rs);
        let newStashBuf1 = await d.write(JSON.parse(orgStashJsonStr), cd);
        assert(Buffer.compare(orgStashBuf, newStashBuf1) === 0);
    }
    console.info('DONE');
}
setImmediate(main);
