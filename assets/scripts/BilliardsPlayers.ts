/** The referee uses seats; presentation resolves seats through these profiles. */
export interface PlayerProfile {
    id: string;
    nickname: string;
    avatar: 'forest' | 'sun' | 'default';
}

export function createLocalPlayers(): [PlayerProfile, PlayerProfile] {
    return [
        { id: 'local-1', nickname: '玩家一', avatar: 'forest' },
        { id: 'local-2', nickname: '玩家二', avatar: 'sun' },
    ];
}

export function playerName(profile: PlayerProfile, seat: number): string {
    return profile.nickname.trim() || (seat === 0 ? '玩家一' : '玩家二');
}

/** Conservative glyph budgeting; never split a supplementary Unicode character. */
export function fitNickname(name: string, maxUnits: number): string {
    const chars = Array.from(name);
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
