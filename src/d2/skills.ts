import * as types from "./types";
import { BitReader } from "../binary/bitreader";
import { BitWriter } from "../binary/bitwriter";

export async function readSkills(char: types.ID2S, reader: BitReader, constants: types.IConstantData) {
  char.skills = [] as types.ISkill[];
  const header = reader.ReadString(2); //0x0000 [skills header = 0x69, 0x66 "if"]
  if (header !== "if") {
    // header is not present in first save after char is created
    if (char.header.level === 1) {
      return; // TODO: return starter skills based on class
    }

    throw new Error(`Skills header 'if' not found at position ${reader.offset - 2 * 8}`);
  }
  if (constants.class_skills[constants.class_ids[char.header.class]].length !== constants.class_skills_count) throw new Error(`Skills broken due to skills.txt`);
  for (let i = 0; i < constants.class_skills_count; i++) {
    const skillInfo = constants.class_skills[constants.class_ids[char.header.class]][i];
    char.skills.push({
      id: skillInfo.id,
      points: reader.ReadUInt8(),
      name: skillInfo.s,
    } as types.ISkill);
  }
}

export async function writeSkills(char: types.ID2S, constants: types.IConstantData): Promise<Uint8Array> {
  const writer = new BitWriter();
  writer.WriteString("if", 2); //0x0000 [skills header = 0x69, 0x66 "if"]
  //probably array length checking/sorting of skills by id...
  for (let i = 0; i < constants.class_skills_count; i++) {
    writer.WriteUInt8(char.skills[i].points);
  }
  return writer.ToArray();
}
