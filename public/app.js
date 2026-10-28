"use strict";
const LEVELS = [
    { name: 'dog', word: 'dog', puzzle: 'd_g', vowel: 'o' },
    { name: 'cat', word: 'cat', puzzle: 'c_t', vowel: 'a' },
    { name: 'rabbit', word: 'rabbit', puzzle: 'r_bbit', vowel: 'a' },
    { name: 'deer', word: 'deer', puzzle: 'd_er', vowel: 'e' },
    { name: 'bird', word: 'bird', puzzle: 'b_rd', vowel: 'i' },
    { name: 'frog', word: 'frog', puzzle: 'fr_g', vowel: 'o' },
    { name: 'fox', word: 'fox', puzzle: 'f_x', vowel: 'o' },
    { name: 'squirrel', word: 'squirrel', puzzle: 'squ_rrel', vowel: 'i' },
    { name: 'hedgehog', word: 'hedgehog', puzzle: 'h_dgehog', vowel: 'e' },
    { name: 'owl', word: 'owl', puzzle: '_wl', vowel: 'o' }
];
const DEFAULT_SOUNDS = { music: true, effects: true, voice: true, musicVolume: 20, effectsVolume: 65 };
const root = document.getElementById('app');
const asset = (path) => `/assets/${path}`;
const store = (key, val) => { try {
    localStorage.setItem(key, JSON.stringify(val));
}
catch { } };
const retrieve = (key, fallback) => { try {
    const found = localStorage.getItem(key);
    return found ? JSON.parse(found) : fallback;
}
catch {
    return fallback;
} };
let progress = retrieve('forest-friends-scores', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
if (!Array.isArray(progress) || progress.length !== 10)
    progress = Array(10).fill(0);
let sounds = { ...DEFAULT_SOUNDS, ...retrieve('forest-friends-sound', DEFAULT_SOUNDS) };
let currentScreen = 'welcome', index = 0, attempts = 0, locked = false, completed = false, winStars = 0, hearts = 5, settingsOpen = false, infoOpen = false, completedTimer;
let ctx = null;
const bgMusic = new Audio(asset('music.mp3'));
bgMusic.loop = true;
bgMusic.preload = 'auto';
bgMusic.volume = sounds.music ? sounds.musicVolume / 100 : 0;
const voice = new Audio();
voice.preload = 'auto';
let startedAudio = false;
let voiceRequest = 0;
const audioContext = () => { if (!ctx) {
    ctx = new AudioContext();
} if (ctx.state === 'suspended')
    void ctx.resume(); return ctx; };
function unlockAudio() { if (!startedAudio) {
    startedAudio = true;
    if (sounds.music)
        void bgMusic.play().catch(() => { });
}
else if (sounds.music && bgMusic.paused)
    void bgMusic.play().catch(() => { }); }
function musicTarget(duck = false) { return sounds.music ? (sounds.musicVolume / 100) * (duck ? 0.24 : 1) : 0; }
function updateMusic(duck = false) { bgMusic.volume = musicTarget(duck); if (startedAudio && sounds.music && bgMusic.paused)
    void bgMusic.play().catch(() => { }); if (!sounds.music)
    bgMusic.pause(); }
function tone(freq, t, dur, type = 'sine', gain = .13) {
    if (!sounds.effects)
        return;
    try {
        const c = audioContext(), osc = c.createOscillator(), g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + t);
        g.gain.setValueAtTime(0.0001, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(Math.max(.001, gain * sounds.effectsVolume / 100), c.currentTime + t + .012);
        g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t + dur);
        osc.connect(g).connect(c.destination);
        osc.start(c.currentTime + t);
        osc.stop(c.currentTime + t + dur + .01);
    }
    catch { }
}
function sfx(kind) {
    if (kind === 'click') {
        tone(560, 0, .095, 'sine', .07);
        tone(860, .055, .10, 'triangle', .035);
    }
    if (kind === 'open') {
        tone(440, 0, .12, 'sine', .09);
        tone(660, .10, .12, 'sine', .08);
    }
    if (kind === 'wrong') {
        tone(320, 0, .16, 'sine', .065);
        tone(260, .17, .22, 'sine', .045);
    }
    if (kind === 'right') {
        tone(523, 0, .18, 'sine', .10);
        tone(659, .13, .21, 'sine', .1);
        tone(784, .26, .28, 'sine', .09);
    }
    if (kind === 'victory') {
        tone(523, 0, .22, 'sine', .1);
        tone(659, .20, .22, 'sine', .12);
        tone(988, .43, .42, 'sine', .13);
    }
}
function stopVoice() { voiceRequest++; voice.pause(); voice.removeAttribute('src'); voice.load(); updateMusic(); }
function sayAnimal(i = index) {
    if (!sounds.voice)
        return;
    const token = ++voiceRequest;
    voice.pause();
    voice.src = asset(`voices/${LEVELS[i].name}.mp3`);
    voice.currentTime = 0;
    updateMusic(true);
    voice.onended = () => { if (token === voiceRequest)
        updateMusic(false); };
    voice.onerror = () => { if (token === voiceRequest)
        updateMusic(false); };
    void voice.play().catch(() => { if (token === voiceRequest)
        updateMusic(false); });
}
const totalStars = () => progress.reduce((a, b) => a + (Number(b) || 0), 0);
const badgeCount = () => progress.filter(v => v > 0).length;
const format = (x) => x.toLocaleString('en-US');
function iconButton(id, label, style, icon) { return `<button type="button" class="icon-image ${id}" data-action="${id}" aria-label="${label}" style="${style}"><img src="${asset(icon)}" alt="" draggable="false"/></button>`; }
function hud(type) {
    const first = type === 'welcome' ? 'welcome' : 'gameplay';
    return `<div class="hud-heart" aria-label="Lives: ${hearts} out of five"><span>♥</span><b>${hearts}/5</b></div>
 <div class="hud-stars" aria-label="Stars earned: ${totalStars()}"><span>★</span><b>${format(totalStars())}</b></div>
 <button type="button" class="top-right-audio" aria-label="Sound settings" data-action="sound"><img src="${asset('sound_btn.webp')}" alt="" /></button>`;
}
function mobileHeader(label) { return `<div class="mobile-header"><button data-action="home" aria-label="Home">⌂</button><strong>${label}</strong><button data-action="sound" aria-label="Sound settings">♫</button></div>`; }
function welcome() {
    return `<section class="scene welcome-scene" aria-label="Welcome to My ABC Forest Friends">
 <div class="desktop-ui">${hud('welcome')}
 ${iconButton('menu-info', 'About this game', 'left:2.7%;top:13.0%;width:8.3%;height:10.6%', 'speech_btn.webp')}
 ${iconButton('menu-awards', 'Your achievements', 'left:2.7%;top:24.2%;width:8.3%;height:10.7%', 'crown_btn.webp')}
 ${iconButton('menu-settings', 'Game settings', 'left:2.7%;top:35.4%;width:8.3%;height:10.7%', 'settings_btn.webp')}
 <button class="sprite-button start-button" data-action="start" aria-label="Start game"><img src="${asset('start.webp')}" alt="Start"/></button>
 <button class="sprite-button level-button" data-action="levels" aria-label="Choose a level"><img src="${asset('levels_btn.webp')}" alt="Levels"/></button>
 <button class="sprite-button episode-button" data-action="episode" aria-label="Watch episode"><img src="${asset('episode_btn.webp')}" alt="Watch Episode"/></button>
 </div>
 <div class="mobile-ui mobile-welcome"><div class="mobile-brand"><span class="brand-small">My</span><div class="brand-abc"><span>A</span><span>B</span><span>C</span></div><strong>Forest Friends</strong><p>Explore the magical forest!</p></div><div class="mobile-buttons"><button class="wood-button green" data-action="start">START</button><button class="wood-button orange" data-action="levels">LEVELS</button><button class="wood-button blue" data-action="episode">▶ WATCH EPISODE</button><button class="mobile-sound" data-action="sound">♫ Sound Settings</button></div></div>
 </section>`;
}
function levels() {
    let cards = LEVELS.map((lvl, i) => `<button class="level-card" style="--i:${i};--x:${(16.55 + i % 5 * 13.42).toFixed(2)}%;--y:${i < 5 ? '27.8%' : '58.0%'}" data-level="${i}" aria-label="Level ${i + 1}: ${lvl.word}, best score ${progress[i]} stars">
 <img src="${asset('cards-' + lvl.name + '.webp')}" alt="Level ${i + 1}, ${lvl.word}" loading="${i > 4 ? 'lazy' : 'eager'}"/>
 <div class="score-stamps" aria-hidden="true">${[1, 2, 3].map(n => `<span class="${progress[i] >= n ? 'filled' : ''}">★</span>`).join('')}</div></button>`).join('');
    let mobileCards = LEVELS.map((lvl, i) => `<button class="mobile-level" data-level="${i}" aria-label="Level ${i + 1}: ${lvl.word}, ${progress[i]} stars"><img src="${asset('animals/' + lvl.name + '.webp')}" alt="${lvl.word}"/><b>Level ${i + 1}</b><span class="small-stars">${[1, 2, 3].map(n => `<span class="${progress[i] >= n ? 'filled' : ''}">★</span>`).join('')}</span></button>`).join('');
    return `<section class="scene levels-scene"><div class="desktop-ui">
 <button class="stage-home" data-action="home" aria-label="Return home">⌂</button><button class="stage-sound" data-action="sound" aria-label="Sound settings">♫</button>
 <div class="level-clickables">${cards}</div></div>
 <div class="mobile-ui">${mobileHeader('Choose an animal!')}<div class="mobile-wood-title"><h1>Levels</h1><p>Choose an animal to start!</p></div><div class="mobile-level-grid">${mobileCards}</div></div>
 </section>`;
}
function wordMarkup(puzzle, solved) { return solved ? LEVELS[index].word.split('').map(l => `<span>${l}</span>`).join('') : puzzle.split('').map(l => l === '_' ? '<span class="blank">_</span>' : `<span>${l}</span>`).join(''); }
function game() {
    const lvl = LEVELS[index];
    const choices = ['a', 'e', 'i', 'o', 'u'];
    const vowelButtons = choices.map(ch => `<button data-vowel="${ch}" class="vowel vowel-${ch}" ${locked ? 'disabled' : ''} aria-label="Choose the vowel ${ch}">${ch}</button>`).join('');
    return `<section class="scene game-scene"><div class="desktop-ui">
 <button class="home-hotspot" data-action="home" aria-label="Return home"><img src="${asset('home_game.webp')}" alt="" /></button><button class="game-sound-hotspot" data-action="sound" aria-label="Sound settings">♫</button>
 <div class="game-subtitle">(Animal Names)</div><div class="game-hud-hearts" aria-label="Lives ${hearts} of 5">${hearts}/5</div><div class="game-hud-stars" aria-label="Total stars ${totalStars()}">${format(totalStars())}</div>
 <span class="level-progress">${index + 1}/10</span>
 <div class="art-board"><button class="animal-art" data-action="pronounce" title="Listen to ${lvl.word}" aria-label="Hear the word ${lvl.word}"><img src="${asset('animals/' + lvl.name + '.webp')}" alt="A cute illustrated ${lvl.word}" /></button>
 <button class="replay-speaker" data-action="pronounce" aria-label="Replay ${lvl.word}">♫ <span>Listen</span></button>
 <div class="live-word ${completed ? 'word-completed' : ''}" aria-live="polite">${wordMarkup(lvl.puzzle, completed)}</div></div>
 <div class="choice-row" aria-label="Choose the missing vowel">${vowelButtons}</div>
 </div>
 <div class="mobile-ui mobile-game">${mobileHeader(`Level ${index + 1} / 10`)}<div class="mobile-wood-title game-wood-heading"><h1>Fill in the Missing Vowel</h1></div><div class="mobile-puzzle-panel"><button class="animal-mobile" data-action="pronounce" aria-label="Hear ${lvl.word}"><img src="${asset('animals/' + lvl.name + '.webp')}" alt="${lvl.word}"/></button><button class="listen-mobile" data-action="pronounce">♫ Tap to listen</button><div class="mobile-word ${completed ? 'word-completed' : ''}" aria-live="polite">${wordMarkup(lvl.puzzle, completed)}</div></div><div class="mobile-vowels">${vowelButtons}</div></div>
 </section>`;
}
function confetti() { return `<div class="sparkles" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i style="--j:${i};--delay:${(i % 7) * .13}s;--turn:${(i % 2) ? '-30' : '30'}deg"></i>`).join('')}</div>`; }
function win() {
    const stars = Array.from({ length: 3 }, (_, i) => `<span class="win-star ${i < winStars ? 'bright' : 'unearned'}" style="--n:${i}">★</span>`).join('');
    return `<section class="scene win-scene" style="background-image:url(${asset('achievement-' + winStars + '.jpg')})"><div class="desktop-ui">${confetti()}<div class="win-text">You got ${winStars} ${winStars === 1 ? 'star' : 'stars'}!</div><div class="win-stars" aria-label="${winStars} out of 3 stars"><span class="sr-only">${winStars} stars</span></div><button class="win-next" data-action="next" aria-label="Next level"><img src="${asset('next_btn.webp')}" alt="Next" /></button><button class="win-home" data-action="home" aria-label="Home">⌂</button></div>
 <div class="mobile-ui mobile-win">${mobileHeader('Well done!')}<div class="mobile-celebration"><h1>Nice!</h1><p>You got ${winStars} ${winStars === 1 ? 'star' : 'stars'}!</p><div class="mobile-win-stars">${stars}</div><button class="wood-button green" data-action="next">Next ❯</button></div>${confetti()}</div></section>`;
}
function final() {
    const finished = badgeCount() === 10;
    return `<section class="scene final-scene"><div class="desktop-ui"><div class="final-box parchment"><div class="final-ribbon">${finished ? 'Wonderful!' : 'What an adventure!'}</div><p>${finished ? 'You finished all 10 animal levels!' : `You explored ${badgeCount()} of 10 animal levels!`}</p><div class="final-animals">${LEVELS.map(l => `<img src="${asset('animals/' + l.name + '.webp')}" alt="${l.word}" />`).join('')}</div><div class="final-score">★ ${totalStars()} / 30 stars</div><div class="final-actions"><button class="wood-button green" data-action="play-again">Play Again</button><button class="wood-button orange" data-action="levels">Back to Levels</button></div></div></div><div class="mobile-ui">${mobileHeader('Forest Friends')}<div class="mobile-celebration final-mobile"><h1>${finished ? 'Wonderful!' : 'What an adventure!'}</h1><p>${finished ? 'You finished all 10 animal levels!' : `You explored ${badgeCount()} of 10 animal levels!`}</p><div class="mobile-animals">${LEVELS.map(l => `<img src="${asset('animals/' + l.name + '.webp')}" alt="${l.word}" />`).join('')}</div><div class="final-score">★ ${totalStars()} / 30 stars</div><button class="wood-button green" data-action="play-again">Play Again</button><button class="wood-button orange" data-action="levels">Back to Levels</button></div></div></section>`;
}
function episode() { return `<section class="scene episode-scene"><div class="desktop-ui"><div class="episode-panel parchment"><h1>Watch Episode</h1><div class="episode-media"><div class="episode-triangle">▶</div><p>Our forest adventures will be here soon!</p></div><p>New animal episodes are coming soon.</p><button class="wood-button green" data-action="home">Back Home</button></div></div><div class="mobile-ui">${mobileHeader('Watch Episode')}<div class="mobile-celebration"><h1>Watch Episode</h1><div class="episode-triangle">▶</div><p>Animal episodes are coming soon!</p><button class="wood-button green" data-action="home">Back Home</button></div></div></section>`; }
function overlays() {
    let content = '';
    if (settingsOpen) {
        content += `<div class="modal-backdrop" data-action="dismiss"><div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-ignore-dismiss><button class="modal-close" data-action="dismiss" aria-label="Close">×</button><h2 id="settings-title">♫ Sound Settings</h2><div class="setting-row"><label for="music-toggle">Background music</label><input id="music-toggle" type="checkbox" data-setting="music" ${sounds.music ? 'checked' : ''}/></div><div class="setting-row"><label for="music-volume">Music volume</label><input id="music-volume" type="range" min="0" max="100" value="${sounds.musicVolume}" data-setting="musicVolume" /></div><div class="setting-row"><label for="effects-toggle">Sound effects</label><input id="effects-toggle" type="checkbox" data-setting="effects" ${sounds.effects ? 'checked' : ''}/></div><div class="setting-row"><label for="effects-volume">Effects volume</label><input id="effects-volume" type="range" min="0" max="100" value="${sounds.effectsVolume}" data-setting="effectsVolume" /></div><div class="setting-row"><label for="voice-toggle">Animal voice</label><input id="voice-toggle" type="checkbox" data-setting="voice" ${sounds.voice ? 'checked' : ''}/></div><button class="wood-button green done-button" data-action="dismiss">Done</button></div></div>`;
    }
    if (infoOpen) {
        content += `<div class="modal-backdrop" data-action="dismiss"><div class="modal-panel" role="dialog" aria-modal="true" data-ignore-dismiss><button class="modal-close" data-action="dismiss">×</button><h2>My ABC Forest Friends</h2><p>Learn ten animal names by choosing the missing vowel! Tap an animal to hear its name.</p><p>First try = 3 stars, second try = 2 stars, and every later try = 1 star.</p><p><strong>Your progress:</strong> ${badgeCount()} of 10 levels, ${totalStars()} out of 30 stars.</p><button class="wood-button green done-button" data-action="dismiss">Got it!</button></div></div>`;
    }
    return content;
}
function render() {
    root.innerHTML = `<main class="game-shell"><div class="stage" data-currentScreen="${currentScreen}">${currentScreen === 'welcome' ? welcome() : currentScreen === 'levels' ? levels() : currentScreen === 'game' ? game() : currentScreen === 'win' ? win() : currentScreen === 'final' ? final() : episode()}${overlays()}</div></main>`;
}
function go(next) {
    if (completedTimer)
        clearTimeout(completedTimer);
    completedTimer = undefined;
    stopVoice();
    settingsOpen = false;
    infoOpen = false;
    currentScreen = next;
    render();
}
function enterLevel(i) {
    if (i < 0 || i >= LEVELS.length)
        return;
    stopVoice();
    index = i;
    attempts = 0;
    locked = false;
    completed = false;
    hearts = Math.max(hearts, 3);
    currentScreen = 'game';
    render();
    // Voice playback is enabled by the child's click on a level or Start.
    sayAnimal(index);
}
function chooseVowel(v, button) {
    if (currentScreen !== 'game' || locked || !['a', 'e', 'i', 'o', 'u'].includes(v))
        return;
    attempts++;
    if (LEVELS[index].vowel !== v) {
        hearts = Math.max(0, hearts - 1);
        sfx('wrong');
        button.classList.add('wrong-answer');
        window.setTimeout(() => button.classList.remove('wrong-answer'), 450);
        root.querySelectorAll('.game-hud-hearts').forEach(el => el.textContent = `${hearts}/5`);
        return;
    }
    locked = true;
    completed = true;
    winStars = Math.max(1, 4 - attempts);
    sfx('right');
    sayAnimal(index);
    progress[index] = Math.max(progress[index] || 0, winStars);
    store('forest-friends-scores', progress);
    root.querySelectorAll(`[data-vowel="${v}"]`).forEach(el => el.classList.add('right-answer'));
    root.querySelectorAll('.live-word,.mobile-word').forEach(el => { el.textContent = LEVELS[index].word; el.classList.add('word-completed'); });
    root.querySelectorAll('[data-vowel]').forEach(el => el.disabled = true);
    completedTimer = window.setTimeout(() => { stopVoice(); currentScreen = 'win'; render(); sfx('victory'); }, 1700);
}
function onAction(action) {
    unlockAudio();
    if (action === 'start') {
        sfx('open');
        enterLevel(progress.findIndex(v => v === 0) < 0 ? 0 : progress.findIndex(v => v === 0));
        return;
    }
    if (action === 'levels') {
        sfx('open');
        go('levels');
        return;
    }
    if (action === 'home') {
        sfx('click');
        go('welcome');
        return;
    }
    if (action === 'sound' || action === 'menu-settings') {
        sfx('click');
        settingsOpen = true;
        infoOpen = false;
        render();
        return;
    }
    if (action === 'menu-info' || action === 'menu-awards') {
        sfx('open');
        infoOpen = true;
        settingsOpen = false;
        render();
        return;
    }
    if (action === 'dismiss') {
        sfx('click');
        infoOpen = false;
        settingsOpen = false;
        render();
        return;
    }
    if (action === 'episode') {
        sfx('open');
        go('episode');
        return;
    }
    if (action === 'pronounce') {
        sfx('click');
        sayAnimal();
        return;
    }
    if (action === 'next') {
        sfx('open');
        if (index < LEVELS.length - 1) {
            enterLevel(index + 1);
        }
        else {
            go('final');
            sfx('victory');
        }
        return;
    }
    if (action === 'play-again') {
        sfx('open');
        enterLevel(0);
        return;
    }
}
root.addEventListener('click', (ev) => {
    const target = ev.target;
    if (target.closest('[data-ignore-dismiss]') && !target.closest('button'))
        return;
    const tile = target.closest('[data-level]');
    if (tile) {
        unlockAudio();
        sfx('open');
        enterLevel(Number(tile.dataset.level));
        return;
    }
    const choice = target.closest('[data-vowel]');
    if (choice) {
        unlockAudio();
        chooseVowel(choice.dataset.vowel || '', choice);
        return;
    }
    const action = target.closest('[data-action]');
    if (action) {
        if (action.dataset.action === 'dismiss' && target.closest('[data-ignore-dismiss]') && action === target.closest('.modal-backdrop'))
            return;
        onAction(action.dataset.action || '');
    }
});
root.addEventListener('input', (ev) => {
    const input = ev.target;
    const key = input.dataset.setting;
    if (!key)
        return;
    if (key === 'music' || key === 'effects' || key === 'voice')
        sounds[key] = input.checked;
    else if (key === 'musicVolume' || key === 'effectsVolume')
        sounds[key] = Number(input.value);
    store('forest-friends-sound', sounds);
    if (key === 'voice' && !sounds.voice)
        stopVoice();
    updateMusic(!voice.paused);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (settingsOpen || infoOpen)) {
        onAction('dismiss');
        return;
    }
    if (currentScreen === 'game' && !settingsOpen && !infoOpen && /^[aeiou]$/i.test(e.key)) {
        const button = root.querySelector(`.desktop-ui [data-vowel="${e.key.toLowerCase()}"]`);
        if (button) {
            unlockAudio();
            chooseVowel(e.key.toLowerCase(), button);
        }
    }
});
render();
