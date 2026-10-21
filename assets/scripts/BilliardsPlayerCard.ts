import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
import { CLUB, ballColor } from './BilliardsTheme';
import { fitNickname, PlayerProfile, playerName } from './BilliardsPlayers';
import { Group, groupName } from './BilliardsRules';

/** Reusable HUD component; gameplay and referee state remain outside this view. */
export class PlayerCardView {
    readonly node: Node;
    readonly nameLabel: Label;
    private readonly groupLabel: Label;
    private readonly fallbackLabel: Label;
    private readonly artwork: Graphics;
    private readonly numbers: Label[] = [];
    private stamp = '';

    constructor(parent: Node, seat: number) {
        this.node = new Node(`Player ${seat + 1} card`);
        this.node.layer = Layers.Enum.UI_2D;
        parent.addChild(this.node);
        this.node.addComponent(UITransform);
        this.artwork = this.node.addComponent(Graphics);
        this.nameLabel = this.text('Nickname', CLUB.ink);
        this.groupLabel = this.text('Group', CLUB.muted);
        this.fallbackLabel = this.text('Targets status', CLUB.muted);
        for (let i = 0; i < 7; i++) this.numbers.push(this.text(`Target ${i}`, CLUB.background, true));
    }

    private text(name: string, color: string, centered = false): Label {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        this.node.addChild(node); node.addComponent(UITransform);
        const label = node.addComponent(Label);
        label.color = new Color().fromHEX(color);
        label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return label;
    }

    render(profile: PlayerProfile, seat: number, group: Group | null, ids: number[], active: boolean,
        width: number, height: number, scale: number): void {
        const stamp = [profile.id, profile.nickname, profile.avatar, seat, group, ...ids, active, width, height, scale].join('|');
        if (stamp === this.stamp) return;
        this.stamp = stamp;
        const g = this.artwork, x = -width / 2, y = height / 2, s = scale;
        const colour = (value: string): Color => new Color().fromHEX(value);
        const circle = (cx: number, cy: number, r: number, value: string): void => {
            g.fillColor = colour(value); g.circle(cx, cy, r); g.fill();
        };
        const text = (label: Label, value: string, cx: number, cy: number, w: number, size: number): void => {
            label.string = value; label.fontSize = size * s; label.lineHeight = (size + 4) * s;
            label.node.setPosition(cx, cy, 0); label.node.getComponent(UITransform)!.setContentSize(w, (size + 6) * s);
        };
        g.clear(); g.fillColor = colour(active ? CLUB.activeSurface : CLUB.surface);
        g.roundRect(x, -height / 2, width, height, CLUB.radius * s); g.fill();
        const ax = x + 25 * s, ay = y - 25 * s;
        circle(ax, ay, 16 * s, profile.avatar === 'sun' ? '#735B3D' : '#36554A');
        if (profile.avatar === 'forest') {
            g.fillColor = colour(CLUB.line);g.moveTo(ax - 11*s, ay - 8*s);g.lineTo(ax, ay + 9*s);g.lineTo(ax + 11*s, ay - 8*s);g.close();g.fill();
            circle(ax + 7*s, ay + 8*s, 3*s, CLUB.gold);
        } else if (profile.avatar === 'sun') {
            circle(ax, ay + 3*s, 6*s, CLUB.gold);
            g.strokeColor = colour(CLUB.line);g.lineWidth = 1.5*s;
            g.moveTo(ax - 10*s, ay - 6*s);g.lineTo(ax + 10*s, ay - 6*s);g.stroke();
        } else {
            circle(ax, ay + 5*s, 5*s, CLUB.muted);circle(ax, ay - 9*s, 8*s, CLUB.muted);
        }
        if (active) { g.strokeColor = colour(CLUB.gold);g.lineWidth = 1.5*s;g.circle(ax, ay, 17*s);g.stroke(); }
        const textX = x + 49*s, textWidth = Math.max(1, width - 58*s);
        text(this.nameLabel, fitNickname(playerName(profile, seat), textWidth / (14*s)), textX + textWidth/2, y - 18*s, textWidth, 14);
        text(this.groupLabel, group ? `${groupName(group)} · 剩${ids.length}` : '未分组', textX + textWidth/2, y - 36*s, textWidth, 11);
        this.fallbackLabel.node.active = !group || ids.length === 0;
        text(this.fallbackLabel, group ? '目标 8 号' : '等待分组', x + width/2, -height/2 + 14*s, width - 20*s, 11);
        this.numbers.forEach((label, i) => {
            label.node.active = i < ids.length;
            if (i >= ids.length) return;
            const id = ids[i], cx = x + (17 + i * 18)*s, cy = -height/2 + 14*s, r = 7*s;
            circle(cx, cy, r, id > 8 ? CLUB.ink : ballColor(id));
            if (id > 8) {
                // The strip terminates on the circle, leaving continuous white caps.
                const half = Math.sqrt(r*r - (3.5*s)**2);
                g.fillColor = colour(ballColor(id));
                g.moveTo(cx-half, cy+3.5*s);g.lineTo(cx+half, cy+3.5*s);
                g.bezierCurveTo(cx+r, cy+2*s, cx+r, cy-2*s, cx+half, cy-3.5*s);
                g.lineTo(cx-half, cy-3.5*s);g.bezierCurveTo(cx-r, cy-2*s, cx-r, cy+2*s, cx-half, cy+3.5*s);g.close();g.fill();
            }
            circle(cx, cy, 4.25*s, CLUB.ink);
            text(label, String(id), cx, cy, 13*s, id < 10 ? 8 : 7);
        });
    }
}
