import {
    _decorator, Camera, Canvas, Color, Component,
    EventTouch, geometry, Graphics, input, Input, Label, Layers, Material, profiler, Rect,
    Mesh, MeshRenderer, Node, primitives, Quat, screen, Texture2D, UITransform, utils, Vec3,
} from 'cc';
import { BallState, createRack, FIXED_STEP, isMoving, step, strike, TABLE, POCKETS, POCKET_RADIUS, HEAD_LINE } from './BilliardsPhysics';

import { Referee, groupName, remaining } from './BilliardsRules';

import { computeHudLayout, HudLayout, HudRect } from './BilliardsLayout';

const { ccclass } = _decorator;

/** One bootstrap component builds the tiny scene. No imported models or physics engine. */
@ccclass('BilliardsGame')
export class BilliardsGame extends Component {
    private balls: BallState[] = [];
    private referee = new Referee();
    private numberNodes: Node[] = [];
    private actions: Label[] = [];
    private playerCards: Label[] = [];
    private dock!: Node;
    private hudLayout!: HudLayout;
    private layoutStamp = '';
    private powerHalfWidth = 280;
    private decision!: Label;
    private placing = false;
    private activeTouch: number | null = null;
    private pendingAction: number | 'reset' | null = null;
    private textures: Texture2D[] = [];
    private ballNodes: Node[] = [];
    private camera!: Camera;
    private aim!: Node;
    private headLine!: Node;
    private status!: Label;
    private hudCamera!: Camera;
    private resetLabel!: Label;
    private powerControl!: Node;
    private powerGraphics!: Graphics;
    private powerLabel!: Label;
    private adjustingPower = false;
    private accumulator = 0;
    private direction = { x: 0, z: -1 };
    private power = 2.4;
    private dragging = false;
    private meshes: Mesh[] = [];
    private materials: Material[] = [];

