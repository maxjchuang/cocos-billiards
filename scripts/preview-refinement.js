// Development-only V1.14 visual/input regression. Uses isolated review fixtures.
async function previewRefinement(){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),checks=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));const check=(name,ok)=>{checks.push({name,passed:!!ok});if(!ok)throw Object.assign(Error(name),{checks});};
 const originalMode=g.matchMode;
 try{
  g.matchStarted=true;g.matchMode='local';g.panelMode=null;g.paused=false;await previewScenario('S01');
  const area=JSON.stringify(g.hudLayout.playArea);
  check('Power label is independent of prediction',g.powerLabel.string==='击球力度'&&!!g.trajectoryLabel&&!!g.targetLegend);
  const started=performance.now();while(g.aimPrediction?.status!=='complete'&&performance.now()-started<6000)await wait(40);
  check('Full prediction completes',g.aimPrediction?.status==='complete');
  check('Separate white cue and gold target captions',g.trajectoryLabel.string.includes('母球')&&g.targetLegend.string.includes('号')&&g.targetLegend.color.r!==g.trajectoryLabel.color.r);
  check('Prediction never replaces power title',g.powerLabel.string==='击球力度');
  g.settings.set('aimGuide',false);await wait(50);check('Disabling guide clears both legends',!g.trajectoryLabel.string&&!g.targetLegend.string&&g.powerLabel.string==='击球力度');g.settings.set('aimGuide',true);
  g.tip.open();await wait(50);check('Tip draft hides the two guide labels',!g.trajectoryLabel.string&&!g.targetLegend.string);g.tip.cancel();
  for(const b of g.balls)if(b.id>=1&&b.id<=7)b.pocketed=false;g.layoutStamp='';await wait(50);
  const card=g.playerCards[0],labels=card.numbers.filter(l=>l.node.active);check('Seven targets remain present and readable',labels.length===7&&labels.every(l=>l.fontSize>=8));
  check('Target circles stay inside the compact card',labels.every(l=>Math.abs(l.node.position.x)+9<=card.node.getComponent(m.UITransform).width/2));
  g.matchMode='ai';g.referee.current=1;g.players[1]={id:'ai-opponent',nickname:'AI 陪练',avatar:'sun'};g.aiActionAt=g.uiTime+100;g.aiPhaseStamp=[g.gameId,g.referee.current,g.referee.phase,g.referee.isBreak,g.referee.hand,g.referee.selected].join('|');await wait(50);
  check('AI waiting replaces inactive human controls',g.aiWaiting.node.active&&!g.powerControl.active&&!g.shotButton.node.active&&!g.fineButton.node.parent.active&&!g.spinButton.node.parent.active);
  check('AI wait preserves the table allocation',JSON.stringify(g.hudLayout.playArea)===area);
  check('AI level is a separate card label',g.playerCards[1].levelLabel.node.active&&g.playerCards[1].levelLabel.string.length===2);
  const shape=JSON.stringify(g.balls);g.shoot(true);await wait(20);check('AI preparation restores its visible shot animation',g.shotSequence.active&&g.shotButton.node.active&&!g.aiWaiting.node.active);g.pauseGame();check('Before-contact cancellation has not moved balls',JSON.stringify(g.balls)===shape);
  await wait(220);check('Pause has a list hierarchy and accessible restart',['resume','restart','settings','rules','new-game','ai-options'].every(x=>g.panels.actionIds.includes(x)));
  g.panelMode='settings';await wait(220);check('Settings describes full trajectories',g.panels.descriptions.some(l=>l.string.includes('预计停点')));
  g.identitySeat=0;g.panelMode='identity';await wait(220);check('Identity exposes enlarged target numbers',g.panels.targetLabels.filter(l=>l.node.active).length===7&&g.panels.targetLabels.filter(l=>l.node.active).every(l=>l.fontSize>=12));
  check('Table surface uses local texture shading',!!g.node.getChildByName('Cloth').getComponent(m.MeshRenderer).getSharedMaterial(0).getProperty('mainTexture'));
  check('No browser errors or unhandled rejections',(window.__refErrors??[]).length===0);
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},checks,errors:window.__refErrors??[]};
 }finally{g.matchMode=originalMode;await previewScenarioRestore();}
}
