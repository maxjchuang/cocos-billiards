/** Pure settings/state logic. Storage and feedback are injectable platform boundaries. */
export interface GameSettings { sound:boolean; haptics:boolean; aimGuide:boolean; magnifier:boolean; reducedMotion:boolean; }
export type SettingKey=keyof GameSettings;
export const SETTINGS_DEFAULTS:Readonly<GameSettings>=Object.freeze({sound:true,haptics:false,aimGuide:true,magnifier:true,reducedMotion:false});
export const SETTINGS_KEY='eight-club.settings.v1';
export interface SettingsStorage { getItem(key:string):string|null; setItem(key:string,value:string):void; }
export class SettingsStore {
    value:GameSettings={...SETTINGS_DEFAULTS};
    persistent=true;
    constructor(private storage?:SettingsStorage){
        try {const data=JSON.parse(storage?.getItem(SETTINGS_KEY)??'null');
            if(data?.version===1)for(const k of Object.keys(SETTINGS_DEFAULTS) as SettingKey[])if(typeof data[k]==='boolean')this.value[k]=data[k];
        } catch {this.persistent=false;}
    }
    set(key:SettingKey,value:boolean):void {
        this.value={...this.value,[key]:value};
        try{this.storage?.setItem(SETTINGS_KEY,JSON.stringify({version:1,...this.value}));}catch{this.persistent=false;}
    }
    toggle(key:SettingKey):void{this.set(key,!this.value[key]);}
}
export interface HistoryEntry { shotId:number;player:number; reason:string; phase:string; winner:number|null; }
export class MatchHistory {
    entries:HistoryEntry[]=[];
    private stamp='';
    record(entry:HistoryEntry):boolean {
        const stamp=JSON.stringify(entry);if(stamp===this.stamp)return false;
        this.stamp=stamp;this.entries.push({...entry});return true;
    }
    reset():void{this.entries=[];this.stamp='';}
}
