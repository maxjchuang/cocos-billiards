import { RackConfig, RackSession, restoreRackConfig } from './BilliardsRack';
import { SettingsStore,MatchHistory,SettingKey } from './BilliardsSettings';
import { PanelsView,PanelMode,PanelModel } from './BilliardsPanels';
import { Feedback } from './BilliardsFeedback';
import { MagnifierView } from './BilliardsMagnifier';
import { POCKETS, CUSHION_PATHS, TablePoint } from './BilliardsTableGeometry';
import {
    _decorator, Camera, Canvas, Color, Component, game, Game,
    EventTouch, geometry, Graphics, input, Input, Label, Layers, Material, profiler, Rect,
    Mesh, MeshRenderer, Node, primitives, Quat, ResolutionPolicy, screen, sys, view, Texture2D, UITransform, utils, Vec3,
} from 'cc';
import { BallState, createRack, FIXED_STEP, isMoving, step, TABLE, HEAD_LINE } from './BilliardsPhysics';

import { Referee, groupName, remaining } from './BilliardsRules';

import { computeHudLayout, computeHudViewport, HudLayout, HudRect } from './BilliardsLayout';
import { CLUB, BALL_COLORS } from './BilliardsTheme';
import { createLocalPlayers, playerName, playerMessage, fitNickname } from './BilliardsPlayers';
import { PlayerCardView } from './BilliardsPlayerCard';
import { commitShot, mayShoot, ShotSequence, shotPose } from './BilliardsShot';
import { FineAim, predictContact } from './BilliardsAim';
import { ShotButtonView } from './BilliardsShotButton';
import { SPIN, TipSelection, tipLabel } from './BilliardsSpin';
import { SpinPanelView } from './BilliardsSpinPanel';

const { ccclass } = _decorator;
type Action = number | 'pause' | 'resume' | 'restart' | 'shoot' | 'fine' | 'fine-minus' | 'fine-plus' | 'spin' | 'spin-cancel' | 'spin-done' | 'spin-center' | 'identity0' | 'identity1' | 'winner-identity' | `modal-${number}`;

/** One bootstrap component builds the tiny scene. No imported models or physics engine. */
@ccclass('BilliardsGame')
export class BilliardsGame extends Component {
    private balls: BallState[] = [];
    private referee = new Referee();
    private numberNodes: Node[] = [];
    private actions: Label[] = [];
    private playerCards: PlayerCardView[] = [];
    private players = createLocalPlayers();
    private turnLabel!: Label;
    private dock!: Node;
    private hudLayout!: HudLayout;
    private layoutStamp = '';
    private powerHalfWidth = 280;
    private decision!: Label;
    private placing = false;
    private activeTouch: number | null = null;
    private pendingAction: Action | null = null;
    private shotSequence = new ShotSequence();
    private gameId = 0;
    private fineAim = new FineAim();
    private adjustingFine = false;
    private shotButton!: ShotButtonView;
    private fineButton!: Label;
    private spinButton!: Label;
    private spinPanel!: SpinPanelView;
    private tip = new TipSelection();
    private adjustingSpin = false;
    private visualSpinDeltas = Array.from({length:16},()=>({x:0,y:0,z:0}));
    private fineControl!: Node;
    private fineLabel!: Label;
    private fineMinus!: Label;
    private finePlus!: Label;
    private aimGraphics!: Graphics;
    private pauseLayer!: Node;
    private pauseTitle!: Label;
    private resumeButton!: Label;
    private restartButton!: Label;
    private paused = false;
    private backgrounded = false;
    private confirmingRestart = false;
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

