import { z } from 'zod';
import { ErrandList, type Errand } from '../systems/errands';
import { MinigameList, type MinigameDef } from '../systems/minigames';
import { MissionList, type Mission } from '../systems/missions';
import errandsRaw from './errands.json';
import minigamesRaw from './minigames.json';
import missionsRaw from './missions.json';
import voiceRaw from './voice.json';

export const VoiceLines = z.record(z.string(), z.string().min(1));
export type VoiceLines = z.infer<typeof VoiceLines>;

export interface Content {
  missions: Mission[];
  errands: Errand[];
  minigames: MinigameDef[];
  voice: VoiceLines;
}

function parse<T>(name: string, schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new Error(
      `Invalid ${name}:\n${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return r.data;
}

/** Load and validate all JSON content (throws a readable error on broken content). */
export function loadContent(): Content {
  return {
    missions: parse('missions.json', MissionList, missionsRaw),
    errands: parse('errands.json', ErrandList, errandsRaw),
    minigames: parse('minigames.json', MinigameList, minigamesRaw),
    voice: parse('voice.json', VoiceLines, voiceRaw),
  };
}
