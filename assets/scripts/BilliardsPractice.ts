export type AIDifficulty='easy'|'standard'|'hard';
export type MatchMode='local'|'ai';
export const DIFFICULTY_NAMES:Readonly<Record<AIDifficulty,string>>={easy:'入门',standard:'标准',hard:'挑战'};
export const PRACTICE_KEY='eight-club.practice.v1';
export interface PracticePreference {mode:MatchMode;difficulty:AIDifficulty;}
interface Storage {getItem(k:string):string|null;setItem(k:string,v:string):void;}
export function isDifficulty(value:unknown):value is AIDifficulty{return value==='easy'||value==='standard'||value==='hard';}
export class PracticeStore {
 value:PracticePreference={mode:'ai',difficulty:'standard'};persistent=true;
 constructor(private storage?:Storage){try{const d=JSON.parse(storage?.getItem(PRACTICE_KEY)??'null');if(d?.version===1){if(d.mode==='local'||d.mode==='ai')this.value.mode=d.mode;if(isDifficulty(d.difficulty))this.value.difficulty=d.difficulty;}}catch{this.persistent=false;}}
 set(value:Partial<PracticePreference>):void {
  const next={...this.value};if(value.mode==='local'||value.mode==='ai')next.mode=value.mode;if(isDifficulty(value.difficulty))next.difficulty=value.difficulty;this.value=next;
  try{this.storage?.setItem(PRACTICE_KEY,JSON.stringify({version:1,...next}));}catch{this.persistent=false;}
 }
}