    private rackSession=new RackSession();
    private rackConfig:Readonly<RackConfig>|null=null;
    private settings=new SettingsStore();
    private history=new MatchHistory();
    private panels!:PanelsView;
    private magnifier!:MagnifierView;
    private feedback!:Feedback;
    private panelMode:PanelMode|null=null;
    private panelPage=0;
    private historyPage=0;
    private identitySeat=0;
    private identityReturn:PanelMode|null=null;
    private resultShown=false;
    private rotationBlocked=false;
    private lastPointer:{x:number;y:number}|null=null;
    private placementInvalid:{x:number;z:number;until:number;message?:string}|null=null;
    private placementGraphics!:Graphics;
    private subtitle!:Label;
    private pauseArtwork!:Graphics;
    private powerValue!:Label;
    private groupHint!:Label;
    private decisionHint!:Label;
    private uiTime=0;
    private hudPixelRatio=1;
    private notificationAt=0;
    private lastContactShotId=0;
    private groupSelectedAt=-1000;
    start(): void {
        this.rackSession=new RackSession(sys.localStorage);
        this.settings=new SettingsStore(sys.localStorage);
        this.feedback=new Feedback(this.node,()=>this.settings.value);
        this.buildTable();
        this.buildCamera();
        this.buildHud();
        this.reset();
        profiler.hideStats();
        this.scheduleOnce(() => profiler.hideStats(), 0);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        game.on(Game.EVENT_HIDE, this.hideGame, this);
        game.on(Game.EVENT_SHOW, this.showGame, this);
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
        const wood = this.material(CLUB.wood), felt = this.material(CLUB.felt);
        const rail = this.material(CLUB.cushion);
        const rounded:TablePoint[]=[];
        const rx=.0474/(TABLE.outerHalfWidth*2),rz=.0474/(TABLE.outerHalfLength*2);
        for(const [cx,cz,start] of [[.5-rx,.5-rz,0],[-.5+rx,.5-rz,90],[-.5+rx,-.5+rz,180],[.5-rx,-.5+rz,270]])
            for(let i=0;i<=12;i++){const a=(start+i*90/12)*Math.PI/180;rounded.push({x:cx+rx*Math.cos(a),z:cz+rz*Math.sin(a)});}
        const baseMesh=tablePolygonMesh(rounded,0);this.meshes.push(baseMesh);
        const base = this.meshNode('Table base', baseMesh, wood);
        base.setScale(TABLE.outerHalfWidth*2, 0.16, TABLE.outerHalfLength*2); base.setPosition(0, -0.02, 0);
        const bed = this.meshNode('Cloth', box, felt);
        bed.setScale(TABLE.halfWidth * 2, 0.02, TABLE.halfLength * 2);
        bed.setPosition(0, -0.01, 0);
        CUSHION_PATHS.forEach((path,index)=>{
            const mesh=tablePolygonMesh(path.polygon,0.038);
            this.meshes.push(mesh);this.meshNode(`Cushion ${path.side} ${index}`,mesh,rail);
        });
        const pocketMaterial = this.material(CLUB.pocket);
        POCKETS.forEach((pocket,index)=>{
            const mesh=tablePolygonMesh(pocket.outline,0.001);
            this.meshes.push(mesh);this.meshNode(`Pocket ${index+1}`,mesh,pocketMaterial);
        });
        this.headLine = this.meshNode('Head line', box, this.material('#C4D3A9'));
        this.headLine.setScale(TABLE.halfWidth * 2, 0.001, 0.004);
        this.headLine.setPosition(0, 0.002, HEAD_LINE);
        const colors = BALL_COLORS;
        for (let id = 0; id <= 15; id++) {
            const color = new Color().fromHEX(colors[id > 8 ? id - 8 : id]);
            const pixels = new Uint8Array(128 * 64 * 4);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
                const white = id > 8 && (y < 21 || y > 42);
                const offset = (y * 128 + x) * 4;
                pixels.set([white ? 245 : color.r, white ? 242 : color.g, white ? 232 : color.b, 255], offset);
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
        clear.clearColor = new Color().fromHEX(CLUB.background);
        const node = new Node('Main Camera');
        this.node.addChild(node);
        node.setPosition(0, 6, 0);
        // Looking straight down preserves circular pocket silhouettes. Negative Z is screen-up.
        node.lookAt(new Vec3(0, 0, 0), new Vec3(0, 0, -1));
        this.camera = node.addComponent(Camera);
        this.camera.projection = Camera.ProjectionType.ORTHO;
        this.camera.near = 0.1;
        this.camera.far = 30;
        this.camera.clearColor = new Color().fromHEX(CLUB.background);
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
        this.status.fontFamily=CLUB.fontFamily;
        this.status.fontSize = 19;
        this.status.lineHeight = 27;
        this.status.color = new Color().fromHEX(CLUB.ink);
        const resetNode = new Node('Reset');
        resetNode.layer = Layers.Enum.UI_2D;
        root.addChild(resetNode);
        resetNode.addComponent(UITransform).setContentSize(160, 50);
        resetNode.setPosition(0, -280, 0);
        const label = resetNode.addComponent(Label);
        this.resetLabel = label;
        label.string = '重新开局'; label.fontSize = 22;
        label.color = new Color().fromHEX(CLUB.gold);
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
        this.powerLabel.color = new Color().fromHEX(CLUB.gold);
        const uiLabel = (name: string, width: number, height: number): Label => {
            const node = new Node(name); node.layer = Layers.Enum.UI_2D; root.addChild(node);
            node.addComponent(UITransform).setContentSize(width, height);
            const label = node.addComponent(Label);
            label.color = new Color().fromHEX(CLUB.ink);
            return label;
        };
        this.decisionHint=uiLabel('Placement instructions',345,20);this.decisionHint.horizontalAlign=Label.HorizontalAlign.LEFT;this.decisionHint.overflow=Label.Overflow.CLAMP;
        this.groupHint=uiLabel('Group selection hint',345,14);this.groupHint.string='选择进攻组不代表已确定球组';this.groupHint.fontSize=10;this.groupHint.color=new Color().fromHEX(CLUB.muted);
        this.subtitle=uiLabel('Game subtitle',201,14);this.subtitle.string='同屏对战';this.subtitle.horizontalAlign=Label.HorizontalAlign.LEFT;this.subtitle.overflow=Label.Overflow.CLAMP;this.subtitle.color=new Color().fromHEX(CLUB.muted);
        this.powerValue=uiLabel('Power percentage',80,20);this.powerValue.node.setParent(this.powerControl);this.powerValue.horizontalAlign=Label.HorizontalAlign.RIGHT;this.powerValue.overflow=Label.Overflow.CLAMP;this.powerLabel.overflow=Label.Overflow.CLAMP;
        const pauseArt=new Node('Pause icon');pauseArt.layer=Layers.Enum.UI_2D;this.resetLabel.node.addChild(pauseArt);pauseArt.addComponent(UITransform);this.pauseArtwork=pauseArt.addComponent(Graphics);
        this.status.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.status.overflow = Label.Overflow.SHRINK;
        this.turnLabel = uiLabel('Turn', 353, 24);
        this.turnLabel.color = new Color().fromHEX(CLUB.gold);
        this.turnLabel.overflow = Label.Overflow.SHRINK;
        for (let player = 0; player < 2; player++) this.playerCards.push(new PlayerCardView(root, player));
        this.decision = uiLabel('Referee decision', 920, 120);
        this.decision.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.decision.overflow = Label.Overflow.SHRINK;
        this.decision.color = new Color().fromHEX(CLUB.foul);
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
        this.shotButton = new ShotButtonView(root);
        const control = (name: string, title: string, parent = root): Label => {
            const node=new Node(name);node.layer=Layers.Enum.UI_2D;parent.addChild(node);
            node.addComponent(UITransform);node.addComponent(Graphics);
            const label=uiLabel(name+' label',200,32);label.node.setParent(node);label.string=title;
            label.overflow=Label.Overflow.SHRINK;return label;
        };
        this.fineButton=control('Fine aim button','微调');
        this.spinButton=control('Cue tip button','打点');
        this.fineControl=new Node('Fine aim slider');this.fineControl.layer=Layers.Enum.UI_2D;
        root.addChild(this.fineControl);this.fineControl.addComponent(UITransform);this.fineControl.addComponent(Graphics);
        this.fineLabel=uiLabel('Fine aim value',120,20);this.fineLabel.node.setParent(this.fineControl);
        this.fineMinus=control('Fine minus','−');this.finePlus=control('Fine plus','+');
        const aimNode=new Node('First contact guide');aimNode.layer=Layers.Enum.UI_2D;root.addChild(aimNode);
        aimNode.addComponent(UITransform);this.aimGraphics=aimNode.addComponent(Graphics);
        for (let id = 0; id <= 15; id++) {
            const badge = new Node(`Number ${id}`); badge.layer = Layers.Enum.UI_2D; root.addChild(badge);
            badge.addComponent(UITransform).setContentSize(36, 36);
            const disc = badge.addComponent(Graphics);
            disc.fillColor = new Color(252, 249, 240, 255);
            disc.circle(0, 0, 15); disc.fill();disc.fillColor=new Color(255,255,255,56);disc.circle(-12.5,13.75,5.625);disc.fill();
            const label = uiLabel(`Number glyph ${id}`, 36, 36);
            label.node.setParent(badge);
            label.fontSize = id >= 10 ? 20 : 24; label.lineHeight = 28;
            label.string = id === 0 ? '' : String(id);
            label.color = new Color(34, 51, 40, 255);
            this.numberNodes.push(badge);
        }
        const placement=new Node('Placement feedback');placement.layer=Layers.Enum.UI_2D;root.addChild(placement);placement.addComponent(UITransform);this.placementGraphics=placement.addComponent(Graphics);
        this.magnifier=new MagnifierView(root);
        this.spinPanel=new SpinPanelView(root);
        this.buildPause(root);
        this.panels=new PanelsView(root);this.resumeButton=this.panels.buttons[0];this.restartButton=this.panels.buttons[1];
        root.getComponentsInChildren(Label).forEach(label=>label.fontFamily=/Number glyph|Target |Power percentage|Fine aim value|Magnifier number/.test(label.node.name)?CLUB.numberFontFamily:CLUB.fontFamily);
    }

    private buildPause(parent: Node): void {
        this.pauseLayer=new Node('Pause overlay');this.pauseLayer.layer=Layers.Enum.UI_2D;parent.addChild(this.pauseLayer);
        this.pauseLayer.addComponent(UITransform);this.pauseLayer.addComponent(Graphics);
        const text=(name:string):Label=>{
            const node=new Node(name);node.layer=Layers.Enum.UI_2D;this.pauseLayer.addChild(node);
            node.addComponent(UITransform);node.addComponent(Graphics);
            const child=new Node(name+' text');child.layer=Layers.Enum.UI_2D;node.addChild(child);child.addComponent(UITransform);
            const label=child.addComponent(Label);label.overflow=Label.Overflow.SHRINK;return label;
        };
        this.pauseTitle=text('Pause heading');this.resumeButton=text('Resume');this.restartButton=text('Restart confirmation');
        this.pauseLayer.active=false;
    }

    private nextRack(replay?:Readonly<RackConfig>,profile?:Pick<RackConfig,'ballSetSeed'|'massVariation'>):BallState[]{
        this.rackConfig=replay?restoreRackConfig(replay):this.rackSession.next(profile);
        return createRack(this.rackConfig);
    }

    private reset(replay?:Readonly<RackConfig>): void {
        if(replay)replay=restoreRackConfig(replay);
        this.groupSelectedAt=-1000;this.history.reset();this.panelMode=null;this.resultShown=false;this.panelPage=0;this.placementInvalid=null;this.feedback?.stop();
        this.gameId++;this.shotSequence.cancel();this.fineAim.close();this.tip.reset();
        this.visualSpinDeltas.forEach(v=>{v.x=v.y=v.z=0;});
        this.paused=false;this.confirmingRestart=false;this.layoutStamp='';
        this.balls = this.nextRack(replay);
        const profile=this.rackConfig!;
        this.referee = new Referee(()=>this.nextRack(undefined,profile));
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

    private tablePoint(x: number, y: number,allowOutside=false): { x: number; z: number } | null {
        const ray = new geometry.Ray();
        this.camera.screenPointToRay(x, y, ray);
        if (Math.abs(ray.d.y) < 1e-6) return null;
        const t = (TABLE.radius - ray.o.y) / ray.d.y;
        if (t < 0) return null;
        const px = ray.o.x + ray.d.x * t, pz = ray.o.z + ray.d.z * t;
        if (!allowOutside&&(Math.abs(px) > TABLE.halfWidth || Math.abs(pz) > TABLE.halfLength)) return null;
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
        if (this.shotSequence.active || this.paused) return;
        const ref = this.referee;
        if (ref.phase === 'placing' && index === 1) {
            if (!ref.confirmPlacement(this.balls)) ref.message = '请先在合法位置摆放白球，再点确认';
        } else if (ref.phase === 'choice') {
            ref.chooseBreak(this.balls, index === 2 ? 'accept' : index === 0 ? 'self' : 'opponent');
        } else if (ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current]) {
            if (index < 2){ref.select(index === 0 ? 'solid' : 'stripe');this.groupSelectedAt=this.uiTime;this.notificationAt=this.uiTime;}
        } else if (ref.phase === 'over' && index === 1) this.reset();
        this.cancelDrag();
        this.syncVisuals();
    }

    private placeAt(x: number, y: number): void {
        const point = this.tablePoint(x, y,true);
        if (!point) return;
        if (!this.referee.placeCue(this.balls, point.x, point.z)) {
            const message=this.referee.hand==='head'?'位置无效：必须在线后，避开球和袋口':'位置无效：白球不能重叠其他球或放在袋口';
            this.placementInvalid={...point,until:this.uiTime+1.2,message};
        } else this.placementInvalid=null;
        this.syncVisuals();
    }

    private actionNode(action: Action): Node {
        if (typeof action === 'number') return this.actions[action].node.parent!;
        if(action.startsWith('modal-'))return this.panels.buttons[Number(action.slice(6))].node.parent!;
        if(action==='winner-identity')return this.panels.title.node;
        if(action==='identity0'||action==='identity1')return this.playerCards[action==='identity0'?0:1].node;
        return ({ pause:this.resetLabel.node, resume:this.resumeButton.node.parent!, restart:this.restartButton.node.parent!,
            shoot:this.shotButton.node, fine:this.fineButton.node.parent!,
            'fine-minus':this.fineMinus.node.parent!, 'fine-plus':this.finePlus.node.parent!,
            spin:this.spinButton.node.parent!, 'spin-cancel':this.spinPanel.cancel.node.parent!,
            'spin-done':this.spinPanel.done.node.parent!, 'spin-center':this.spinPanel.center.node.parent! } as Record<string,Node>)[action];
    }
    private begin(x: number, y: number): void {
        this.pendingAction=null;
        this.feedback?.unlock();
        this.lastPointer={x:x/this.hudPixelRatio,y:(screen.windowSize.height-y)/this.hudPixelRatio};
        if(this.rotationBlocked)return;
        if(this.panelMode&&this.panels){
            const modalTargets:Action[]=this.panels.actionIds.map((_,i)=>`modal-${i}` as Action);if(this.panelMode==='result')modalTargets.push('winner-identity');
            this.pendingAction=modalTargets.find(action=>this.hitUi(this.actionNode(action),x,y))??null;return;
        }
        const candidates: Action[] = this.paused ? ['resume','restart'] : this.tip.active ? ['spin-cancel','spin-done','spin-center'] : ['pause','identity0','identity1'];
        if (!this.paused && !this.tip.active && !this.shotSequence.active) candidates.push('spin','shoot','fine','fine-minus','fine-plus',0,1,2);
        this.pendingAction=candidates.find(action=>this.hitUi(this.actionNode(action),x,y))??null;
        if(this.tip.active&&this.pendingAction===null) {
            if(this.hitUi(this.spinPanel.surface,x,y)){this.adjustingSpin=true;this.setSpinAt(x,y);}
            else if(!this.hitUi(this.spinPanel.panel,x,y))this.pendingAction='spin-cancel';
            return;
        }
        if (this.pendingAction !== null || this.paused || this.backgrounded || this.shotSequence.active) return;
        if (this.referee.phase==='over'||this.referee.phase==='choice') return;
        if(this.referee.phase==='ready'&&!this.referee.isBreak&&!this.referee.groups[this.referee.current]&&!this.referee.selected)return;
        if (this.referee.phase==='ready'&&!isMoving(this.balls)) {
            if (this.hitUi(this.powerControl,x,y)) { this.adjustingPower=true;this.setPowerAt(x,y);return; }
            if (this.fineAim.active&&this.hitUi(this.fineControl,x,y)) { this.adjustingFine=true;this.setFineAt(x,y);return; }
        }
        if (this.referee.phase==='placing') { this.placing=true;this.placeAt(x,y);return; }
        if (this.referee.phase==='ready'&&!isMoving(this.balls)&&this.pointAt(x,y)) {
            this.dragging=true;this.fineAim.close();
        }
    }
    private move(x: number, y: number): void {
        if(this.panelMode||this.rotationBlocked)return;
        this.lastPointer={x:x/this.hudPixelRatio,y:(screen.windowSize.height-y)/this.hudPixelRatio};
        if (this.pendingAction!==null||this.paused||this.shotSequence.active) return;
        if(this.adjustingSpin){this.setSpinAt(x,y);return;}
        if(this.tip.active)return;
        if (this.placing) this.placeAt(x,y);
        else if (this.adjustingPower) this.setPowerAt(x,y);
        else if (this.adjustingFine) this.setFineAt(x,y);
        else if (this.dragging) this.pointAt(x,y);
    }
    private release(x: number, y: number): void {
        const action=this.pendingAction;this.pendingAction=null;
        if (action!==null&&(this.hitUi(this.actionNode(action),x,y)||(action==='spin-cancel'&&this.tip.active&&!this.hitUi(this.spinPanel.panel,x,y)))) {
            if(typeof action==='string'&&action.startsWith('modal-')){this.modalAction(this.panels.actionIds[Number(action.slice(6))]);this.cancelDrag();return;}
            if(action==='winner-identity'){this.identitySeat=this.referee.winner??0;this.identityReturn='result';this.panelMode='identity';}
            else if(action==='identity0'||action==='identity1'){this.identityReturn=null;this.identitySeat=action==='identity0'?0:1;this.pauseGame();this.panelMode='identity';}
            else if (action==='pause') this.pauseGame();
            else if (action==='resume'&&!this.backgrounded) { this.paused=false;this.panelMode=null;this.confirmingRestart=false;this.accumulator=0; }
            else if (action==='restart') {
                if (this.confirmingRestart) this.reset();else this.confirmingRestart=true;
            } else if (!this.paused&&!this.shotSequence.active) {
                if(action==='spin-cancel')this.tip.cancel();
                else if(action==='spin-done')this.tip.confirm();
                else if(action==='spin-center')this.tip.recenter();
                else if(this.tip.active)return;
                else if (action==='shoot') this.shoot();
                else if(action==='spin'&&this.referee.phase==='ready'&&!isMoving(this.balls))this.tip.open();
                else if (action==='fine'&&this.referee.phase==='ready'&&!isMoving(this.balls)) {
                    if (this.fineAim.active) this.fineAim.close();else this.fineAim.open(this.direction.x,this.direction.z);
                } else if ((action==='fine-minus'||action==='fine-plus')&&this.fineAim.active)
                    this.direction=this.fineAim.nudge(action==='fine-minus'?-1:1);
                else if (typeof action==='number') this.ruleAction(action);
            }
        }
        // Releasing a table drag only retains its direction; it never submits a shot.
        this.dragging=false;this.placing=false;this.adjustingPower=false;this.adjustingFine=false;this.adjustingSpin=false;
    }
    private setSpinAt(x:number,y:number):void {
        const p=this.spinPanel.surface.getComponent(UITransform)!.convertToNodeSpaceAR(this.hudCamera.screenToWorld(new Vec3(x,y,0)));
        this.tip.select(p.x/this.spinPanel.selectionRadius,p.y/this.spinPanel.selectionRadius);
    }
    private setFineAt(x:number,y:number):void {
        const world=this.hudCamera.screenToWorld(new Vec3(x,y,0));
        const local=this.fineControl.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        const half=this.fineControl.getComponent(UITransform)!.width/2-52*this.hudLayout.scale;
        this.direction=this.fineAim.set(local.x/Math.max(1,half)*5);
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
        this.dragging = false; this.adjustingPower = false; this.adjustingFine=false; this.adjustingSpin=false; this.placing = false;
        this.activeTouch = null; this.pendingAction = null;
    }
    private shoot(): void {
        if (this.paused||this.backgrounded||this.tip.active||this.adjustingPower||!mayShoot(this.balls,this.referee)) return;
        if (this.shotSequence.begin({gameId:this.gameId,player:this.referee.current,
            direction:this.direction,power:this.power,tipOffset:this.tip.value,selectedGroup:this.referee.selected})) {
            this.fineAim.close();this.accumulator=0;
        }
    }
    private pauseGame():void {
        this.panelMode='pause';this.feedback?.stop();
        this.paused=true;this.tip.cancel();this.shotSequence.cancelBeforeContact();this.cancelDrag();this.fineAim.close();this.accumulator=0;
    }
    private hideGame():void { this.backgrounded=true;this.pauseGame(); }
    private showGame():void { this.backgrounded=false;this.accumulator=0; }
    private touchCancel(event:EventTouch):void { if(event.getID()===this.activeTouch)this.cancelDrag(); }
    onDisable():void { this.tip.cancel();this.shotSequence.cancelBeforeContact();this.cancelDrag();this.accumulator=0; }
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
        this.uiTime+=Math.min(dt,.1);
        const landscape=screen.windowSize.width>screen.windowSize.height;
        if(landscape&&!this.rotationBlocked){this.pauseGame();this.rotationBlocked=true;}
        if(!landscape&&this.rotationBlocked){this.rotationBlocked=false;this.panelMode='pause';}

        const contactFrame=!this.paused&&!this.backgrounded&&this.shotSequence.advance(dt,
            snapshot=>{const committed=commitShot(snapshot,this.gameId,this.balls,this.referee);if(committed){this.lastContactShotId=snapshot.shotId;this.feedback?.play('strike');this.feedback?.haptic();}return committed;});
        if (!this.paused&&!this.backgrounded&&(!this.shotSequence.active||this.shotSequence.committed)) {
            // The first moving frame shares the exact visible contact pose, even after a long frame.
            this.accumulator=contactFrame?FIXED_STEP:Math.min(this.accumulator+dt,0.1);
            while(this.accumulator>=FIXED_STEP) {
                step(this.balls,FIXED_STEP,{respawnCue:false,onEvent:event=>{this.referee.observe(event,this.balls);this.feedback?.play(event.type==='contact'?'collision':event.type==='cushion'?'cushion':'pocket');}});
                this.balls.forEach(ball=>{
                    const v=this.visualSpinDeltas[ball.id];v.x+=(ball.wx??0)*FIXED_STEP;
                    v.y+=(ball.wy??0)*FIXED_STEP;v.z+=(ball.wz??0)*FIXED_STEP;
                });
                this.referee.trackCue(this.balls);
                if(this.referee.phase==='shooting'&&!isMoving(this.balls)){
                    const player=this.referee.shot?.player??this.referee.current;this.referee.finishShot(this.balls);this.tip.reset();this.notificationAt=this.uiTime;
                    this.history.record({shotId:this.lastContactShotId,player,reason:this.referee.message,phase:this.referee.phase,winner:this.referee.winner});
                    if(/犯规|判负|获胜/.test(this.referee.message))this.feedback?.haptic();
                }
                this.accumulator-=FIXED_STEP;
            }
        } else this.accumulator=0;
        this.syncVisuals();
        const size = screen.windowSize;
        const ref = this.referee;
        const currentName = playerName(this.players[ref.current], ref.current);
        const winnerName = ref.winner === null ? '' : playerName(this.players[ref.winner], ref.winner);
        this.status.string = '中式八球';
        this.turnLabel.string = ref.phase==='over'?`${winnerName} 获胜`:ref.phase==='shooting'?'球运动中':
            ref.phase==='choice'?`开球违规 · 由 ${currentName} 选择`:ref.phase==='placing'?`${currentName}${ref.isBreak?' 开球':''} · ${ref.hand==='head'?'线后摆球':'全台自由球'}`:
            ref.isBreak?`${currentName} 开球`:`${currentName}的回合 · ${ref.groups[ref.current]?groupName(ref.groups[ref.current])+'球':ref.selected?'进攻'+groupName(ref.selected)+'球':'开放球局'}`;
        this.decision.string = this.shotSequence.active&&!this.shotSequence.committed ? '准备出杆 · 参数已锁定' : ref.phase === 'placing'
            ? ref.isBreak ? '在线后轻触摆放白球，然后确认。' : `${ref.message}\n触摸台面摆白球，然后确认。`
            : ref.phase === 'shooting' ? '球正在运动，停稳后自动判罚。'
            : ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current]
                ? '先选进攻球组，再瞄准'
                : ref.phase === 'ready' && !ref.message ? '拖动瞄准，点击出杆' : ref.message;
        this.decision.string = playerMessage(this.decision.string, this.players);
        if(ref.phase==='placing')this.decision.string=ref.isBreak?'请在开球线后放置白球':playerMessage(ref.message,this.players);
        if(ref.phase==='ready'&&(ref.isBreak||!!ref.groups[ref.current]||!!ref.selected)&&this.uiTime-this.notificationAt>1.8)this.decision.string='';
        if(ref.phase==='over'&&!this.shotSequence.active&&!this.resultShown&&this.panels){this.resultShown=true;this.pauseGame();this.panelMode='result';}
        let labels = ['', '', ''];
        if (ref.phase === 'placing') labels[1] = '确认摆球';
        if (ref.phase === 'ready' && !ref.isBreak && !ref.groups[ref.current]&&(!ref.selected||this.uiTime-this.groupSelectedAt<.25))
            labels = [`${ref.selected === 'solid' ? '✓ 已选 ' : ''}全色球`, `${ref.selected === 'stripe' ? '✓ 已选 ' : ''}半色球`, ''];
        if(ref.phase==='choice'&&!this.shotSequence.active&&!this.panelMode&&this.panels){this.pauseGame();this.panelMode='break';}

