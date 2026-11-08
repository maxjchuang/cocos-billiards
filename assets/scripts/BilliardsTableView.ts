import { Color,gfx,instantiate,isValid,Mat4,Material,Mesh,MeshRenderer,Node,Prefab,utils,Vec3 } from 'cc';
import { TablePoint } from './BilliardsTableGeometry';
import { clipMeshRectangle,MeshData,prism } from './BilliardsViewGeometry';

interface ClearancePart {
    renderer:MeshRenderer;
    source:Mesh;
    data:MeshData;
    faded:MeshRenderer;
    bounds:{minX:number;maxX:number;minZ:number;maxZ:number};
}

/** The local Creator-imported V8 derivative. Simulation geometry stays independent. */
export class TableView {
    readonly node:Node;
    readonly renderers:MeshRenderer[]=[];
    readonly meshes:Mesh[]=[];
    private parts:ClearancePart[]=[];
    private temporary:Mesh[]=[];
    private fadeMaterials:Material[]=[];
    private clearanceKey='';
    private remainders:Node[]=[];

    constructor(parent:Node,model:Prefab){
        this.node=new Node('First person table');parent.addChild(this.node);
        const table=instantiate(model);table.name='V8 table';table.setPosition(0,-.80,0);
        this.node.addChild(table);
        this.node.updateWorldTransform();
        const inverseRoot=new Mat4();Mat4.invert(inverseRoot,this.node.worldMatrix);
        let feltMaterial:Material|undefined;
        for(const renderer of table.getComponentsInChildren(MeshRenderer)){
            const shared=renderer.getSharedMaterial(0)!;
            if(shared.name==='Forest baize'){
                if(!feltMaterial){
                    feltMaterial=new Material();feltMaterial.copy(shared);
                    feltMaterial.setProperty('specularIntensity',.08);this.fadeMaterials.push(feltMaterial);
                }
                renderer.setMaterial(feltMaterial,0);
            }
            renderer.receiveShadow=1;
            renderer.shadowCastingMode=renderer.node.name.includes('Forest baize')&&!renderer.node.name.startsWith('06 ')?0:1;
            this.renderers.push(renderer);
            if(!renderer.node.name.startsWith('01 ')&&!renderer.node.name.startsWith('06 ')
                &&!renderer.node.name.startsWith('07 ')&&!renderer.node.name.startsWith('09 '))continue;
            const source=renderer.mesh!;
            const positions=source.readAttribute(0,gfx.AttributeName.ATTR_POSITION);
            const normals=source.readAttribute(0,gfx.AttributeName.ATTR_NORMAL);
            const uvs=source.readAttribute(0,gfx.AttributeName.ATTR_TEX_COORD);
            const indices=source.readIndices(0);
            if(!positions||!normals||!uvs||!indices)throw Error('球桌可视网格缺少位置、法线或UV');
            renderer.node.updateWorldTransform();
            const localMatrix=new Mat4();Mat4.multiply(localMatrix,inverseRoot,renderer.node.worldMatrix);
            const data:MeshData={positions:[],normals:[],uvs:Array.from(uvs),indices:Array.from(indices)};
            const position=new Vec3(),normal=new Vec3();
            for(let i=0;i<positions.length;i+=3){
                Vec3.transformMat4(position,new Vec3(positions[i],positions[i+1],positions[i+2]),localMatrix);
                // Cancel the parent transform before creating root-space replacement meshes.
                Vec3.transformMat4Normal(normal,new Vec3(normals[i],normals[i+1],normals[i+2]),localMatrix);
                normal.normalize();
                data.positions.push(position.x,position.y,position.z);
                data.normals.push(normal.x,normal.y,normal.z);
            }
            const original=renderer.getSharedMaterial(0)!;
            const ghost=new Node(renderer.node.name+' local clearance');this.node.addChild(ghost);
            const faded=ghost.addComponent(MeshRenderer);faded.setMaterial(original,0);faded.receiveShadow=1;
            const material=faded.getMaterialInstance(0)!;
            const color=original.getProperty('mainColor') as Color;
            material.setProperty('mainColor',new Color(color?.r??255,color?.g??255,color?.b??255,95));
            material.overridePipelineStates({blendState:{targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,
                blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.ONE,
                blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]},depthStencilState:{depthWrite:false}});
            this.fadeMaterials.push(material);
            ghost.active=false;
            const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
            for(let i=0;i<data.positions.length;i+=3){
                bounds.minX=Math.min(bounds.minX,data.positions[i]);bounds.maxX=Math.max(bounds.maxX,data.positions[i]);
                bounds.minZ=Math.min(bounds.minZ,data.positions[i+2]);bounds.maxZ=Math.max(bounds.maxZ,data.positions[i+2]);
            }
            this.parts.push({renderer,source,data,faded,bounds});
        }
        const ground=utils.createMesh(prism([{x:-12,z:-12},{x:12,z:-12},{x:12,z:12},{x:-12,z:12}],-.801));
        this.meshes.push(ground);
        const floor=new Node('Table ground');this.node.addChild(floor);
        const floorRenderer=floor.addComponent(MeshRenderer);floorRenderer.mesh=ground;
        const floorMaterial=new Material();floorMaterial.initialize({effectAsset:this.renderers[0].getSharedMaterial(0)!.effectAsset!});
        floorMaterial.setProperty('mainColor',new Color(47,55,45));floorMaterial.setProperty('roughness',.95);
        this.fadeMaterials.push(floorMaterial);floorRenderer.setMaterial(floorMaterial,0);floorRenderer.receiveShadow=1;
        this.node.active=false;
    }

    setCueClearance(cue:TablePoint,active:boolean):void {
        const near=active&&(Math.abs(cue.x)>.50||Math.abs(cue.z)>1.14);
        const key=near?`${cue.x.toFixed(3)},${cue.z.toFixed(3)}`:'';
        if(key===this.clearanceKey)return;
        this.clearanceKey=key;
        for(const part of this.parts){part.renderer.mesh=part.source;part.renderer.node.active=true;part.faded.node.active=false;}
        for(const node of this.remainders){node.active=false;node.destroy();}
        this.remainders=[];
        for(const mesh of this.temporary)mesh.destroy();
        this.temporary=[];
        if(!near)return;
        const box={minX:cue.x-.10,maxX:cue.x+.10,minZ:cue.z-.10,maxZ:cue.z+.10};
        for(const part of this.parts){
            if(part.bounds.maxX<box.minX||part.bounds.minX>box.maxX||part.bounds.maxZ<box.minZ||part.bounds.minZ>box.maxZ)continue;
            const split=clipMeshRectangle(part.data,box);
            if(!split.inside.indices.length)continue;
            // Both clipped meshes use table-root space, so the original renderer
            // remains untouched and the replacement nodes have identity transforms.
            part.renderer.node.active=false;
            if(split.outside.indices.length){
                const opaque=new Node(part.renderer.node.name+' clearance remainder');this.node.addChild(opaque);
                const renderer=opaque.addComponent(MeshRenderer);renderer.setMaterial(part.renderer.getSharedMaterial(0)!,0);
                renderer.receiveShadow=1;renderer.shadowCastingMode=1;
                const mesh=utils.createMesh(split.outside);renderer.mesh=mesh;
                this.temporary.push(mesh);this.remainders.push(opaque);
            }
            const faded=utils.createMesh(split.inside);part.faded.mesh=faded;part.faded.node.active=true;
            this.temporary.push(faded);
        }
    }
    destroy():void {
        for(const asset of [...this.temporary,...this.meshes,...this.fadeMaterials,this.node]){
            if(asset&&isValid(asset,true))asset.destroy();
        }
    }
}
