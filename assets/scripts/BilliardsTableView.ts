import { Color,Material,Mesh,MeshRenderer,Node,Texture2D,utils } from 'cc';
import { CUSHION_PATHS,POCKETS,POCKET_MODEL,TABLE_GEOMETRY as G,TablePoint } from './BilliardsTableGeometry';
import { prism,cleanPolygon,mergeMeshes,subtractOpenings,intersectConvex } from './BilliardsViewGeometry';
/** Low-angle faces use the existing proxy outlines. No gameplay geometry is changed. */
export class TableView {
    readonly node:Node;readonly meshes:Mesh[]=[];readonly renderers:MeshRenderer[]=[];
    private volumes:{renderer:MeshRenderer;mesh:Mesh;surfaces:TablePoint[][];top:number;bottom:number;fade:MeshRenderer}[]=[];private temporary:Mesh[]=[];private fadeMaterials:Material[]=[];private clearanceKey='';
    constructor(parent:Node,materials:{wood:Material;rail:Material;felt:Material;pocket:Material}){
        this.node=new Node('First person table');parent.addChild(this.node);
        const fadeFor=(source:Material):Material=>{const m=new Material();m.initialize({effectName:'builtin-unlit',technique:1,defines:{USE_TEXTURE:true}});m.setProperty('mainTexture',source.getProperty('mainTexture') as Texture2D);m.setProperty('mainColor',new Color(255,255,255,110));this.fadeMaterials.push(m);return m;};
        const fadedWood=fadeFor(materials.wood),fadedRail=fadeFor(materials.rail);
        const add=(name:string,points:TablePoint[],top:number,bottom:number|undefined,material:Material,holes=false,hollow=false)=>{
            const surfaces=holes?subtractOpenings([points],POCKETS.map(p=>p.outline)):[points];
            const parts=surfaces.map(p=>prism(p,top,bottom));
            if(hollow&&bottom!==undefined){const side=parts[0],capCount=(cleanPolygon(points).length-2)*3;side.indices.splice(0,capCount);parts.push(prism(points,bottom));}
            const mesh=utils.createMesh(mergeMeshes(parts));this.meshes.push(mesh);const n=new Node(name);this.node.addChild(n);const r=n.addComponent(MeshRenderer);r.mesh=mesh;r.setMaterial(material,0);r.receiveShadow=1;r.shadowCastingMode=name.startsWith('Rail')||name.startsWith('Frame')?1:0;this.renderers.push(r);
            if(bottom!==undefined&&(name.startsWith('Frame')||name.startsWith('Rail'))){const ghost=new Node(name+' local clearance');this.node.addChild(ghost);const f=ghost.addComponent(MeshRenderer);f.setMaterial(name.startsWith('Frame')?fadedWood:fadedRail,0);ghost.active=false;this.volumes.push({renderer:r,mesh,surfaces,top,bottom,fade:f});}
        };
        // Separate frame strips leave the playing bed and pocket openings unobstructed.
        for(const sx of [-1,1])add('Frame side '+sx,[{x:sx*.63,z:-1.41},{x:sx*.77,z:-1.41},{x:sx*.77,z:1.41},{x:sx*.63,z:1.41}],-.004,-.16,materials.wood,true);
        for(const sz of [-1,1])add('Frame end '+sz,[{x:-.63,z:sz*1.27},{x:.63,z:sz*1.27},{x:.63,z:sz*1.41},{x:-.63,z:sz*1.41}],-.004,-.16,materials.wood,true);
        const cut=POCKET_MODEL.cornerMouth/Math.sqrt(2)+G.radius*.5*(Math.sqrt(2)-1),w=G.halfWidth,l=G.halfLength;
        add('Perspective cloth',[{x:-w+cut,z:-l},{x:w-cut,z:-l},{x:w,z:-l+cut},{x:w,z:l-cut},{x:w-cut,z:l},{x:-w+cut,z:l},{x:-w,z:l-cut},{x:-w,z:-l+cut}],0,undefined,materials.felt,true);
        CUSHION_PATHS.forEach((r,i)=>add('Rail volume '+i,r.polygon,.038,0,materials.rail));
        // Dark receptacle starts behind the unchanged lip. Side walls supply real occlusion.
        POCKETS.forEach((p,i)=>{add('Pocket interior '+i,p.outline,-.002,-.09,materials.pocket,false,true);});
        this.node.active=false;
    }
    setCueClearance(cue:TablePoint,active:boolean):void {
        const near=active&&(Math.abs(cue.x)>.50||Math.abs(cue.z)>1.14),key=near?`${cue.x.toFixed(3)},${cue.z.toFixed(3)}`:'';
        if(key===this.clearanceKey)return;this.clearanceKey=key;
        for(const v of this.volumes){v.renderer.mesh=v.mesh;v.renderer.node.active=true;v.fade.node.active=false;}
        this.temporary.forEach(m=>m.destroy());this.temporary=[];if(!near)return;
        const box=[{x:cue.x-.10,z:cue.z-.10},{x:cue.x+.10,z:cue.z-.10},{x:cue.x+.10,z:cue.z+.10},{x:cue.x-.10,z:cue.z+.10}];
        for(const v of this.volumes){const inside=v.surfaces.map(p=>intersectConvex(p,box)).filter(p=>p.length>=3);if(!inside.length)continue;
            const outside=subtractOpenings(v.surfaces,[box]),make=(pieces:TablePoint[][]):Mesh=>{const mesh=utils.createMesh(mergeMeshes(pieces.map(p=>prism(p,v.top,v.bottom))));this.temporary.push(mesh);return mesh;};
            v.renderer.node.active=outside.length>0;if(outside.length)v.renderer.mesh=make(outside);v.fade.node.active=true;v.fade.mesh=make(inside);
        }
    }
    destroy():void{this.temporary.forEach(m=>m.destroy());this.fadeMaterials.forEach(m=>m.destroy());this.node.destroy();this.meshes.forEach(m=>m.destroy());}
}
