import * as types from "./types";
import { BitReader } from "../binary/bitreader";
import { BitWriter } from "../binary/bitwriter";
import { strict as assert } from "assert";

export async function readHeader(char: types.ID2S, reader: BitReader) {
  char.header = {} as types.IHeader;
  //0x0000
  char.header.identifier = reader.ReadUInt32().toString(16).padStart(8, "0");
  if (char.header.identifier != "aa55aa55") {
    throw new Error(`D2S identifier 'aa55aa55' not found at position ${reader.offset - 4 * 8}`);
  }
  //0x0004
  char.header.version = reader.ReadUInt32();
}

export async function readHeaderData(char: types.ID2S, reader: BitReader, constants: types.IConstantData) {
  const v = await _versionSpecificHeader(char.header.version);
  if (v == null) {
    throw new Error(`Cannot parse version: ${char.header.version}`);
  }
  v.readHeader(char, reader, constants);
}

export async function writeHeader(char: types.ID2S): Promise<Uint8Array> {
  const writer = new BitWriter();
  writer.WriteUInt32(parseInt(char.header.identifier, 16)).WriteUInt32(char.header.version);

  return writer.ToArray();
}

export async function writeHeaderData(char: types.ID2S, constants: types.IConstantData): Promise<Uint8Array> {
  const writer = new BitWriter();
  const v = await _versionSpecificHeader(char.header.version);
  if (v == null) {
    throw new Error(`Cannot parse version: ${char.header.version}`);
  }
  v.writeHeader(char, writer, constants);

  return writer.ToArray();
}

export function readPageHeader(page: types.ID2IPage, reader: BitReader) {
  page.header = {} as types.IPageHeader;
  //0x0000
  page.header.identifier = reader.ReadUInt32().toString(16).padStart(8, "0");
  if (page.header.identifier != "aa55aa55") {
    throw new Error(`D2I identifier 'aa55aa55' not found at position ${reader.offset - 4 * 8}`);
  }
  //0x0004
  page.header.unk_04 = reader.ReadUInt32();
  //0x0008
  page.header.version = reader.ReadUInt32();
  assert(page.header.version >= 97);
  if (page.header.version > 99) throw new Error(`D2I version unsupported: ${page.header.version}`);
  //0x000c
  page.header.gold = reader.ReadUInt32();
  //0x0010
  page.header.size = reader.ReadUInt32();
  //0x0014
  reader.SkipBytes(44);
  //0x0040
}

export function writePageHeader(page: types.ID2IPage, constants: types.IConstantData): Uint8Array {
  const writer = new BitWriter();
  //0x0000
  writer.WriteUInt32(parseInt(page.header.identifier, 16));
  //0x0004
  writer.WriteUInt32(page.header.unk_04);
  //0x0008
  writer.WriteUInt32(page.header.version);
  //0x000c
  writer.WriteUInt32(page.header.gold);
  //0x0010
  writer.WriteUInt32(0);  // page.header.size
  //0x0014
  writer.WriteBytes(new Uint8Array(44));
  //0x0040

  return writer.ToArray();
}

export function fixPageHeader(writer: BitWriter, pageOffset: number) {
  assert(Number.isInteger(writer.offset / 8));
  assert(Number.isInteger(pageOffset / 8));
  let size = (writer.offset - pageOffset) / 8, pos = writer.offset;
  //0x0010 page.header.size
  writer.SeekByte(pageOffset / 8 + 0x0010).WriteUInt32(size).SeekBit(pos);
}

export async function fixHeader(writer: BitWriter) {
  let checksum = 0;
  const eof = writer.length / 8;
  writer.SeekByte(0x0008).WriteUInt32(eof);
  writer.SeekByte(0x000c).WriteUInt32(0);
  for (let i = 0; i < eof; i++) {
    let byte = writer.SeekByte(i).PeekBytes(1)[0];
    if (checksum & 0x80000000) {
      byte += 1;
    }
    checksum = byte + checksum * 2;
    //hack make it a uint32
    checksum >>>= 0;
  }
  //checksum pos
  writer.SeekByte(0x000c).WriteUInt32(checksum);
}

/**
 * Save Version
 * 0x47, 0x0, 0x0, 0x0 = <1.06
 * 0x59, 0x0, 0x0, 0x0 = 1.08 = version
 * 0x5c, 0x0, 0x0, 0x0 = 1.09 = version
 * 0x60, 0x0, 0x0, 0x0 = 1.13c = version
 * 0x62, 0x0, 0x0, 0x0 = 1.2 = version
 * */
async function _versionSpecificHeader(version: number) {
  switch (version) {
    case 0x60: {
      return await import(`./versions/default_header`);
    }
    default: {
      return await import(`./versions/default_header`);
    }
  }
}
