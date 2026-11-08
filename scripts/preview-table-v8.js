// Controlled integration regression in the actual Creator Web Mobile frame loop.
(async function previewTableV8(geometryOverride){
    const engine=await System.import('cc');
    const modules=typeof System.entries==='function'?Array.from(System.entries()).map(([,value])=>value):[];
    const geometry=geometryOverride??modules.find(value=>value.CUSHION_PATHS&&value.POCKETS);
    if(!geometry)throw Error('Main table modules are not loaded');
    const g=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks=[],measurements={};
    const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw Error(name);};
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const frame=()=>new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
    const until=async(test,timeout=2500)=>{const start=performance.now();while(!test()&&performance.now()-start<timeout)await wait(16);return test();};
    g.draftMode='local';g.startMatch();g.referee.confirmPlacement(g.balls);await frame();
    const table=g.tableView;
    check('Imported V8 table is instantiated',table.node.getChildByName('V8 table')?.active);
    check('Old procedural table is hidden',!g.node.getChildByName('Table base').active);
    check('Review reference ball is absent',!table.node.getChildByName('V8 table').children.some(n=>n.name.startsWith('14 Reference')));
    check('Static table uses at most 30 renderers',table.renderers.length<=30);
    const dimensions={minimum:[Infinity,Infinity,Infinity],maximum:[-Infinity,-Infinity,-Infinity]};
    let triangles=0;
    const textures=new Set();
    for(const renderer of table.renderers){
        const bounds=renderer.model.worldBounds;
        for(const [i,key] of ['x','y','z'].entries()){
            dimensions.minimum[i]=Math.min(dimensions.minimum[i],bounds.center[key]-bounds.halfExtents[key]);
            dimensions.maximum[i]=Math.max(dimensions.maximum[i],bounds.center[key]+bounds.halfExtents[key]);
        }
        triangles+=(renderer.mesh.readIndices(0)?.length??0)/3;
        const texture=renderer.getSharedMaterial(0).getProperty('mainTexture');if(texture)textures.add(texture);
    }
    const size=dimensions.maximum.map((value,i)=>value-dimensions.minimum[i]);
    check('Imported table dimensions match metres',size.every((value,i)=>Math.abs(value-[1.54,.85,2.82][i])<.001));
    check('Game table stays below 80000 triangles',triangles<=80000);
    measurements.dimensions=dimensions;measurements.triangles=triangles;measurements.renderers=table.renderers.length;
    measurements.textures=[...textures].map(t=>({width:t.width,height:t.height,gpuBytes:t.getGFXTexture()?.size??null}));
    const textureBytes=measurements.textures.reduce((total,t)=>total+(t.gpuBytes??t.width*t.height*4*4/3),0);
    check('Table texture allocation stays below 32 MiB',textureBytes<32*1024*1024);
    measurements.textureBytes=textureBytes;
    check('Clearance materials blend without opaque depth writes',table.parts.every(part=>{const pass=part.faded.getMaterialInstance(0).passes[0];return pass.blendState.targets[0].blend&&!pass.depthStencilState.depthWrite;}));
    const baseChildren=table.node.children.length;
    g.booting=true;
    const savedPose=JSON.parse(JSON.stringify(g.cameraRig.freePose));
    g.cameraRig.freePose={position:{x:2.8,y:2,z:2.8},target:{x:0,y:0,z:0},distance:4.5,height:2,safe:true,reason:''};g.syncView();
    const depths=[];
    for(const x of [-.77,.77])for(const y of [-.8,.05])for(const z of [-1.41,1.41])depths.push(g.camera.worldToScreen(new engine.Vec3(x,y,z)).z);
    check('Far orbit keeps the complete table inside the depth range',depths.every(depth=>depth>=0&&depth<=1));
    g.cameraRig.freePose=savedPose;g.syncView();
    const visibility=g.node.children.map(node=>[node,node.active]);
    for(const node of g.node.children)node.active=node===table.node||node===g.camera.node||node===g.ballView.light.node;
    await frame();
    measurements.tableDrawCallsIncludingGroundAndShadows=engine.director.root.device.numDrawCalls;
    check('Table with ground and shadow passes stays within 30 draw calls',measurements.tableDrawCallsIncludingGroundAndShadows<=30);
    for(const [node,active] of visibility)node.active=active;
    const before=performance.now();
    for(let i=0;i<20;i++){
        table.setCueClearance({x:i%2?.60:-.60,z:(i%3-1)*1.20},true);
        check('V8 stays active during clearance '+i,table.node.getChildByName('V8 table').active);
        check('Clearance uses actual model pieces '+i,table.parts.some(p=>p.faded.node.active));
        table.setCueClearance({x:0,z:0},true);await frame();
        check('Clearance releases temporary resources '+i,table.temporary.length===0&&table.remainders.length===0&&table.node.children.length===baseChildren);
    }
    measurements.clearanceCyclesMs=performance.now()-before;
    const viewFixtures=[
        {name:'placement',phase:'placing'}, {name:'aim',phase:'ready'},
        {name:'break-choice',phase:'choice'}, {name:'AI',phase:'ready',ai:true},
        {name:'motion',phase:'shooting'}, {name:'paused-table',phase:'ready',paused:true},
        {name:'result-table',phase:'over',paused:true},
    ];
    for(const fixture of viewFixtures){
        g.referee.phase=fixture.phase;g.matchMode=fixture.ai?'ai':'local';g.referee.current=fixture.ai?1:0;
        g.paused=!!fixture.paused;g.panelMode=fixture.paused?'view':null;g.syncView();
        const balls=JSON.stringify(g.balls),direction=JSON.stringify(g.direction),pose=JSON.stringify(g.cameraRig.freePose);
        g.cameraRig.observe(5,3,1.01);g.syncView();
        check('V8 supports observation during '+fixture.name,table.node.active&&table.node.getChildByName('V8 table').active&&pose!==JSON.stringify(g.cameraRig.freePose));
        check('Observation preserves gameplay during '+fixture.name,balls===JSON.stringify(g.balls)&&direction===JSON.stringify(g.direction));
    }
    g.startMatch();g.booting=false;
    measurements.pockets=[];
    for(let index=0;index<geometry.POCKETS.length;index++)for(const speed of [.3,8]){
        g.reset();g.paused=false;g.backgrounded=false;
        for(const ball of g.balls)Object.assign(ball,{pocketed:true,vx:0,vz:0,wx:0,wy:0,wz:0});
        const pocket=geometry.POCKETS[index],ball=g.balls[1],distance=speed<1?.025:.09;
        Object.assign(ball,{pocketed:false,x:pocket.lip.x-pocket.normal.x*distance,z:pocket.lip.z-pocket.normal.z*distance,vx:pocket.normal.x*speed,vz:pocket.normal.z*speed});
        g.syncVisuals();
        const scale=g.ballNodes[1].scale.clone();
        check('Pocket captures '+index+'/'+speed,await until(()=>ball.pocketed));
        check('Falling ball remains present '+index+'/'+speed,g.ballNodes[1].active&&!!g.pocketAnimation.position(1));
        await wait(55);const height=g.ballNodes[1].position.y;
        check('Ball descends after capture '+index+'/'+speed,height<.028575);
        g.paused=true;await wait(70);
        check('Pause freezes fall '+index+'/'+speed,Math.abs(g.ballNodes[1].position.y-height)<1e-6);
        check('Ball keeps its scale '+index+'/'+speed,g.ballNodes[1].scale.equals(scale));
        g.paused=false;check('Ball disappears after descent '+index+'/'+speed,await until(()=>!g.ballNodes[1].active));
        measurements.pockets.push({index,speed,pausedHeight:height});
    }
    const TableView=g.tableView.constructor;
    const prefab=engine.resources.get('models/table-v8/table/table',engine.Prefab);
    const parent=new engine.Node('Table lifecycle probe');g.node.addChild(parent);parent.setRotationFromEuler(0,37,0);
    const buffers=[];
    for(let i=0;i<22;i++){
        const instance=new TableView(parent,prefab);
        if(i===0)check('Clearance normals are independent of the parent rotation',instance.parts.every((part,index)=>part.data.normals.every((value,j)=>Math.abs(value-table.parts[index].data.normals[j])<1e-5)));
        instance.setCueClearance({x:.6,z:1.2},true);
        const assets=[...instance.temporary,...instance.meshes,...instance.fadeMaterials];
        instance.destroy();await frame();
        // MaterialInstance.destroy releases its passes without toggling CCObject validity.
        check('Whole table releases owned resources '+i,parent.children.length===0&&
            assets.every(asset=>!engine.isValid(asset,true)||(asset instanceof engine.Material&&asset.passes.length===0)));
        if(i>=2)buffers.push(engine.director.root.device.memoryStatus.bufferSize);
    }
    parent.destroy();measurements.lifecycleBufferBytes=buffers;
    check('Repeated table instances do not accumulate GPU buffers',Math.max(...buffers)-Math.min(...buffers)<65536);
    g.startMatch();g.referee.confirmPlacement(g.balls);await frame();
    const report={engine:engine.VERSION,viewport:[innerWidth,innerHeight,devicePixelRatio],
        mode:'controlled component entry points and actual frames; no hardware certification',
        checks,measurements,passed:checks.filter(c=>c.passed).length,total:checks.length};
    window.tableV8Report=report;
    return report;
})