        this.layoutHud(labels);
        this.drawAimGuide();
        if(this.panels){this.drawPlacement();
        this.renderPanels(this.hudLayout.width,this.hudLayout.height,Math.max(0,(sys.getSafeAreaRect(false).y-view.getVisibleOrigin().y)*this.hudLayout.height/view.getVisibleSize().height));}
        const rect=this.hudLayout.shoot;
        this.shotButton.render(rect.width,rect.height,this.hudLayout.scale,
            !this.paused&&!this.tip.active&&!this.shotSequence.active&&mayShoot(this.balls,ref),this.shotSequence.active,
            this.shotSequence.elapsedMs,ref.phase==='shooting',this.settings.value.reducedMotion,this.pendingAction==='shoot');
        this.balls.forEach(ball => {
            const node = this.numberNodes[ball.id];
            node.active = ball.id !== 0 && !ball.pocketed;
            if (!node.active) return;
            const position = this.camera.worldToScreen(new Vec3(ball.x, TABLE.radius * 2, ball.z));
            const ui = this.hudCamera.screenToWorld(new Vec3(position.x, position.y, 0));
            node.setPosition(ui.x, ui.y, 0);
            // Keep the white number medallion within the projected sphere silhouette.
            const edge = this.camera.worldToScreen(new Vec3(ball.x + TABLE.radius, TABLE.radius * 2, ball.z));
            const scale = Math.abs(edge.x - position.x) * 0.48 * this.hudCamera.orthoHeight * 2 / size.height / 15;
            node.setScale(scale, scale, 1);
        });
    }

    private layoutHud(labels: string[]): void {
        const size = screen.windowSize;
        // A scaled embedded preview can be narrower than a mobile frame.
        // Geometry and pointers share the same physical-pixel/HUD-unit ratio.
        const {width,height,pixelRatio}=computeHudViewport(size.width,size.height,screen.devicePixelRatio);
        this.hudPixelRatio=pixelRatio;
        // TTF labels rasterize using view.getScaleX(), independently of the HUD camera.
        // Match the design resolution to HUD units so text uses the actual render scale,
        // rather than enlarging low-resolution glyph textures from the old 960px design.
        const design = view.getDesignResolutionSize();
        if (design.width !== width || design.height !== height || Math.abs(view.getScaleX() - pixelRatio) > 0.001) {
            view.setDesignResolutionSize(width, height, ResolutionPolicy.EXACT_FIT);
            // Unchanged strings also need new textures after orientation/DPR changes.
            this.status.node.parent!.getComponentsInChildren(Label).forEach(label => label.updateRenderData(true));
        }
        this.hudCamera.orthoHeight = height / 2;
        const safe = sys.getSafeAreaRect(false), visible = view.getVisibleSize(), origin = view.getVisibleOrigin();
        const ratioX = width / visible.width, ratioY = height / visible.height;
        const insets = {
            left: Math.max(0, safe.x-origin.x)*ratioX,
            right: Math.max(0, origin.x+visible.width-safe.x-safe.width)*ratioX,
            bottom: Math.max(0, safe.y-origin.y)*ratioY,
            top: Math.max(0, origin.y+visible.height-safe.y-safe.height)*ratioY,
        };
        const active = labels.map((text, index) => text ? index : -1).filter(index => index !== -1);
        const selectingGroup=this.referee.phase==='ready'&&!this.referee.isBreak&&!this.referee.groups[this.referee.current]&&(!this.referee.selected||this.uiTime-this.groupSelectedAt<.25);
        const showPower = !selectingGroup&&(this.referee.phase==='over'||this.referee.phase==='choice'||(this.referee.phase==='ready'||this.referee.phase==='shooting')&&(this.referee.isBreak||!!this.referee.groups[this.referee.current]||!!this.referee.selected));
        const overlayChoice=this.referee.phase==='choice'||this.referee.phase==='over';
        const stamp = [width, height, ...Object.values(insets), this.referee.current, this.referee.phase, ...this.referee.groups, this.power, showPower, this.fineAim.active, this.fineAim.degrees, this.tip.active, this.tip.value.x, this.tip.value.y, this.tip.draft.x, this.tip.draft.y, this.shotSequence.active, this.paused, this.confirmingRestart,this.pendingAction,this.placementInvalid&&this.placementInvalid.until>this.uiTime?JSON.stringify(this.placementInvalid):'',
            ...this.players.flatMap(player => [player.id, player.nickname, player.avatar]), ...this.balls.map(ball => ball.pocketed), ...labels].join('|');
        if (stamp === this.layoutStamp) return;
        this.layoutStamp = stamp;
        const layout = computeHudLayout(width, height, { insets, showPower, actionCount: active.length, showShot:showPower, showFine:showPower&&this.fineAim.active,showDecision:!overlayChoice&&!!this.decision.string&&this.referee.phase!=='shooting' });
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
        this.status.fontSize = 18*s; this.status.lineHeight = 24*s;
        this.subtitle.node.setPosition(layout.status.x+layout.status.width/2-layout.width/2,layout.height/2-(layout.status.y+30),0);
        this.subtitle.node.getComponent(UITransform)!.setContentSize(layout.status.width,14);this.subtitle.fontSize=9;this.subtitle.lineHeight=12;
        place(this.turnLabel.node, layout.turn);
        this.turnLabel.fontSize = 12*s; this.turnLabel.lineHeight = 18*s;
        place(this.resetLabel.node, layout.reset);
        this.resetLabel.fontSize = 12*s; this.resetLabel.lineHeight = 18*s;
        this.resetLabel.string = '';
        const pause=this.pauseArtwork;pause.clear();pause.fillColor=new Color().fromHEX(CLUB.surface);
        pause.roundRect(-20,-19,40,40,12);pause.fill();pause.strokeColor=new Color().fromHEX(CLUB.ink);pause.lineWidth=2.5;pause.lineCap=Graphics.LineCap.ROUND;pause.lineJoin=Graphics.LineJoin.ROUND;
        pause.moveTo(-4,-6);pause.lineTo(-4,8);pause.moveTo(4,-6);pause.lineTo(4,8);pause.stroke();
        this.resetLabel.overflow = Label.Overflow.SHRINK;
        this.playerCards.forEach((card, player) => {
            const rect = layout.players[player];
            place(card.node, rect);
            const group = this.referee.groups[player as 0 | 1];
            card.render(this.players[player], player, group, group ? remaining(this.balls, group) : [],
                player === this.referee.current, rect.width, rect.height, s);
        });
        panel(this.dock, layout.dock, new Color().fromHEX(CLUB.background));
        place(this.decision.node, layout.decision);
        this.decision.node.active=layout.decision.height>0;
        this.decision.color=new Color().fromHEX(this.placementInvalid&&this.placementInvalid.until>this.uiTime?CLUB.loss:/犯规|落袋|不足|非法|越|未碰/.test(this.decision.string)?CLUB.foul:CLUB.muted);
        this.decisionHint.node.active=this.referee.phase==='placing';
        if(this.referee.phase==='placing'){
            this.decision.node.setPosition(layout.decision.x+layout.decision.width/2-layout.width/2,layout.height/2-(layout.decision.y+9.5),0);
            this.decision.node.getComponent(UITransform)!.setContentSize(layout.decision.width,24);this.decision.color=new Color().fromHEX(CLUB.foul);
            this.decisionHint.string=this.placementInvalid&&this.placementInvalid.until>this.uiTime?this.placementInvalid.message??this.referee.message:'轻触台面摆放，确认后进入瞄准';
            this.decisionHint.node.setPosition(layout.decision.x+layout.decision.width/2-layout.width/2,layout.height/2-(layout.decision.y+33),0);
            this.decisionHint.node.getComponent(UITransform)!.setContentSize(layout.decision.width,20);this.decisionHint.fontSize=12;this.decisionHint.lineHeight=18;
            this.decisionHint.color=new Color().fromHEX(this.placementInvalid&&this.placementInvalid.until>this.uiTime?CLUB.loss:CLUB.muted);
        }
        this.decision.fontSize = selectingGroup||this.referee.phase==='placing'?13:12; this.decision.lineHeight = 18*s;
        const gap = selectingGroup?13:8*s;
        const vertical = active.length === 3;
        const buttonWidth = vertical ? layout.actions.width
            : (layout.actions.width-gap*(active.length-1))/Math.max(1, active.length);
        this.actions.forEach((label, index) => {
            const node = label.node.parent!;
            node.active = !!labels[index]; label.string = labels[index];
            if (!node.active) return;
            const rect = { x: layout.actions.x + (vertical ? 0 : active.indexOf(index)*(buttonWidth+gap)),
                y: layout.actions.y + (vertical ? active.indexOf(index)*56*s : 0),
                width: buttonWidth, height: selectingGroup?60:48*s };
            panel(node, rect, new Color().fromHEX(active.length === 1 ? CLUB.gold : CLUB.surface));
            label.color = new Color().fromHEX(active.length === 1 ? CLUB.background : CLUB.ink);
            label.node.setPosition(0, 0, 0);
            label.node.getComponent(UITransform)!.setContentSize(rect.width - 16*s, rect.height - 8*s);
            label.fontSize = selectingGroup||this.referee.phase==='placing'?16:14*s; label.lineHeight = 20*s;
            if(this.referee.phase==='ready'&&!this.referee.isBreak&&!this.referee.groups[this.referee.current]&&this.referee.selected===(index===0?'solid':'stripe')){
                const bg=node.getComponent(Graphics)!;bg.strokeColor=new Color().fromHEX(CLUB.gold);bg.lineWidth=1;bg.stroke();
            }
        });
        this.groupHint.node.active=this.referee.phase==='ready'&&!this.referee.isBreak&&!this.referee.groups[this.referee.current]&&!this.referee.selected;
        this.groupHint.node.setPosition(0,layout.height/2-(layout.height-insets.bottom-7),0);
        this.powerControl.active = showPower;
        place(this.powerControl, layout.power);
        this.powerHalfWidth=(layout.power.width-6)/2;
        this.powerLabel.node.getComponent(UITransform)!.setContentSize(layout.power.width-60,20);
        this.powerLabel.horizontalAlign=Label.HorizontalAlign.LEFT;
        this.powerLabel.node.setPosition(-30,12.5,0);this.powerLabel.fontSize=12;this.powerLabel.lineHeight=18;this.powerLabel.color=new Color().fromHEX(CLUB.muted);
        this.powerLabel.string='击球力度'+(this.tip.value.x||this.tip.value.y?' · '+tipLabel(this.tip.value).replace(/\s*\d+%/g,'').replace(/\s*·\s*/g,''):'');
        this.powerValue.node.setPosition(layout.power.width/2-30,12.5,0);this.powerValue.node.getComponent(UITransform)!.setContentSize(60,20);
        this.powerValue.fontSize=13;this.powerValue.lineHeight=18;this.powerValue.string=Math.round(this.power/4*100)+'%';
        const fill=this.powerGraphics,half=this.powerHalfWidth,y=-14;
        fill.clear();fill.fillColor=new Color().fromHEX(CLUB.track);fill.roundRect(-half,y-2,half*2,4,2);fill.fill();
        fill.fillColor=new Color().fromHEX(this.referee.phase==='ready'&&!this.shotSequence.active&&!this.paused?CLUB.gold:CLUB.disabled);
        fill.roundRect(-half,y-2,half*2*this.power/4,4,2);fill.fill();fill.circle(-half+half*2*this.power/4,y,9);fill.fill();
        const decorate=(label:Label,rect:HudRect,title:string,primary=false):void=>{
            const pressed=this.pendingAction!==null&&this.actionNode(this.pendingAction)===label.node.parent;
            panel(label.node.parent!,rect,new Color().fromHEX(pressed?primary?'#CCB276':'#314A3D':primary?CLUB.gold:CLUB.surface));
            if(!primary){const border=label.node.parent!.getComponent(Graphics)!;border.strokeColor=new Color().fromHEX(CLUB.track);border.lineWidth=s;border.stroke();}
            label.string=title;label.color=new Color().fromHEX(primary?CLUB.background:this.referee.phase==='ready'&&!isMoving(this.balls)&&!this.shotSequence.active?CLUB.ink:CLUB.disabled);
            label.fontSize=14*s;label.lineHeight=20*s;
            label.node.getComponent(UITransform)!.setContentSize(rect.width-12*s,rect.height-8*s);
        };
        this.shotButton.node.active=showPower;
        place(this.shotButton.node,layout.shoot);
        this.fineButton.node.parent!.active=showPower;
        decorate(this.fineButton,layout.fineButton,'微调');
        this.fineButton.node.setPosition(13*s,0,0);
        const fineIcon=this.fineButton.node.parent!.getComponent(Graphics)!;
        fineIcon.strokeColor=new Color().fromHEX(this.referee.phase==='ready'&&!this.shotSequence.active?CLUB.ink:CLUB.disabled);
        fineIcon.lineCap=Graphics.LineCap.ROUND;fineIcon.lineJoin=Graphics.LineJoin.ROUND;fineIcon.lineWidth=1.5*s;fineIcon.circle(-17*s,0,6.1*s);fineIcon.stroke();
        for(const [x1,y1,x2,y2] of [[-27,0,-21,0],[-13,0,-7,0],[-17,-10,-17,-4],[-17,4,-17,10]]) {
            fineIcon.moveTo(x1*s,y1*s);fineIcon.lineTo(x2*s,y2*s);fineIcon.stroke();
        }
        this.spinButton.node.parent!.active=showPower;
        decorate(this.spinButton,layout.spinButton,'打点');this.spinButton.node.setPosition(13*s,0,0);
        const sg=this.spinButton.node.parent!.getComponent(Graphics)!;
        const offset=this.tip.value;
        sg.strokeColor=new Color().fromHEX(this.referee.phase==='ready'&&!this.shotSequence.active?CLUB.ink:CLUB.disabled);
        sg.lineWidth=1.5*s;sg.circle(-17*s,0,8.3*s);sg.stroke();
        sg.circle((-17+offset.x*4)*s,offset.y*4*s,1.8*s);sg.stroke();
        if(offset.x||offset.y){sg.strokeColor=new Color().fromHEX(CLUB.gold);const r=layout.spinButton;
            sg.roundRect(-r.width/2,-r.height/2,r.width,r.height,12*s);sg.stroke();}
        this.spinPanel.render(width,height,insets,this.tip.draft,this.tip.active);
        this.fineControl.active=this.fineMinus.node.parent!.active=this.finePlus.node.parent!.active=showPower&&this.fineAim.active;
        place(this.fineControl,layout.fine);
        const fg=this.fineControl.getComponent(Graphics)!;fg.clear();fg.strokeColor=new Color().fromHEX(CLUB.muted);fg.lineWidth=s;
        const fineHalf=layout.fine.width/2-52*s;
        fg.moveTo(-fineHalf,-5*s);fg.lineTo(fineHalf,-5*s);fg.stroke();
        fg.fillColor=new Color().fromHEX(CLUB.gold);fg.circle(fineHalf*this.fineAim.degrees/5,-5*s,4*s);fg.fill();
        this.fineLabel.string=`${this.fineAim.degrees.toFixed(1)}°`;this.fineLabel.fontSize=11*s;this.fineLabel.lineHeight=16*s;
        this.fineLabel.node.setPosition(0,12*s,0);this.fineLabel.node.getComponent(UITransform)!.setContentSize(100*s,20*s);
        decorate(this.fineMinus,{...layout.fine,width:44*s},'−');
        decorate(this.finePlus,{...layout.fine,x:layout.fine.x+layout.fine.width-44*s,width:44*s},'+');
        this.pauseLayer.active=false;
        this.renderPanels(width,height,insets.bottom);
        const area = layout.playArea;
        this.camera.rect = new Rect(area.x / layout.width, 1 - (area.y + area.height) / layout.height,
            area.width / layout.width, area.height / layout.height);
        this.camera.orthoHeight = Math.max(TABLE.outerHalfLength, TABLE.outerHalfWidth / (area.width / area.height));
        // Number medallions use these matrices immediately, before the renderer's next update.
        this.camera.camera?.update();
        this.hudCamera.camera?.update();
    }

    private modalAction(action:string):void {
        if(action==='resume'){this.panelMode=null;this.paused=false;this.confirmingRestart=false;this.accumulator=0;}
        else if(action==='restart'){this.panelMode='confirm';this.confirmingRestart=true;}
        else if(action==='cancel-restart'){this.panelMode=null;this.paused=false;this.confirmingRestart=false;this.accumulator=0;}
        else if(action==='confirm-restart'||action==='new-round')this.reset();
        else if(action==='settings'||action==='rules'){this.panelMode=action;this.panelPage=0;}
        else if(action==='back-pause'){this.panelMode='pause';this.panelPage=0;}
        else if(action==='close-identity'){this.panelMode=this.identityReturn;this.paused=!!this.identityReturn;this.identityReturn=null;this.accumulator=0;}
        else if(action==='select-group'){this.referee.selected=null;this.panelMode=null;this.paused=false;}
        else if(action.startsWith('break:')){this.panelMode=null;this.paused=false;this.ruleAction(Number(action.slice(6)));}
        else if(action==='view-table')this.panelMode='view';
        else if(action==='return-result')this.panelMode='result';
        else if(action==='rule-history'){this.panelPage=this.panelPage===2?0:2;this.historyPage=0;}
        else if(action==='history-prev')this.historyPage=Math.max(0,this.historyPage-1);
        else if(action==='history-next')this.historyPage=Math.min(Math.max(0,Math.ceil(this.history.entries.length/5)-1),this.historyPage+1);
        else if(action==='rule-next')this.panelPage=this.panelPage===0?1:0;
        else if(action.startsWith('setting:')){
            this.settings.toggle(action.slice(8) as SettingKey);if(!this.settings.value.sound)this.feedback?.stop();
        }
    }
    private renderPanels(width:number,height:number,bottom:number):void {
        if(!this.panels)return;
        const mode=this.rotationBlocked?'rotate':this.panelMode;
        const m:PanelModel={mode,title:'',body:'',actions:[],pressed:typeof this.pendingAction==='string'&&this.pendingAction.startsWith('modal-')?Number(this.pendingAction.slice(6)):-1};
        const back={id:'back-pause',title:'完成'};
        if(mode==='pause'){m.title='暂停一下';m.body='同屏对战 · 中式八球';m.actions=[{id:'resume',title:'继续对局',primary:true},{id:'restart',title:'重新开局'},{id:'settings',title:'设置'},{id:'rules',title:'本局规则'}];}
        else if(mode==='confirm'){m.title='重新开局？';m.body='当前球局和判罚记录将被清空';m.actions=[{id:'cancel-restart',title:'继续本局'},{id:'confirm-restart',title:'重新开局',primary:true}];}
        else if(mode==='break'){m.title='开球违规';m.body=playerMessage(this.referee.message,this.players)+'\n由 '+playerName(this.players[this.referee.current],this.referee.current)+' 选择处理方式';
            m.actions=this.referee.breakChoice==='illegal'?[{id:'break:0',title:'由我重开',primary:true},{id:'break:1',title:'原开球方重开'},{id:'break:2',title:'接受台面，获得自由球'}]:[...(!this.balls[0].pocketed?[{id:'break:0',title:'接受台面，继续击球'}]:[]),{id:'break:2',title:'线后自由球',primary:true}];}
        else if(mode==='settings'){
            m.title='设置';m.body=this.settings.persistent?'修改立即生效，并在本机保存。':'本机存储暂不可用，设置在本局有效。';
            const items:[SettingKey,string][]=[['sound','音效'],['haptics','振动反馈'],['aimGuide','辅助瞄准'],['magnifier','局部放大'],['reducedMotion','减少动态']];
            m.actions=[...items.map(([key,title])=>({id:'setting:'+key,title,checked:this.settings.value[key]})),{...back,title:'完成',primary:true}];
        } else if(mode==='rules'){
            m.title=this.panelPage===2?`本局判罚记录 ${this.historyPage+1}/${Math.max(1,Math.ceil(this.history.entries.length/5))}`:'本局规则';
            const pages=[
                '球组：1–7全色，9–15半色，8为黑球。\n开球：有目标球进袋或至少四颗目标球碰库。开球进球不分组。\n开放球局：选择进攻组；合法首碰并进该组球后才确定球组。\n普通犯规：白球落袋、未碰目标、首碰非法，或碰球后无进球且无球碰库，给对方自由球。\n线后自由球：须在线后摆放，并遵守越线击球要求。',
                '黑8：清完本组后，下一杆合法进8获胜。提前进8、同杆清最后一球并进8、进8同时犯规均判负。\n开球进8：重置8号，按裁判提供的开球选择处理，不直接判胜负。\n严重开球违规：按界面选择重开或接受台面；原开球方被要求重开后再次不足四球碰库会判负。\n无需指袋；无普通连续三次犯规自动输局。\n范围：不含跳球、飞台、身体犯规与完整赛事裁判。'];
            m.body=this.panelPage===2?(this.history.entries.slice(this.historyPage*5,this.historyPage*5+5).map((e,i)=>`${i+1}. ${playerName(this.players[e.player],e.player)}：${playerMessage(e.reason,this.players)}`).join('\n')||'本局暂无已结算判罚。'):pages[this.panelPage];
            m.actions=this.panelPage===2?[{id:'history-prev',title:'上一页'},{id:'history-next',title:'下一页'},{id:'rule-history',title:'返回规则'},back]:[{id:'rule-next',title:this.panelPage===0?'下一页':'规则首页'},{id:'rule-history',title:'查看本局记录'},back];
        } else if(mode==='identity'){
            const player=this.players[this.identitySeat];m.title='玩家资料';m.avatar=player.avatar;m.body=`完整昵称：\n${playerName(player,this.identitySeat)}\n\n球组：${groupName(this.referee.groups[this.identitySeat as 0|1])}\n本地同屏玩家 · 头像采用本地占位图`;m.actions=[...(!this.referee.isBreak&&!this.referee.groups[this.referee.current]&&this.identitySeat===this.referee.current?[{id:'select-group',title:'更改进攻球组'}]:[]),{id:'close-identity',title:'返回对局',primary:true}];
        } else if(mode==='result'){
            const winner=this.referee.winner??0;m.title=fitNickname(playerName(this.players[winner],winner),7)+' 获胜';m.body=playerMessage(this.referee.message,this.players);
            m.actions=[{id:'new-round',title:'再来一局',primary:true},{id:'view-table',title:'查看台面'}];
        } else if(mode==='view'){m.actions=[{id:'return-result',title:'返回对局结果',primary:true}];}
        else if(mode==='rotate'){m.title='请竖屏体验';m.body='旋回竖屏后可继续原球局。';}
        this.panels.render(width,height,bottom,m);
    }
    private drawPlacement():void {
        const g=this.placementGraphics;if(!g)return;g.clear();if(this.paused||this.referee.phase!=='placing')return;
        const invalid=this.placementInvalid&&this.placementInvalid.until>this.uiTime?this.placementInvalid:null;
        const ball=invalid??this.balls[0];if(!ball)return;
        const screenPoint=this.camera.worldToScreen(new Vec3(ball.x,TABLE.radius,ball.z));
        const p=this.hudCamera.screenToWorld(new Vec3(screenPoint.x,screenPoint.y,0));
        const edge=this.camera.worldToScreen(new Vec3(ball.x+TABLE.radius,TABLE.radius,ball.z));
        const r=Math.abs(edge.x-screenPoint.x)/this.hudPixelRatio+3;
        g.strokeColor=new Color().fromHEX(invalid?CLUB.loss:CLUB.gold);g.lineWidth=1.5;g.circle(p.x,p.y,r);g.stroke();
        if(invalid){g.moveTo(p.x-4,p.y-4);g.lineTo(p.x+4,p.y+4);g.moveTo(p.x-4,p.y+4);g.lineTo(p.x+4,p.y-4);g.stroke();}
    }

    private drawAimGuide():void {
        const g=this.aimGraphics;g.clear();
        const showMagnifier=!!this.magnifier&&this.settings.value.magnifier&&(this.dragging||this.fineAim.active);
        if(!showMagnifier)this.magnifier?.hide();
        if(this.paused||this.tip.active||this.shotSequence.active||this.referee.phase!=='ready'||!mayShoot(this.balls,this.referee)||isMoving(this.balls)){this.magnifier?.hide();return;}
        const cue=this.balls[0],hit=predictContact(cue,this.direction.x,this.direction.z,this.balls);
        if(!hit){this.magnifier?.hide();return;}
        const point=(x:number,z:number):Vec3=>{
            const screenPoint=this.camera.worldToScreen(new Vec3(x,TABLE.radius*2,z));
            return this.hudCamera.screenToWorld(new Vec3(screenPoint.x,screenPoint.y,0));
        };
        if(showMagnifier){
            // Protect actual projected pocket outlines, not guessed target pockets or UI corners.
            const hudPoint=(x:number,z:number):{x:number;y:number}=>{
                const p=this.camera.worldToScreen(new Vec3(x,TABLE.radius*2,z));
                return {x:p.x/this.hudPixelRatio,y:this.hudLayout.height-p.y/this.hudPixelRatio};
            };
            const protectedRects=POCKETS.map(pocket=>{
                const points=pocket.outline.map(p=>hudPoint(p.x,p.z));
                const x=Math.min(...points.map(p=>p.x))-12,y=Math.min(...points.map(p=>p.y))-12;
                return {x,y,width:Math.max(...points.map(p=>p.x))-x+12,height:Math.max(...points.map(p=>p.y))-y+12};
            });
            for(const p of [cue,hit,...this.balls.filter(b=>b.id===hit.target)]){
                const q=hudPoint(p.x,p.z);protectedRects.push({x:q.x-18,y:q.y-18,width:36,height:36});
            }
            this.magnifier?.render(this.hudLayout.width,this.hudLayout.height,this.hudLayout.playArea,this.balls,hit,this.lastPointer,this.settings.value.magnifier&&(this.dragging||this.fineAim.active),protectedRects);
        }
        if(!this.settings.value.aimGuide)return;
        const a=point(cue.x,cue.z),b=point(hit.x,hit.z),length=Math.hypot(b.x-a.x,b.y-a.y);
        const s=this.hudLayout.scale;g.lineWidth=s;g.strokeColor=new Color().fromHEX(CLUB.line);
        for(let offset=8*s;offset<length;offset+=7*s) {
            const end=Math.min(length,offset+3*s);
            g.moveTo(a.x+(b.x-a.x)*offset/length,a.y+(b.y-a.y)*offset/length);
            g.lineTo(a.x+(b.x-a.x)*end/length,a.y+(b.y-a.y)*end/length);g.stroke();
        }
        const edge=point(hit.x+TABLE.radius,hit.z),radius=Math.abs(edge.x-b.x);
        g.circle(b.x,b.y,radius);g.stroke();
    }

    private syncVisuals(): void {
        this.balls.forEach((ball, index) => {
            const node = this.ballNodes[index];
            const wasHidden = !node.active;
            node.active = !ball.pocketed;
            if (ball.pocketed) return;
            if (wasHidden) node.setPosition(ball.x, TABLE.radius, ball.z);
            const turn=this.visualSpinDeltas[ball.id],angle=Math.hypot(turn.x,turn.y,turn.z);
            if(angle>1e-7)node.rotate(Quat.fromAxisAngle(new Quat(),new Vec3(turn.x/angle,turn.y/angle,turn.z/angle),angle),Node.NodeSpace.WORLD);
            turn.x=turn.y=turn.z=0;
            node.setPosition(ball.x, TABLE.radius, ball.z);
        });
        const cue = this.balls[0];
        this.headLine.active = this.referee.phase === 'placing' && this.referee.hand === 'head';
        this.aim.active = !this.paused && mayShoot(this.balls,this.referee) && !cue.pocketed && !isMoving(this.balls);
        // The tip is nearest the cue ball; the shaft extends opposite the outgoing velocity.
        const pose=shotPose(this.shotSequence.elapsedMs,this.shotSequence.active,this.settings.value.reducedMotion);
        const gap=0.02+this.power/4*0.025;
        const tip=this.tip.value,lateral=tip.x*SPIN.contactFraction*TABLE.radius,vertical=tip.y*SPIN.contactFraction*TABLE.radius;
        const surfaceDepth=TABLE.radius*Math.sqrt(1-SPIN.contactFraction**2*(tip.x**2+tip.y**2));
        const behind=surfaceDepth+0.275+gap*(1-pose.cueShift/3.172);
        this.aim.setPosition(cue.x-this.direction.x*behind-this.direction.z*lateral,TABLE.radius+vertical,
            cue.z-this.direction.z*behind+this.direction.x*lateral);
        this.aim.setRotationFromEuler(0, Math.atan2(this.direction.x, this.direction.z) * 180 / Math.PI, 0);
    }

    onDestroy(): void {
        this.feedback?.stop();
        input.off(Input.EventType.TOUCH_START, this.touchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        game.off(Game.EVENT_HIDE,this.hideGame,this);game.off(Game.EVENT_SHOW,this.showGame,this);
        this.shotSequence.cancel();
        this.meshes.forEach(mesh => mesh.destroy());
        this.materials.forEach(material => material.destroy());
        this.textures.forEach(texture => texture.destroy());
    }
}

