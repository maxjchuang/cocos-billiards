// Development only: resets the table. Controlled velocities run in the actual Cocos update loop.
// The separate DOM smoke tests verify touch shooting/referee flow; this probe is not physical input.
async function previewPockets() {
    const engine=await System.import('cc');
    const geometry=await System.import('chunks:///_virtual/BilliardsTableGeometry.ts');
    const g=engine.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if(!g?.spinPanel)throw new Error('Load Main first.');
    const {TABLE_GEOMETRY:T,POCKETS,pocketCoordinates}=geometry,results=[],measurements=[];
    const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw new Error(name);};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const draw=()=>new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
    try {
        g.reset();await draw();
        const base=g.node.getChildByName('Table base').scale;
        check('Visible outer frame uses the revised 1.54 by 2.82 metre proportions',Math.abs(base.x-1.54)<1e-5&&Math.abs(base.z-2.82)<1e-5);
        const rails=g.node.children.filter(n=>n.name.startsWith('Cushion ')),pockets=g.node.children.filter(n=>n.name.startsWith('Pocket '));
        check('Eight continuous rail pieces and six individual pocket meshes are present',rails.length===8&&pockets.length===6);
        check('All procedural meshes have finite bounds inside the outer frame',[...rails,...pockets].every(n=>{
            const s=n.getComponent(engine.MeshRenderer).mesh.struct,a=s.minPosition,b=s.maxPosition;
            return a&&b&&[a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite)&&a.x>=-T.outerHalfWidth&&b.x<=T.outerHalfWidth&&a.z>=-T.outerHalfLength&&b.z<=T.outerHalfLength;
        }));
        const rect=g.camera.rect,size=engine.screen.windowSize;
        check('The whole revised frame fits the reserved table viewport',[-1,1].every(x=>[-1,1].every(z=>{
            const p=g.camera.worldToScreen(new engine.Vec3(x*T.outerHalfWidth,0,z*T.outerHalfLength));
            return p.x>=rect.x*size.width-1e-4&&p.x<=(rect.x+rect.width)*size.width+1e-4&&p.y>=rect.y*size.height-1e-4&&p.y<=(rect.y+rect.height)*size.height+1e-4;
        })));
        for(let index=0;index<POCKETS.length;index++)for(const speed of [.3,8]){
            const p=POCKETS[index];g.reset();await draw();
            for(const b of g.balls){b.pocketed=true;b.vx=b.vz=0;b.wx=b.wy=b.wz=0;}
            const b=g.balls[1],distance=speed<1?.025:.09;
            Object.assign(b,{pocketed:false,x:p.lip.x-p.normal.x*distance,z:p.lip.z-p.normal.z*distance,vx:p.normal.x*speed,vz:p.normal.z*speed});
            g.syncVisuals();const started=performance.now();
            while(!b.pocketed&&performance.now()-started<2000)await wait(16);
            await draw();
            check(`Pocket ${index+1} captures speed ${speed} in the actual frame loop`,b.pocketed&&pocketCoordinates(b,p).v>=p.dropDepth-1e-8);
            check(`Pocket ${index+1} removes the sphere and number label together`,!g.ballNodes[1].active&&!g.numberNodes[1].active);
            measurements.push({pocket:index+1,speed,elapsedMs:Math.round(performance.now()-started)});
        }
        return {engine:engine.ENGINE_VERSION,mode:'Controlled velocities, actual Cocos frames; not hardware touch',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},results,measurements};
    }catch(error){error.results=results;throw error;}
    finally{g.reset();}
}
