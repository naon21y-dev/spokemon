export const characters = [
 {id:'piplup',name:'팽도리',type:'물',description:'작지만 씩씩한 바다 친구',color:'#cfe7ed',image:'/images/characters/piplup.png'},
 {id:'squirtle',name:'꼬부기',type:'물',description:'함께라면 언제나 든든해',color:'#d6ebdd',image:'/images/characters/squirtle.png'},
 {id:'gengar',name:'팬텀',type:'고스트 · 독',description:'장난기 가득한 밤의 친구',color:'#e5dcf1',image:'/images/characters/gengar.png'},
 {id:'bulbasaur',name:'이상해씨',type:'풀 · 독',description:'매일 조금씩 함께 자라요',color:'#e2ecc9',image:'/images/characters/bulbasaur.png'},
 {id:'magikarp',name:'잉어킹',type:'물',description:'Lv.20에서 만나는 도약의 친구',minLevel:20,color:'#f6d7bd',image:'/images/characters/magikarp.png'},
 {id:'dratini',name:'미뇽',type:'드래곤',description:'Lv.20에서 만나는 신비로운 친구',minLevel:20,color:'#dce1fa',image:'/images/characters/dratini.png'},
 {id:'froakie',name:'개구마르',type:'물',description:'Lv.20에서 만나는 날렵한 친구',minLevel:20,color:'#cfeefa',image:'/images/characters/froakie.png'},
 {id:'pichu',name:'피츄',type:'전기',description:'Lv.20에서 만나는 반짝이는 친구',minLevel:20,color:'#fff1b9',image:'/images/characters/pichu.png'},
 {"id": "chimchar", "introducedAt": "2026-11-02", "name": "불꽃숭이", "type": "불꽃", "minLevel": 25, "description": "Lv.25에서 만나는 새로운 친구", "color": "#ffe1bf", "image": "/images/characters/chimchar.png"},
 {"id": "slowpoke", "introducedAt": "2026-11-02", "name": "야돈", "type": "물 · 에스퍼", "minLevel": 25, "description": "Lv.25에서 만나는 새로운 친구", "color": "#f6d4e3", "image": "/images/characters/slowpoke.png"},
 {"id": "chikorita", "introducedAt": "2026-11-02", "name": "치코리타", "type": "풀", "minLevel": 25, "description": "Lv.25에서 만나는 새로운 친구", "color": "#dff1bb", "image": "/images/characters/chikorita.png"},
 {"id": "riolu", "introducedAt": "2026-11-02", "name": "리오르", "type": "격투", "minLevel": 25, "description": "Lv.25에서 만나는 새로운 친구", "color": "#cce7fb", "image": "/images/characters/riolu.png"},
 {id:'mew',name:'뮤',type:'에스퍼',description:'Lv.30에서 만나는 환상의 친구',minLevel:30,color:'#f6d6e9',image:'/images/characters/mew.png'},
]
export const diglett={id:'diglett',name:'디그다',type:'땅',description:'강화 실패로 잠시 변한 모습',color:'#ead5c2',image:'/images/characters/diglett.png'}
export const findCharacter = id => id==='diglett'?diglett:characters.find(c=>c.id===id)||characters[0]

// NEW follows the latest release batch, independently of unlock level.
export const latestCharacterRelease=characters.map(c=>c.introducedAt).filter(Boolean).sort().at(-1);
export const isNewCharacter=c=>!!c.introducedAt&&c.introducedAt===latestCharacterRelease;