// Keep procedural mesh construction in one place for later replacement with imported models.
function utilsMesh(data: ReturnType<typeof primitives.box>): Mesh { return utils.createMesh(data); }

/** Ear clipping keeps concave rounded entrances intact; top faces look towards +Y. */
function tablePolygonMesh(points:readonly TablePoint[],height:number):Mesh {
    const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.z-a.z*b.x;},0);
    const sign=Math.sign(area),remaining=points.map((_,i)=>i),indices:number[]=[];
    const cross=(a:TablePoint,b:TablePoint,c:TablePoint):number=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    while(remaining.length>3) {
        let found=false;
        for(let i=0;i<remaining.length;i++) {
            const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
            if(cross(points[a],points[b],points[c])*sign<=1e-12)continue;
            if(remaining.some(j=>j!==a&&j!==b&&j!==c&&cross(points[a],points[b],points[j])*sign>=-1e-12&&
                cross(points[b],points[c],points[j])*sign>=-1e-12&&cross(points[c],points[a],points[j])*sign>=-1e-12))continue;
            indices.push(...(sign>0?[a,c,b]:[a,b,c]));remaining.splice(i,1);found=true;break;
        }
        if(!found)throw new Error('Invalid table polygon');
    }
    indices.push(...(sign>0?[remaining[0],remaining[2],remaining[1]]:remaining));
    return utils.createMesh({positions:points.flatMap(p=>[p.x,height,p.z]),normals:points.flatMap(()=>[0,1,0]),indices,
        minPos:{x:Math.min(...points.map(p=>p.x)),y:height,z:Math.min(...points.map(p=>p.z))},
        maxPos:{x:Math.max(...points.map(p=>p.x)),y:height,z:Math.max(...points.map(p=>p.z))}});
}
