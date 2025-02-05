import * as types from "./types";
import { readHeader, readHeaderData, writeHeader, writeHeaderData, fixHeader, readPageHeader, writePageHeader, fixPageHeader } from "./header";
import { readAttributes, writeAttributes } from "./attributes";
import { BitReader } from "../binary/bitreader";
import { BitWriter } from "../binary/bitwriter";
import { readSkills, writeSkills } from "./skills";
import * as items from "./items";
import { getConstantData } from "./constants";
import { enhanceAttributes, enhanceItems } from "./attribute_enhancer";
import { strict as assert } from "assert";

const defaultConfig = {
  extendedStash: false,
  sortProperties: true,
} as types.IConfig;

function reader(buffer: Uint8Array) {
  return new BitReader(buffer);
}

async function read(buffer: Uint8Array, constants?: types.IConstantData, userConfig?: types.IConfig): Promise<types.ID2S> {
  const char = { type: 'd2s' } as types.ID2S;
  const reader = new BitReader(buffer);
  const config = Object.assign(defaultConfig, userConfig);
  await readHeader(char, reader);
  //could load constants based on version here
  if (!constants) {
    constants = getConstantData(char.header.version);
  }
  await readHeaderData(char, reader, constants);
  await readAttributes(char, reader, constants);
  await readSkills(char, reader, constants);
  await items.readCharItems(char, reader, constants, config);
  await items.readCorpseItems(char, reader, constants, config);
  if (char.header.status.expansion) {
    await items.readMercItems(char, reader, constants, config);
    await items.readGolemItems(char, reader, constants, config);
  }
  // await enhanceAttributes(char, constants, config);
  return char;
}

async function readss(buffer: Uint8Array, constants?: types.IConstantData, userConfig?: types.IConfig): Promise<types.ID2I> {
  const stash = { type: 'd2i', pages: [] } as types.ID2I;
  const reader = new BitReader(buffer);
  const config = Object.assign(defaultConfig, userConfig);
  let pageOffset = reader.offset;
  while (!reader.TestEOS()) {
    if (stash.pages.length > 0 && pageOffset + stash.pages.at(-1)!.header.size * 8 !== reader.offset)
        throw new Error(`D2I stash page size mismatch: ${pageOffset}b + ${stash.pages.at(-1)!.header.size}B vs ${reader.offset}b`);
    pageOffset = reader.offset;
    const page = {} as types.ID2IPage;
    readPageHeader(page, reader);
    if (!constants) constants = getConstantData(page.header.version);
    stash.pages.push(page);
    page.items = await items.readItems(reader, page.header.version, constants, config);
  }
  return stash;
}

async function readItem(
  buffer: Uint8Array,
  version: number,
  constants?: types.IConstantData,
  userConfig?: types.IConfig
): Promise<types.IItem> {
  const reader = new BitReader(buffer);
  const config = Object.assign(defaultConfig, userConfig);
  if (!constants) {
    constants = getConstantData(version);
  }
  const item = await items.readItem(reader, version, constants, config);
  await enhanceItems([item], constants);
  return item;
}

function writer(buffer: Uint8Array) {
  return new BitWriter();
}

async function write(varData: types.ID2S|types.ID2I, constants?: types.IConstantData, userConfig?: types.IConfig): Promise<Uint8Array> {
  if (varData.type === 'd2i' || varData.type === undefined) return writess(<types.ID2I>varData, constants, userConfig);
  const data = varData as types.ID2S;
  const config = Object.assign(defaultConfig, userConfig);
  const writer = new BitWriter();
  writer.WriteArray(await writeHeader(data));
  if (!constants) {
    constants = getConstantData(data.header.version);
  }
  writer.WriteArray(await writeHeaderData(data, constants));
  writer.WriteArray(await writeAttributes(data, constants));
  writer.WriteArray(await writeSkills(data, constants));
  writer.WriteArray(await items.writeCharItems(data, constants, config));
  writer.WriteArray(await items.writeCorpseItem(data, constants, config));
  if (data.header.status.expansion) {
    writer.WriteArray(await items.writeMercItems(data, constants, config));
    writer.WriteArray(await items.writeGolemItems(data, constants, config));
  }
  await fixHeader(writer);
  return writer.ToArray();
}

async function writess(stash: types.ID2I, constants?: types.IConstantData, userConfig?: types.IConfig): Promise<Uint8Array> {
  assert.strictEqual(stash.type, 'd2i');
  const config = Object.assign(defaultConfig, userConfig);
  if (!constants) constants = getConstantData(stash.pages[0].header.version);
  const writer = new BitWriter();
  for (let page of stash.pages) {
    let pageOffset = writer.offset;
    writer.WriteArray(writePageHeader(page, constants));
    writer.WriteArray(await items.writeItems(page.items, page.header.version, constants, config));
    fixPageHeader(writer, pageOffset);
  }
  return writer.ToArray();
}

async function writeItem(
  item: types.IItem,
  version: number,
  constants?: types.IConstantData,
  userConfig?: types.IConfig
): Promise<Uint8Array> {
  const config = Object.assign(defaultConfig, userConfig);
  const writer = new BitWriter();
  if (!constants) {
    constants = getConstantData(version);
  }
  writer.WriteArray(await items.writeItem(item, version, constants, config));
  return writer.ToArray();
}

export { reader, writer, read, write, readItem, writeItem, readss, writess, };
