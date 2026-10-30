export const characters = [
 {id:'piplup',name:'팽도리',type:'물',description:'작지만 씩씩한 바다 친구',color:'#cfe7ed',image:'/images/characters/piplup.png'},
 {id:'squirtle',name:'꼬부기',type:'물',description:'함께라면 언제나 든든해',color:'#d6ebdd',image:'/images/characters/squirtle.png'},
 {id:'gengar',name:'팬텀',type:'고스트 · 독',description:'장난기 가득한 밤의 친구',color:'#e5dcf1',image:'/images/characters/gengar.png'},
 {id:'bulbasaur',name:'이상해씨',type:'풀 · 독',description:'매일 조금씩 함께 자라요',color:'#e2ecc9',image:'/images/characters/bulbasaur.png'},
 {id:'magikarp',name:'잉어킹',type:'물',description:'Lv.20에서 만나는 도약의 친구',minLevel:20,color:'#f6d7bd',image:'/images/characters/magikarp.png'},
 {id:'dratini',name:'미뇽',type:'드래곤',description:'Lv.20에서 만나는 신비로운 친구',minLevel:20,color:'#dce1fa',image:'/images/characters/dratini.png'},
 {id:'froakie',name:'개구마르',type:'물',description:'Lv.20에서 만나는 날렵한 친구',minLevel:20,color:'#cfeefa',image:'/images/characters/froakie.png'},
 {id:'pichu',name:'피츄',type:'전기',description:'Lv.20에서 만나는 반짝이는 친구',minLevel:20,color:'#fff1b9',image:'/images/characters/pichu.png'},
 {id:'mew',name:'뮤',type:'에스퍼',description:'Lv.30에서 만나는 환상의 친구',minLevel:30,color:'#f6d6e9',image:'/images/characters/mew.png'},
]
export const diglett={id:'diglett',name:'디그다',type:'땅',description:'강화 실패로 잠시 변한 모습',color:'#ead5c2',image:'/images/characters/diglett.png'}
export const findCharacter = id => id==='diglett'?diglett:characters.find(c=>c.id===id)||characters[0]
