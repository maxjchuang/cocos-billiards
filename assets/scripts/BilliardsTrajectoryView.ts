import { Color,Material,Mesh,MeshRenderer,Node,primitives,utils } from 'cc';
import { ShotPrediction } from './BilliardsTrajectory';
import { AimContact } from './BilliardsAim';
import { TABLE } from './BilliardsPhysics';
import { emptyMesh,MeshData,ribbon } from './BilliardsViewGeometry';
import { CameraPose,cameraProjection } from './BilliardsCameraMath';
/** Depth-tested world-space display of the one authoritative prediction copy. */
export class TrajectoryView {
    readonly node:Node;readonly ghost:Node;
    private nodes:Node[]=[];private meshes:(Mesh|null)[]=[null,null];private materials:Material[]=[];private ghostMesh:Mesh;
    private prediction:ShotPrediction|null=null;private stamp='';private visibilityStamp='';private lastBuild=-Infinity;offscreen=false;buildCount=0;
    constructor(parent:Node){
        this.node=new Node('Perspective prediction');parent.addChild(this.node);
        for(const [i,hex] of ['#F5F1E6','#E5BD74'].entries()){
            const mat=new Material();mat.initialize({effectName:'builtin-unlit',technique:1});mat.setProperty('mainColor',new Color().fromHEX(hex));this.materials.push(mat);
            const n=new Node('Ground trajectory '+i);this.node.addChild(n);n.addComponent(MeshRenderer).setMaterial(mat,0);this.nodes.push(n);
        }
        this.ghost=new Node('Contact ghost sphere');this.node.addChild(this.ghost);this.ghostMesh=utils.createMesh(primitives.sphere(TABLE.radius,{segments:16}));
        const ghostMat=new Material();ghostMat.initialize({effectName:'builtin-unlit',technique:1});ghostMat.setProperty('mainColor',new Color(245,241,230,28));this.materials.push(ghostMat);const r=this.ghost.addComponent(MeshRenderer);r.mesh=this.ghostMesh;r.setMaterial(ghostMat,0);this.node.active=false;
    }
    hide():void{this.node.active=false;this.offscreen=false;this.visibilityStamp='';}
    render(prediction:ShotPrediction|null,hit:AimContact|null,pose:CameraPose,aspect:number,time:number):void {
        this.node.active=!!prediction&&prediction.status!=='invalid';if(!this.node.active||!prediction)return;
        this.ghost.active=!!hit;if(hit)this.ghost.setPosition(hit.x,TABLE.radius,hit.z);
        const visibilityStamp=JSON.stringify([pose.position,pose.target,aspect,prediction.status,prediction.cue.points.length,prediction.target?.points.length]);if(this.prediction!==prediction||this.visibilityStamp!==visibilityStamp){this.offscreen=false;this.visibilityStamp=visibilityStamp;for(const path of [prediction.cue,prediction.target])if(path)for(const p of path.points)if(!cameraProjection(pose,{...p,y:.00045},aspect).visible){this.offscreen=true;break;}}
        const stamp=[prediction.status,prediction.cue.points.length,prediction.target?.points.length].join('|');
        if(this.prediction===prediction&&this.stamp===stamp)return;if(this.prediction===prediction&&prediction.status==='running'&&time-this.lastBuild<.08)return;
        this.prediction=prediction;this.stamp=stamp;this.lastBuild=time;this.buildCount++;
        [prediction.cue,prediction.target].forEach((path,i)=>{
            const n=this.nodes[i];n.active=!!path;if(!path)return;const m=emptyMesh(),dash=i?.03:.022,gap=.018;let distance=0;
            for(let j=1;j<path.points.length;j++){
                const a=path.points[j-1],b=path.points[j],l=Math.hypot(b.x-a.x,b.z-a.z);if(l<1e-9)continue;
                for(let start=0;start<l;){const phase=distance%(dash+gap),run=Math.min(l-start,(phase<dash?dash:dash+gap)-phase);if(run<1e-10){distance+=1e-8;start+=1e-8;continue;}
                    if(phase<dash)ribbon(m,{x:a.x+(b.x-a.x)*start/l,z:a.z+(b.z-a.z)*start/l},{x:a.x+(b.x-a.x)*(start+run)/l,z:a.z+(b.z-a.z)*(start+run)/l},.0025);start+=run;distance+=run;
                }
            }
            if(prediction.status==='complete'){
                const p=path.end,r=TABLE.radius*1.06;
                if(path.pocket!==null){ribbon(m,{x:p.x-.012,z:p.z-.008},p,.003);ribbon(m,p,{x:p.x+.012,z:p.z-.008},.003);}
                else if(i===0){for(let j=0;j<40;j++){const a=j*Math.PI/20,b=(j+1)*Math.PI/20;ribbon(m,{x:p.x+r*Math.cos(a),z:p.z+r*Math.sin(a)},{x:p.x+r*Math.cos(b),z:p.z+r*Math.sin(b)},.0025);}ribbon(m,{x:p.x-.006,z:p.z},{x:p.x+.006,z:p.z},.002);ribbon(m,{x:p.x,z:p.z-.006},{x:p.x,z:p.z+.006},.002);}
                else{const v=[{x:p.x,z:p.z-r},{x:p.x+r,z:p.z},{x:p.x,z:p.z+r},{x:p.x-r,z:p.z}];for(let j=0;j<4;j++)ribbon(m,v[j],v[(j+1)%4],.0025);}
            }
            if(!m.indices.length){n.active=false;return;}this.replace(i,m);
        });
    }
    private replace(i:number,data:MeshData):void{const old=this.meshes[i],mesh=utils.createMesh(data);this.nodes[i].getComponent(MeshRenderer)!.mesh=mesh;this.meshes[i]=mesh;old?.destroy();}
    destroy():void{this.node.destroy();this.meshes.forEach(m=>m?.destroy());this.ghostMesh.destroy();this.materials.forEach(m=>m.destroy());}
}
