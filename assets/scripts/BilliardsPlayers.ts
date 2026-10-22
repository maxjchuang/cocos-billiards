/** The referee uses seats; presentation resolves seats through these profiles. */
export interface PlayerProfile {
    id: string;
    nickname: string;
    avatar: 'forest' | 'sun' | 'fox' | 'default';
}

export function createLocalPlayers(): [PlayerProfile, PlayerProfile] {
    return [
        { id: 'local-1', nickname: '玩家一', avatar: 'forest' },
        { id: 'local-2', nickname: '玩家二', avatar: 'fox' },
    ];
}

export function playerName(profile: PlayerProfile, seat: number): string {
    return profile.nickname.trim() || (seat === 0 ? '玩家一' : '玩家二');
}

/** Conservative glyph budgeting; never split a supplementary Unicode character. */
export function fitNickname(name: string, maxUnits: number): string {
    const api=(typeof Intl==='undefined'?{}:Intl) as unknown as {Segmenter?:new(locale:string,options:{granularity:string})=>{segment(value:string):Iterable<{segment:string}>}};
    let chars:string[]=[];
    if(api.Segmenter)chars=Array.from(new api.Segmenter('zh',{granularity:'grapheme'}).segment(name),part=>part.segment);
    else for(const char of Array.from(name)){
        const code=char.codePointAt(0)!,previous=chars[chars.length-1]??'';
        const mark=/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f]/.test(char);
        const regional=code>=0x1f1e6&&code<=0x1f1ff;
        const previousCode=previous.codePointAt(0)??0;
        if(previous&&(mark||char==='\u200d'||previous.endsWith('\u200d')||(code>=0x1f3fb&&code<=0x1f3ff)||(regional&&Array.from(previous).length===1&&previousCode>=0x1f1e6&&previousCode<=0x1f1ff)))chars[chars.length-1]+=char;
        else chars.push(char);
    }
    const units = (char: string): number => /^[\x20-\x7e]$/.test(char) ? 0.6 : 1;
    if (chars.reduce((sum, char) => sum + units(char), 0) <= maxUnits) return name;
    let result = '', used = 0;
    for (const char of chars) {
        if (used + units(char) > Math.max(0, maxUnits - 1)) break;
        result += char; used += units(char);
    }
    return result + '…';
}

/** Transitional adapter until structured referee results replace legacy messages. */
export function playerMessage(message: string, players: readonly PlayerProfile[]): string {
    return message.replace(/P([12])(?!\d)/g, (_, seat: string) => {
        const index = Number(seat) - 1;
        return playerName(players[index], index);
    });
}
