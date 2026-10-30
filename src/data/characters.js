export const characters = [
 {id:'piplup',name:'팽도리',type:'물',description:'작지만 씩씩한 바다 친구',color:'#cfe7ed',image:'/images/characters/piplup.png'},
 {id:'squirtle',name:'꼬부기',type:'물',description:'함께라면 언제나 든든해',color:'#d6ebdd',image:'/images/characters/squirtle.png'},
 {id:'gengar',name:'팬텀',type:'고스트 · 독',description:'장난기 가득한 밤의 친구',color:'#e5dcf1',image:'/images/characters/gengar.png'},
 {id:'bulbasaur',name:'이상해씨',type:'풀 · 독',description:'매일 조금씩 함께 자라요',color:'#e2ecc9',image:'/images/characters/bulbasaur.png'},
 {id:'mew',name:'뮤',type:'에스퍼',description:'Lv.30에서 만나는 환상의 친구',minLevel:30,color:'#f6d6e9',image:'/images/characters/mew.png'},
]
export const findCharacter = id => characters.find(c=>c.id===id)||characters[0]
