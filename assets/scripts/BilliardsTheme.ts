/** Shared design tokens. Values are logical pixels unless expressed as colours. */
export const CLUB = {
    fontFamily: 'PingFang SC, Noto Sans CJK SC, Arial, sans-serif',numberFontFamily:'Menlo, Consolas, monospace',
    background: '#0E1C19', surface: '#1C3028', activeSurface: '#20372C',
    felt: '#286556', cushion: '#163E34', wood: '#614630', gold: '#D9BD83',
    ink: '#F4F0E6', muted: '#ABBAB0', foul: '#DFB981', loss: '#D99588',
    line: '#A4C3AD', pocket: '#080E0C', track: '#3A4D40',
    cueTrajectory:'#F5F1E6',targetTrajectory:'#E5BD74',
    disabled: '#66776B', buttonHeight: 48, touchSize: 44, radius: 12,
} as const;

export const BALL_COLORS = [
    '#F5F1E6', '#D3A32B', '#31599A', '#B3453D', '#73538D',
    '#CF7D35', '#427852', '#824B3D', '#151918',
] as const;

export function ballColor(id: number): string {
    return BALL_COLORS[id > 8 ? id - 8 : id] ?? BALL_COLORS[0];
}
