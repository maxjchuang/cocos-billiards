import { Camera,Rect,Vec3 } from 'cc';
import { CameraPose,solveCamera,CAMERA_CONFIG } from './BilliardsCameraMath';
import { HudLayout } from './BilliardsLayout';
import { TABLE } from './BilliardsPhysics';
import { ViewMode } from './BilliardsViewState';
export class CameraRig {
    pose:CameraPose|null=null;locked:CameraPose|null=null;unsafe=false;private stamp='';
    constructor(readonly camera:Camera){}
    lock(pose:CameraPose|null=this.pose):void{this.locked=pose?JSON.parse(JSON.stringify(pose)):null;}
    unlock():void{this.locked=null;}
    apply(mode:ViewMode,layout:HudLayout,cue:{x:number;z:number},direction:{x:number;z:number},height:number,tip={x:0,y:0},power=2.4):boolean {
        const a=layout.playArea;const stamp=JSON.stringify([mode,a,layout.width,layout.height,mode==='first-person'?(this.locked??[cue,direction,height,tip,power]):null]);if(stamp===this.stamp)return true;
        this.camera.rect=new Rect(a.x/layout.width,1-(a.y+a.height)/layout.height,a.width/layout.width,a.height/layout.height);
        if(mode==='first-person'){
            const pose=this.locked??solveCamera(cue,direction,height,tip,power);this.unsafe=!pose.safe;if(!pose.safe)return false;this.pose=pose;
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