    start(): void {
        this.buildTable();
        this.buildCamera();
        this.buildHud();
        this.reset();
        profiler.hideStats();
        this.scheduleOnce(() => profiler.hideStats(), 0);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.cancelDrag, this);
    }

    private material(hex: string, texture?: Texture2D): Material {
        const material = new Material();
        // Unlit keeps the first project independent of light baking and shadow configuration.
        material.initialize({ effectName: 'builtin-unlit', defines: { USE_TEXTURE: !!texture } });
        material.setProperty('mainColor', new Color().fromHEX(hex));
        if (texture) material.setProperty('mainTexture', texture);
        this.materials.push(material);
        return material;
    }

    private meshNode(name: string, mesh: Mesh, material: Material): Node {
        const node = new Node(name);
        this.node.addChild(node);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        renderer.setMaterial(material, 0);
        return node;
    }

    private buildTable(): void {
        const box = utilsMesh(primitives.box());
        const sphere = utilsMesh(primitives.sphere(TABLE.radius, { segments: 24 }));
        this.meshes.push(box, sphere);
        const wood = this.material('#49342B'), felt = this.material('#187D68');
        const rail = this.material('#103F38');
        const base = this.meshNode('Table base', box, wood);
        base.setScale(1.47, 0.16, 2.74); base.setPosition(0, -0.1, 0);
        const bed = this.meshNode('Cloth', box, felt);
        bed.setScale(TABLE.halfWidth * 2, 0.02, TABLE.halfLength * 2);
        bed.setPosition(0, -0.01, 0);
        // Split the rails so the six capture zones have visible openings.
        const gap = POCKET_RADIUS + 0.015;
        for (const side of [-1, 1]) {
            for (const end of [-1, 1]) {
                const long = this.meshNode('Long cushion', box, rail);
                long.setScale(0.07, 0.07, TABLE.halfLength - gap * 2);
                long.setPosition(side * 0.67, 0.015, end * TABLE.halfLength / 2);
            }
            const end = this.meshNode('End cushion', box, rail);
            end.setScale(TABLE.halfWidth * 2 - gap * 2, 0.07, 0.07);
            end.setPosition(0, 0.015, side * 1.305);
        }
        const pocketMesh = utilsMesh(primitives.cylinder(POCKET_RADIUS, POCKET_RADIUS, 0.008,
            { radialSegments: 64 }));
        this.meshes.push(pocketMesh);
        const pocketMaterial = this.material('#080D12');
        POCKETS.forEach((pocket, index) => {
            const node = this.meshNode(`Pocket ${index + 1}`, pocketMesh, pocketMaterial);
            node.setPosition(pocket.x, 0.004, pocket.z);
        });
        this.headLine = this.meshNode('Head line', box, this.material('#C4D3A9'));
        this.headLine.setScale(TABLE.halfWidth * 2, 0.001, 0.004);
        this.headLine.setPosition(0, 0.002, HEAD_LINE);
        const colors = ['#FFF8E8', '#E9B923', '#2754B4', '#CF353D', '#783EA0', '#E78126', '#218152', '#78362E', '#15171E'];
        for (let id = 0; id <= 15; id++) {
            const color = new Color().fromHEX(colors[id > 8 ? id - 8 : id]);
            const pixels = new Uint8Array(128 * 64 * 4);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
                const white = id > 8 && (y < 21 || y > 42);
                const offset = (y * 128 + x) * 4;
                pixels.set([white ? 248 : color.r, white ? 246 : color.g, white ? 236 : color.b, 255], offset);
            }
            const texture = new Texture2D();
            texture.reset({ width: 128, height: 64, format: Texture2D.PixelFormat.RGBA8888 });
            texture.uploadData(pixels);
            this.textures.push(texture);
            this.ballNodes.push(this.meshNode(id === 0 ? 'Cue ball' : `Ball ${id}`, sphere, this.material('#FFFFFF', texture)));
        }
        this.aim = new Node('Cue stick');
        this.node.addChild(this.aim);
        const shaftMesh = utilsMesh(primitives.cylinder(0.004, 0.009, 0.55, { radialSegments: 16 }));
        const tipMesh = utilsMesh(primitives.cylinder(0.0045, 0.0045, 0.012, { radialSegments: 16 }));
        this.meshes.push(shaftMesh, tipMesh);
        const shaft = this.meshNode('Cue shaft', shaftMesh, this.material('#D2A469'));
        shaft.setParent(this.aim);
        shaft.setRotationFromEuler(90, 0, 0);
        const tip = this.meshNode('Cue tip', tipMesh, this.material('#66C9D9'));
        tip.setParent(this.aim);
        tip.setRotationFromEuler(90, 0, 0);
        tip.setPosition(0, 0, 0.275);
    }

    private buildCamera(): void {
        // Clear the full window behind the smaller table viewport.
        const background = new Node('Background Camera');
        this.node.addChild(background);
        const clear = background.addComponent(Camera);
        clear.priority = -10;
        clear.visibility = 0;
        clear.clearColor = new Color(18, 24, 33, 255);
        const node = new Node('Main Camera');
        this.node.addChild(node);
        node.setPosition(0, 6, 0);
        // Looking straight down preserves circular pocket silhouettes. Negative Z is screen-up.
        node.lookAt(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
        this.camera = node.addComponent(Camera);
        this.camera.projection = Camera.ProjectionType.ORTHO;
        this.camera.near = 0.1;
        this.camera.far = 30;
        this.camera.clearColor = new Color(18, 24, 33, 255);
        this.camera.visibility = Layers.Enum.DEFAULT;
    }

    private buildHud(): void {
        const root = new Node('HUD');
        root.layer = Layers.Enum.UI_2D;
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(960, 640);
        const canvas = root.addComponent(Canvas);
        canvas.alignCanvasWithScreen = true;
        const cameraNode = new Node('UI Camera');
        root.addChild(cameraNode);
        cameraNode.setPosition(0, 0, 1000);
        const camera = cameraNode.addComponent(Camera);
        this.hudCamera = camera;
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 320;
        camera.near = 0.1;
        camera.far = 2000;
        camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        camera.priority = 10;
        camera.visibility = Layers.Enum.UI_2D;
        canvas.cameraComponent = camera;
        this.dock = new Node('Control dock'); this.dock.layer = Layers.Enum.UI_2D;
        root.addChild(this.dock);
        this.dock.addComponent(UITransform);
        this.dock.addComponent(Graphics);
        const textNode = new Node('Instructions');
        textNode.layer = Layers.Enum.UI_2D;
        root.addChild(textNode);
        textNode.addComponent(UITransform).setContentSize(920, 100);
        textNode.setPosition(0, 260, 0);
        this.status = textNode.addComponent(Label);
        this.status.fontSize = 19;
        this.status.lineHeight = 27;
        this.status.color = new Color(235, 240, 245, 255);
        const resetNode = new Node('Reset');
        resetNode.layer = Layers.Enum.UI_2D;
        root.addChild(resetNode);
        resetNode.addComponent(UITransform).setContentSize(160, 50);
        resetNode.setPosition(0, -280, 0);
        const label = resetNode.addComponent(Label);
        this.resetLabel = label;
        label.string = '重新开局'; label.fontSize = 22;
        label.color = new Color(235, 220, 162, 255);
        this.powerControl = new Node('Power control');
        this.powerControl.layer = Layers.Enum.UI_2D;
        root.addChild(this.powerControl);
        this.powerControl.addComponent(UITransform).setContentSize(620, 64);
        this.powerGraphics = this.powerControl.addComponent(Graphics);
        const powerText = new Node('Power label');
        powerText.layer = Layers.Enum.UI_2D;
        this.powerControl.addChild(powerText);
        powerText.addComponent(UITransform).setContentSize(880, 48);
        powerText.setPosition(0, 50, 0);
        this.powerLabel = powerText.addComponent(Label);
        this.powerLabel.color = new Color(235, 220, 162, 255);
        const uiLabel = (name: string, width: number, height: number): Label => {
            const node = new Node(name); node.layer = Layers.Enum.UI_2D; root.addChild(node);
            node.addComponent(UITransform).setContentSize(width, height);
            const label = node.addComponent(Label);
            label.color = new Color(235, 240, 245, 255);
            return label;
        };
        this.status.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.status.overflow = Label.Overflow.SHRINK;
        for (let player = 0; player < 2; player++) {
            const card = new Node(`Player ${player + 1} card`); card.layer = Layers.Enum.UI_2D;
            root.addChild(card); card.addComponent(UITransform); card.addComponent(Graphics);
            const label = uiLabel(`Player ${player + 1} summary`, 400, 76);
            label.node.setParent(card); label.horizontalAlign = Label.HorizontalAlign.LEFT;
            label.overflow = Label.Overflow.SHRINK;
            this.playerCards.push(label);
        }
        this.decision = uiLabel('Referee decision', 920, 120);
        this.decision.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.decision.overflow = Label.Overflow.SHRINK;
        this.decision.color = new Color(239, 208, 136, 255);
        for (let i = 0; i < 3; i++) {
            const button = new Node(`Rule action ${i}`); button.layer = Layers.Enum.UI_2D; root.addChild(button);
            button.addComponent(UITransform).setContentSize(275, 100);
            const bg = button.addComponent(Graphics);
            bg.fillColor = new Color(39, 68, 83, 255);
            bg.roundRect(-137, -48, 274, 96, 12); bg.fill();
            const label = uiLabel(`Rule action text ${i}`, 275, 100);
            label.node.setParent(button);
            label.overflow = Label.Overflow.SHRINK;
            this.actions.push(label);
        }
        for (let id = 0; id <= 15; id++) {
            const badge = new Node(`Number ${id}`); badge.layer = Layers.Enum.UI_2D; root.addChild(badge);
            badge.addComponent(UITransform).setContentSize(36, 36);
            const disc = badge.addComponent(Graphics);
            disc.fillColor = new Color(255, 252, 242, 255);
            disc.circle(0, 0, 15); disc.fill();
            const label = uiLabel(`Number glyph ${id}`, 36, 36);
            label.node.setParent(badge);
            label.fontSize = id >= 10 ? 20 : 24; label.lineHeight = 28;
            label.string = id === 0 ? '' : String(id);
            label.color = new Color(19, 23, 28, 255);
            this.numberNodes.push(badge);
        }
    }

    private reset(): void {
        this.balls = createRack();
        this.referee = new Referee();
        this.accumulator = 0;
        this.dragging = false;
        this.adjustingPower = false;
        this.placing = false;
        this.activeTouch = null;
        this.pendingAction = null;
        this.direction = { x: 0, z: -1 };
        this.ballNodes.forEach((node, id) => node.setRotationFromEuler(id > 8 ? 90 : 0, 0, 0));
        this.syncVisuals();
    }

    private tablePoint(x: number, y: number): { x: number; z: number } | null {
        const ray = new geometry.Ray();
        this.camera.screenPointToRay(x, y, ray);
        if (Math.abs(ray.d.y) < 1e-6) return null;
        const t = (TABLE.radius - ray.o.y) / ray.d.y;
        if (t < 0) return null;
        const px = ray.o.x + ray.d.x * t, pz = ray.o.z + ray.d.z * t;
        if (Math.abs(px) > TABLE.halfWidth || Math.abs(pz) > TABLE.halfLength) return null;
        return { x: px, z: pz };
    }

    private pointAt(x: number, y: number): boolean {
        const point = this.tablePoint(x, y);
        if (!point) return false;
        const px = point.x, pz = point.z;
        const cue = this.balls[0];
        if (cue.pocketed) return false;
        const dx = px - cue.x, dz = pz - cue.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.02) return false;
        this.direction = { x: dx / length, z: dz / length };
        return true;
    }

    private ruleAction(index: number): void {
        const ref = this.referee;
        if (ref.phase === 'placing' && index === 1) {
            if (!ref.confirmPlacement(this.balls)) ref.message = '请先在合法位置摆放白球，再点确认';
        } else if (ref.phase === 'choice') {
            ref.chooseBreak(this.balls, index === 2 ? 'accept' : index === 0 ? 'self' : 'opponent');
        } else if (ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current]) {
            if (index < 2) ref.select(index === 0 ? 'solid' : 'stripe');
        } else if (ref.phase === 'over' && index === 1) this.reset();
        this.cancelDrag();
        this.syncVisuals();
    }

    private placeAt(x: number, y: number): void {
        const point = this.tablePoint(x, y);
        if (!point) return;
        if (!this.referee.placeCue(this.balls, point.x, point.z))
            this.referee.message = this.referee.hand === 'head' ? '必须放在开球线后，避开球和袋口' : '位置无效：白球不能重叠其他球或放在袋口';
        this.syncVisuals();
    }

    private begin(x: number, y: number): void {
        this.pendingAction = null;
        if (this.hitUi(this.resetLabel.node, x, y)) this.pendingAction = 'reset';
        else {
            const index = this.actions.findIndex(label => this.hitUi(label.node.parent!, x, y));
            if (index !== -1) this.pendingAction = index;
        }
        if (this.pendingAction !== null) { this.dragging = false; return; }
        if (this.referee.phase === 'over' || this.referee.phase === 'choice') return;
        if (this.hitUi(this.powerControl, x, y)) {
            this.dragging = false;
            this.adjustingPower = true;
            this.setPowerAt(x, y);
            return;
        }
        this.adjustingPower = false;
        if (this.referee.phase === 'placing') { this.placing = true; this.placeAt(x, y); return; }
        this.dragging = this.referee.phase === 'ready' && !isMoving(this.balls) && this.pointAt(x, y);
    }
    private move(x: number, y: number): void {
        if (this.pendingAction !== null) return;
        if (this.placing) { this.placeAt(x, y); return; }
        if (this.adjustingPower) { this.setPowerAt(x, y); return; }
        if (this.dragging) this.pointAt(x, y);
    }
    private release(x: number, y: number): void {
        if (this.pendingAction !== null) {
            const action = this.pendingAction;
            this.pendingAction = null;
            const node = action === 'reset' ? this.resetLabel.node : this.actions[action].node.parent!;
            if (this.hitUi(node, x, y)) {
                if (action === 'reset') this.reset(); else this.ruleAction(action);
            }
            return;
        }
        if (this.placing) { this.placing = false; return; }
        if (this.adjustingPower) { this.adjustingPower = false; return; }
        if (this.dragging) this.shoot();
        this.dragging = false;
    }
    private setPowerAt(x: number, y: number): void {
        const world = this.hudCamera.screenToWorld(new Vec3(x, y, 0));
        const local = this.powerControl.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        const fraction = Math.max(0.1, Math.min(1, (local.x + this.powerHalfWidth) / (this.powerHalfWidth * 2)));
        this.power = Math.round(fraction * 40) / 10;
    }
    private hitUi(node: Node, x: number, y: number): boolean {
        if (!node.activeInHierarchy) return false;
        // UITransform.hitTest filters out offscreen cameras used by Creator's in-editor preview.
        // Route all touch controls through our own full-screen HUD camera instead.
        const transform = node.getComponent(UITransform)!;
        const local = transform.convertToNodeSpaceAR(this.hudCamera.screenToWorld(new Vec3(x, y, 0)));
        return Math.abs(local.x) <= transform.contentSize.width / 2 &&
            Math.abs(local.y) <= transform.contentSize.height / 2;
    }
    private cancelDrag(): void {
        this.dragging = false; this.adjustingPower = false; this.placing = false;
        this.activeTouch = null; this.pendingAction = null;
    }
    private shoot(): void {
        if (this.adjustingPower || !this.referee.beginShot(this.balls)) return;
        if (!strike(this.balls, this.direction.x, this.direction.z, this.power)) {
            this.referee.shot = null;
            this.referee.phase = 'ready';
        }
    }
    private touchStart(event: EventTouch): void {
        if (this.activeTouch !== null) return;
        this.activeTouch = event.getID();
        const p = event.getLocation(); this.begin(p.x, p.y);
    }
    private touchMove(event: EventTouch): void {
        if (event.getID() !== this.activeTouch) return;
        const p = event.getLocation(); this.move(p.x, p.y);
    }
    private touchEnd(event: EventTouch): void {
        if (event.getID() !== this.activeTouch) return;
        const p = event.getLocation();
        this.release(p.x, p.y); this.activeTouch = null;
    }

    update(dt: number): void {
        // Cap backlog after a hidden tab resumes; simulated time is deliberately discarded.
        this.accumulator = Math.min(this.accumulator + dt, 0.1);
        while (this.accumulator >= FIXED_STEP) {
            step(this.balls, FIXED_STEP, { respawnCue: false,
                onEvent: event => this.referee.observe(event, this.balls) });
            this.referee.trackCue(this.balls);
            if (this.referee.phase === 'shooting' && !isMoving(this.balls)) this.referee.finishShot(this.balls);
            this.accumulator -= FIXED_STEP;
        }
        this.syncVisuals();
        const size = screen.windowSize;
        const ref = this.referee;
        const phase = ref.phase === 'over' ? `P${(ref.winner ?? 0) + 1} 获胜` : `P${ref.current + 1} ${ref.isBreak ? '开球' : '击球'} · ${ref.groups[ref.current] ? groupName(ref.groups[ref.current]) : '开放球局'}`;
        this.status.string = `中式八球 · 双人同屏\n${phase}`;
        this.playerCards.forEach((label, player) => {
            const group = ref.groups[player as 0 | 1];
            const ids = group ? remaining(this.balls, group) : [];
            label.string = `P${player + 1} · ${groupName(group)}${group ? ` · 剩${ids.length}` : ''}\n${group ? ids.join(' ') || '本组已清，打8号' : '等待确定球组'} · 犯规${ref.foulCount[player as 0 | 1]}`;
        });
        this.decision.string = ref.phase === 'placing'
            ? ref.isBreak ? '在线后轻触摆放白球，然后确认。' : `${ref.message}\n触摸台面摆白球，然后确认。`
            : ref.phase === 'shooting' ? '球正在运动，停稳后自动判罚。'
            : ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current]
                ? '开放球局：选择球组，再瞄准击球。'
                : ref.message;
        let labels = ['', '', ''];
        if (ref.phase === 'placing') labels[1] = '确认摆球';
        if (ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current])
            labels = [`${ref.selected === 'solid' ? '✓ ' : ''}进攻全色`, `${ref.selected === 'stripe' ? '✓ ' : ''}进攻半色`, ''];
        if (ref.phase === 'choice') labels = ref.breakChoice === 'illegal'
            ? ['我来重开', '原开球方重开', '接受自由球']
            : [this.balls[0].pocketed ? '' : '接受台面', '', '线后自由球'];
        if (ref.phase === 'over') labels[1] = '再来一局';
        this.layoutHud(labels);
        this.balls.forEach(ball => {
            const node = this.numberNodes[ball.id];
            node.active = ball.id !== 0 && !ball.pocketed;
            if (!node.active) return;
            const position = this.camera.worldToScreen(new Vec3(ball.x, TABLE.radius * 2, ball.z));
            const ui = this.hudCamera.screenToWorld(new Vec3(position.x, position.y, 0));
            node.setPosition(ui.x, ui.y, 0);
            // Keep the white number medallion within the projected sphere silhouette.
            const edge = this.camera.worldToScreen(new Vec3(ball.x + TABLE.radius, TABLE.radius * 2, ball.z));
            const scale = Math.abs(edge.x - position.x) * 0.65 * this.hudCamera.orthoHeight * 2 / size.height / 15;
            node.setScale(scale, scale, 1);
        });
    }

    private layoutHud(labels: string[]): void {
        const size = screen.windowSize;
        const height = this.hudCamera.orthoHeight * 2;
        const stamp = [size.width, size.height, height, this.referee.current, this.power, ...labels].join('|');
        if (stamp === this.layoutStamp) return;
        this.layoutStamp = stamp;
        const layout = computeHudLayout(height * size.width / size.height, height);
        this.hudLayout = layout;
        const s = layout.scale;
        const place = (node: Node, rect: HudRect): void => {
            node.setPosition(rect.x + rect.width / 2 - layout.width / 2,
                layout.height / 2 - rect.y - rect.height / 2, 0);
            node.getComponent(UITransform)!.setContentSize(rect.width, rect.height);
        };
        const panel = (node: Node, rect: HudRect, color: Color): void => {
            place(node, rect);
            const graphic = node.getComponent(Graphics)!;
            graphic.clear(); graphic.fillColor = color;
            graphic.roundRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, 12 * s); graphic.fill();
        };
        place(this.status.node, layout.status);
        this.status.fontSize = 30 * s; this.status.lineHeight = 37 * s;
        place(this.resetLabel.node, layout.reset);
        this.resetLabel.fontSize = 24 * s;
        this.resetLabel.lineHeight = 30 * s;
        this.resetLabel.overflow = Label.Overflow.SHRINK;
        this.playerCards.forEach((label, player) => {
            const rect = layout.players[player];
            panel(label.node.parent!, rect, player === this.referee.current
                ? new Color(24, 61, 62, 255) : new Color(28, 40, 51, 255));
            label.node.setPosition(0, 0, 0);
            label.node.getComponent(UITransform)!.setContentSize(rect.width - 24 * s, rect.height - 8 * s);
            label.fontSize = 24 * s; label.lineHeight = 32 * s;
        });
        panel(this.dock, layout.dock, new Color(23, 34, 45, 255));
        place(this.decision.node, layout.decision);
        this.decision.fontSize = 26 * s; this.decision.lineHeight = 33 * s;
        const active = labels.map((text, index) => text ? index : -1).filter(index => index !== -1);
        const gap = 12 * s;
        const buttonWidth = (layout.actions.width - gap * (active.length - 1)) / Math.max(1, active.length);
        this.actions.forEach((label, index) => {
            const node = label.node.parent!;
            node.active = !!labels[index]; label.string = labels[index];
            if (!node.active) return;
            const rect = { x: layout.actions.x + active.indexOf(index) * (buttonWidth + gap), y: layout.actions.y,
                width: buttonWidth, height: layout.actions.height };
            panel(node, rect, new Color(38, 74, 86, 255));
            label.node.setPosition(0, 0, 0);
            label.node.getComponent(UITransform)!.setContentSize(rect.width - 20 * s, rect.height - 12 * s);
            label.fontSize = 28 * s; label.lineHeight = 34 * s;
        });
        place(this.powerControl, layout.power);
        this.powerHalfWidth = (layout.power.width - 24 * s) / 2;
        this.powerLabel.node.getComponent(UITransform)!.setContentSize(layout.power.width, 34 * s);
        this.powerLabel.node.setPosition(0, 26 * s, 0);
        this.powerLabel.fontSize = 28 * s; this.powerLabel.lineHeight = 34 * s;
        this.powerLabel.string = `力度 ${Math.round(this.power / 4 * 100)}% · 拖动调节`;
        const fill = this.powerGraphics, half = this.powerHalfWidth, y = -15 * s;
        fill.clear(); fill.fillColor = new Color(55, 70, 82, 255);
        fill.roundRect(-half, y - 6 * s, half * 2, 12 * s, 6 * s); fill.fill();
        fill.fillColor = new Color(235, 191, 84, 255);
        fill.roundRect(-half, y - 6 * s, half * 2 * this.power / 4, 12 * s, 6 * s); fill.fill();
        fill.fillColor = new Color(255, 248, 232, 255);
        fill.circle(-half + half * 2 * this.power / 4, y, 15 * s); fill.fill();
        const area = layout.playArea;
        this.camera.rect = new Rect(area.x / layout.width, 1 - (area.y + area.height) / layout.height,
            area.width / layout.width, area.height / layout.height);
        this.camera.orthoHeight = Math.max(1.37, 0.735 / (area.width / area.height)) * 1.055;
        // Number medallions use these matrices immediately, before the renderer's next update.
        this.camera.camera?.update();
        this.hudCamera.camera?.update();
    }

    private syncVisuals(): void {
        this.balls.forEach((ball, index) => {
            const node = this.ballNodes[index];
            const wasHidden = !node.active;
            node.active = !ball.pocketed;
            if (ball.pocketed) return;
            if (wasHidden) node.setPosition(ball.x, TABLE.radius, ball.z);
            const previous = node.position;
            const dx = ball.x - previous.x, dz = ball.z - previous.z;
            const distance = Math.hypot(dx, dz);
            if (distance > 1e-7) {
                const rotation = Quat.fromAxisAngle(new Quat(), new Vec3(dz / distance, 0, -dx / distance), distance / TABLE.radius);
                node.rotate(rotation, Node.NodeSpace.WORLD);
            }
            node.setPosition(ball.x, TABLE.radius, ball.z);
        });
        const cue = this.balls[0];
        this.headLine.active = this.referee.phase === 'placing' && this.referee.hand === 'head';
        this.aim.active = this.referee.phase === 'ready' && !cue.pocketed && !isMoving(this.balls);
        // The tip is nearest the cue ball; the shaft extends opposite the outgoing velocity.
        const behind = TABLE.radius + 0.02 + 0.275 + this.power / 4 * 0.025;
        this.aim.setPosition(cue.x - this.direction.x * behind, TABLE.radius, cue.z - this.direction.z * behind);
        this.aim.setRotationFromEuler(0, Math.atan2(this.direction.x, this.direction.z) * 180 / Math.PI, 0);
    }

    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.touchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.cancelDrag, this);
        this.meshes.forEach(mesh => mesh.destroy());
        this.materials.forEach(material => material.destroy());
        this.textures.forEach(texture => texture.destroy());
    }
}

// Keep procedural mesh construction in one place for later replacement with imported models.
function utilsMesh(data: ReturnType<typeof primitives.box>): Mesh { return utils.createMesh(data); }
