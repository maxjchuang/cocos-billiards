import { Camera,Rect,Vec3 } from 'cc';
import { CameraPose,solveCamera,CAMERA_CONFIG } from './BilliardsCameraMath';
import { HudLayout } from './BilliardsLayout';
import { TABLE } from './BilliardsPhysics';
import { ViewMode } from './BilliardsViewState';
export class CameraRig {
    freePose:CameraPose={position:{x:.3,y:1.8,z:0},target:{x:0,y:0,z:0},distance:1.8,height:1.8,safe:true,reason:''};
    overview():void {this.returning=null;this.freePose={position:{x:.3,y:1.8,z:0},target:{x:0,y:0,z:0},distance:1.8,height:1.8,safe:true,reason:''};}
    private returning:{from:CameraPose;to:CameraPose;elapsed:number}|null=null;
    returnToShot(cue:{x:number;z:number},direction:{x:number;z:number},height:number,reduced=false,tip={x:0,y:0},power=2.4):void {
        const to=this.locked??solveCamera(cue,direction,height,tip,power);
        if(reduced){this.freePose=JSON.parse(JSON.stringify(to));this.returning=null;}
        else this.returning={from:JSON.parse(JSON.stringify(this.freePose)),to,elapsed:0};
    }
    observe(dx:number,dy:number,zoom:number):void {
        this.returning=null;const p=this.freePose,t=p.target;
        const x=p.position.x-t.x,y=p.position.y-t.y,z=p.position.z-t.z;
        const distance=Math.max(.2,Math.min(4.5,Math.hypot(x,y,z)*zoom));
        const yaw=Math.atan2(x,z)-dx*.008;const pitch=Math.max(.14,Math.min(1.48,Math.atan2(y,Math.hypot(x,z))+dy*.008));
        p.position={x:t.x+Math.sin(yaw)*Math.cos(pitch)*distance,y:Math.max(.09,t.y+Math.sin(pitch)*distance),z:t.z+Math.cos(yaw)*Math.cos(pitch)*distance};p.distance=distance;
    }
    pose:CameraPose|null=null;locked:CameraPose|null=null;unsafe=false;private stamp='';
    constructor(readonly camera:Camera){}
    lock(pose:CameraPose|null=this.pose):void{this.locked=pose?JSON.parse(JSON.stringify(pose)):null;}
    unlock():void{this.locked=null;}
    apply(mode:ViewMode,layout:HudLayout,cue:{x:number;z:number},direction:{x:number;z:number},height:number,tip={x:0,y:0},power=2.4,dt=1/60):boolean {
        if(this.returning){const r=this.returning;r.elapsed=Math.min(.28,r.elapsed+Math.max(0,Math.min(dt,.1)));const t=r.elapsed/.28;const f=t*t*(3-2*t);for(const key of ['position','target'] as const)for(const axis of ['x','y','z'] as const)this.freePose[key][axis]=r.from[key][axis]+(r.to[key][axis]-r.from[key][axis])*f;if(t===1){this.freePose=JSON.parse(JSON.stringify(r.to));this.returning=null;}}
        const a=layout.playArea;const stamp=JSON.stringify([mode,a,layout.width,layout.height,mode==='first-person'?(this.freePose):null]);if(stamp===this.stamp)return true;
        this.camera.rect=new Rect(a.x/layout.width,1-(a.y+a.height)/layout.height,a.width/layout.width,a.height/layout.height);
        if(mode==='first-person'){
            const pose=this.freePose;this.unsafe=!pose.safe;if(!pose.safe)return false;this.pose=pose;
            this.camera.projection=Camera.ProjectionType.PERSPECTIVE;this.camera.fovAxis=0;this.camera.fov=CAMERA_CONFIG.fov;this.camera.near=CAMERA_CONFIG.near;this.camera.far=CAMERA_CONFIG.far;
            this.camera.node.setPosition(pose.position.x,pose.position.y,pose.position.z);this.camera.node.lookAt(new Vec3(pose.target.x,pose.target.y,pose.target.z),new Vec3(0,1,0));
        }else{
            this.camera.projection=Camera.ProjectionType.ORTHO;this.camera.near=.1;this.camera.far=30;
            this.camera.node.setPosition(0,6,0);this.camera.node.lookAt(new Vec3(0,0,0),new Vec3(0,0,-1));
            this.camera.orthoHeight=Math.max(TABLE.outerHalfLength,TABLE.outerHalfWidth/(a.width/a.height));this.pose=null;this.unsafe=false;
        }
        this.camera.camera?.update();this.stamp=stamp;return true;
    }
}
