import { Color,DirectionalLight,EffectAsset,Material,Mesh,MeshRenderer,Node,Texture2D,utils,Vec3,Vec4 } from 'cc';
import { TABLE_GEOMETRY as G } from './BilliardsTableGeometry';
import { numberedBallPixels } from './BilliardsBallTexture';
import { onCloth } from './BilliardsCameraMath';
import { emptyMesh } from './BilliardsViewGeometry';
import { BallState } from './BilliardsPhysics';
/** True sphere materials and ground-plane contact shadows, shared live ball transforms. */
export class BallView {
    readonly materials:Material[]=[];readonly textures:Texture2D[]=[];readonly light:DirectionalLight;
    private original:Material[]=[];private shadows:Node[]=[];private shadowMeshes:Mesh[]=[];private shadowMaterial:Material;
    private active=false;private cueRenderers:MeshRenderer[]=[];private cueOriginal:Material[]=[];private cueMaterials:Material[]=[];
    constructor(private parent:Node,private balls:Node[],effect:EffectAsset){
        const lamp=new Node('Fixed billiards key light');parent.addChild(lamp);lamp.setPosition(-1,3,-1);lamp.lookAt(new Vec3(0,0,0));
        this.light=lamp.addComponent(DirectionalLight);this.light.color=new Color(255,248,229);this.light.illuminance=parent.scene.globals.skybox.useHDR?48000:.85;this.light.shadowEnabled=true;this.light.shadowDistance=5;this.light.shadowBias=.0001;this.light.shadowNormalBias=.0002;this.light.shadowPcf=3;this.light.enableCSM=false;this.light.shadowFixedArea=true;this.light.shadowOrthoSize=1.65;
        const globals=parent.scene.globals;globals.ambient.skyColor=new Vec4(.8,.82,.8,1);globals.ambient.groundAlbedo=new Vec4(.4,.45,.4,1);globals.ambient.skyIllum=globals.skybox.useHDR?18000:.8;
        globals.shadows.type=1;globals.shadows.shadowMapSize=1024;globals.shadows.enabled=false;
        this.shadowMaterial=new Material();this.shadowMaterial.initialize({effectName:'builtin-unlit',technique:1,defines:{USE_TEXTURE:true}});this.shadowMaterial.setProperty('mainColor',new Color(12,25,17,180));
        const tex=new Texture2D(),size=64,pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);pixels.set([255,255,255,Math.round(Math.max(0,1-r)**2*190)],(y*size+x)*4);}
        tex.reset({width:size,height:size,format:Texture2D.PixelFormat.RGBA8888});tex.uploadData(pixels);this.textures.push(tex);this.shadowMaterial.setProperty('mainTexture',tex);
        balls.forEach((n,id)=>{
            const renderer=n.getComponent(MeshRenderer)!;this.original.push(renderer.getSharedMaterial(0)!);
            const t=new Texture2D();t.reset({width:256,height:128,format:Texture2D.PixelFormat.RGBA8888});t.uploadData(numberedBallPixels(id));this.textures.push(t);
            const mat=new Material();mat.initialize({effectAsset:effect,defines:{USE_ALBEDO_MAP:true}});mat.setProperty('mainColor',new Color(255,255,255));mat.setProperty('mainTexture',t);mat.setProperty('roughness',.28);mat.setProperty('metallic',0);mat.setProperty('specularIntensity',.3);this.materials.push(mat);
            const shadow=new Node('Contact footprint '+id);parent.addChild(shadow);shadow.addComponent(MeshRenderer).setMaterial(this.shadowMaterial,0);this.shadows.push(shadow);this.shadowMeshes.push(utils.createMesh({positions:[0,0,0,0,0,0,0,0,0],normals:[0,1,0,0,1,0,0,1,0],uvs:[0,0,0,0,0,0],indices:[0,1,2]}));shadow.active=false;
        });
        this.cueRenderers=parent.getChildByName('Cue stick')?.getComponentsInChildren(MeshRenderer)??[];
        for(const r of this.cueRenderers){const source=r.getSharedMaterial(0)!;this.cueOriginal.push(source);const m=new Material();m.initialize({effectAsset:effect});m.setProperty('mainColor',source.getProperty('mainColor') as Color);m.setProperty('roughness',.6);m.setProperty('metallic',0);this.cueMaterials.push(m);}
        this.light.node.active=false;
    }
    setActive(active:boolean):void {
        if(this.active===active)return;this.active=active;this.light.node.active=active;this.parent.scene.globals.shadows.enabled=active;
        this.balls.forEach((n,i)=>{const r=n.getComponent(MeshRenderer)!;r.setMaterial(active?this.materials[i]:this.original[i],0);r.shadowCastingMode=active?1:0;r.receiveShadow=active?1:0;});
        this.cueRenderers.forEach((r,i)=>{r.setMaterial(active?this.cueMaterials[i]:this.cueOriginal[i],0);r.shadowCastingMode=active?1:0;r.receiveShadow=active?1:0;});
        if(!active)this.shadows.forEach(n=>n.active=false);
    }
    private stamp:string[]=[];private supported:boolean[]=[];
    sync(balls:readonly BallState[]):void {
        if(!this.active)return;
        balls.forEach((b,i)=>{
            const n=this.shadows[i];n.active=!b.pocketed;if(b.pocketed)return;
            const near=Math.abs(b.x)>.55||Math.abs(b.z)>1.19;
            const key=near?`${b.x.toFixed(4)},${b.z.toFixed(4)}`:'interior';
            n.setPosition(b.x+.002,.00015,b.z+.002);
            if(this.stamp[i]===key){n.active=this.supported[i]!==false;return;}this.stamp[i]=key;const m=emptyMesh(),r=G.radius*1.07,grid=6;
            for(let z=0;z<grid;z++)for(let x=0;x<grid;x++){
                const vertices=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]].map(([a,c])=>({x:(a/grid-.5)*r*2,z:(c/grid-.5)*r*2,u:a/grid,v:c/grid}));
                if(near&&!vertices.every(p=>onCloth({x:b.x+.002+p.x,z:b.z+.002+p.z})))continue;const index=m.positions.length/3;
                for(const p of vertices){m.positions.push(p.x,0,p.z);m.normals.push(0,1,0);m.uvs.push(p.u,p.v);}m.indices.push(index,index+2,index+1,index,index+3,index+2);
            }
            if(!m.indices.length){n.active=false;this.supported[i]=false;return;}this.supported[i]=true;const old=this.shadowMeshes[i],mesh=utils.createMesh(m);n.getComponent(MeshRenderer)!.mesh=mesh;this.shadowMeshes[i]=mesh;old.destroy();
        });
    }
    destroy():void{this.light.node.destroy();this.shadows.forEach(n=>n.destroy());this.shadowMeshes.forEach(m=>m.destroy());this.materials.forEach(m=>m.destroy());this.cueMaterials.forEach(m=>m.destroy());this.shadowMaterial.destroy();this.textures.forEach(t=>t.destroy());}
}
