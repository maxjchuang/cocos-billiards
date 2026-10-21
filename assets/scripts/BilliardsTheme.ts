/** Shared design tokens. Values are logical pixels unless expressed as colours. */
export const CLUB = {
    background: '#101D1B', surface: '#1C2B25', activeSurface: '#243E32',
    felt: '#21584B', cushion: '#163E34', wood: '#69503A', gold: '#DEC58D',
    ink: '#F5F1E6', muted: '#A6B5AC', foul: '#E0AE73', loss: '#D99588',
    line: '#A4C3AD', pocket: '#080E0C', track: '#3A4D40',
    disabled: '#66776B', buttonHeight: 48, touchSize: 44, radius: 12,
} as const;

export const BALL_COLORS = [
    '#F5F1E6', '#D3A32B', '#31599A', '#B3453D', '#73538D',
    '#CF7D35', '#427852', '#824B3D', '#151918',
] as const;

export function ballColor(id: number): string {
    return BALL_COLORS[id > 8 ? id - 8 : id] ?? BALL_COLORS[0];
}
