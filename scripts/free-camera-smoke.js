// Run against the Creator Web Mobile build in a browser development console.
// Uses the component's touch entry points; physical-device touch remains a separate check.
(async function () {
    const game = cc.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks = [];
    const check = (name, pass) => checks.push({name, pass: !!pass});
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const touch = (id, x, y) => ({
        getID: () => id,
        getLocation: () => ({x: x * game.hudPixelRatio, y: (game.hudLayout.height - y) * game.hudPixelRatio}),
    });
    game.draftMode = 'local';
    game.startMatch();
    await wait(50);
    check('single perspective scene during placement', game.viewState.mode === 'first-person');
    game.touchStart(touch(1, 450, 180));
    game.touchStart(touch(2, 550, 180));
    const balls = JSON.stringify(game.balls), direction = JSON.stringify(game.direction);
    const pose = JSON.stringify(game.cameraRig.freePose);
    game.touchMove({...touch(1, 470, 190), getAllTouches: () => [touch(1, 470, 190), touch(2, 570, 190)]});
    check('parallel movement selects orbit', game.observationIntent === 'orbit');
    check('orbit changes camera only', pose !== JSON.stringify(game.cameraRig.freePose) && balls === JSON.stringify(game.balls) && direction === JSON.stringify(game.direction));
    game.touchEnd(touch(2, 570, 190));
    game.touchMove(touch(1, 480, 200));
    check('remaining finger cannot edit aim', direction === JSON.stringify(game.direction) && game.observationBlocked);
    game.touchEnd(touch(1, 480, 200));
    game.touchStart(touch(3, 450, 180));
    game.touchStart(touch(4, 550, 180));
    game.touchMove({...touch(3, 430, 180), getAllTouches: () => [touch(3, 430, 180), touch(4, 570, 180)]});
    check('pinch selects zoom', game.observationIntent === 'zoom');
    game.touchEnd(touch(4, 570, 180));game.touchEnd(touch(3, 430, 180));
    const observedPose = JSON.stringify(game.cameraRig.freePose);
    game.referee.confirmPlacement(game.balls);
    await wait(50);
    check('placement confirmation keeps camera', observedPose === JSON.stringify(game.cameraRig.freePose));
    game.switchView();await wait(350);
    check('return moves camera without changing aim', observedPose !== JSON.stringify(game.cameraRig.freePose) && direction === JSON.stringify(game.direction));
    game.shoot();
    check('click leaves balls stationary before contact', game.balls.every(ball => ball.vx === 0 && ball.vz === 0));
    await wait(280);
    check('contact commits actual shot', game.shotSequence.committed);
    const movingPose = JSON.stringify(game.cameraRig.freePose);
    game.touchStart(touch(5,450,180));game.touchStart(touch(6,550,180));
    game.touchMove({...touch(5,470,190),getAllTouches:()=>[touch(5,470,190),touch(6,570,190)]});
    game.touchEnd(touch(6,570,190));game.touchEnd(touch(5,470,190));
    check('observation remains available during motion', movingPose !== JSON.stringify(game.cameraRig.freePose));
    game.pauseGame();
    check('pause clears gesture ownership', game.observationTouches.size === 0 && game.activeTouch === null);
    const previousSide=game.dockRight;game.modalAction('layout-side');
    check('layout setting changes dock side', game.dockRight!==previousSide);
    if(game.dockRight!==previousSide)game.modalAction('layout-side');
    window.freeCameraSmoke = {viewport: [innerWidth, innerHeight], checks, passed: checks.filter(c=>c.pass).length, total: checks.length};
    return window.freeCameraSmoke;
})
