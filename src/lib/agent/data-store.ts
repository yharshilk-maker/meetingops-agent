import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.MEETINGOPS_DATA_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".meetingops");

export function dataPath(fileName: string) {
  return path.join(DATA_DIR, fileName);
}

export async function readJson<T>(fileName: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(dataPath(fileName), "utf8")) as T;
  } catch {
    return undefined;
  }
}

export async function writeJson(fileName: string, value: unknown) {
  const filePath = dataPath(fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), { mode: 0o600 });
}

export async function removeDataFile(fileName: string) {
  await rm(dataPath(fileName), { force: true });
}
