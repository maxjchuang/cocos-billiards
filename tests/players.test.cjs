const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalPlayers, playerName, playerMessage, fitNickname } = require(process.env.BILLIARDS_PLAYERS_MODULE);

test('local profile instances are independent; empty nicknames use seat-specific names', () => {
    const a = createLocalPlayers(), b = createLocalPlayers();
    a[0].nickname = '  ';
    assert.equal(playerName(a[0], 0), '玩家一');
    assert.equal(b[0].nickname, '玩家一');
    assert.equal(playerName({ ...a[1], nickname: '' }, 1), '玩家二');
    assert.notEqual(a[0].id, a[1].id);
});
test('referee presentation resolves both seats without rewriting similarly prefixed identifiers', () => {
    const players = createLocalPlayers();
    players[0].nickname = '林间听风'; players[1].nickname = 'BlueFox';
    assert.equal(playerMessage('P1 白球落袋 · P2 获得自由球', players), '林间听风 白球落袋 · BlueFox 获得自由球');
    assert.equal(playerMessage('P10 / P20', players), 'P10 / P20');
});
test('long nicknames truncate with ellipsis without splitting supplementary Unicode characters', () => {
    assert.equal(fitNickname('BlueFox', 8), 'BlueFox');
    assert.equal(fitNickname('凌晨三点还在练球', 6), '凌晨三点还…');
    assert.equal(fitNickname('🎱🎱🎱🎱', 3), '🎱🎱…');
});

test('nickname ellipsis never splits family emoji, skin tones, flags or combining accents',()=>{
 for(const symbol of ['👨‍👩‍👦','👍🏽','🇨🇳','e\u0301'])assert.equal(fitNickname(symbol.repeat(3),2),symbol+'…');
 const original=Intl.Segmenter;try{Intl.Segmenter=undefined;for(const symbol of ['👨‍👩‍👦','👍🏽','🇨🇳','e\u0301'])assert.equal(fitNickname(symbol.repeat(3),2),symbol+'…');}finally{Intl.Segmenter=original;}
});
