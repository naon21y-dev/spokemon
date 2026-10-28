export const skins = [
  {
    "id": "gengar-01",
    "character": "gengar",
    "name": "장난꾸러기",
    "price": 500,
    "image": "/images/skins/gengar-01.png"
  },
  {
    "id": "gengar-02",
    "character": "gengar",
    "name": "꿈꾸는 팬텀",
    "price": 500,
    "image": "/images/skins/gengar-02.png"
  },
  {
    "id": "gengar-03",
    "character": "gengar",
    "name": "신나는 팬텀",
    "price": 500,
    "image": "/images/skins/gengar-03.png"
  },
  {
    "id": "gengar-04",
    "character": "gengar",
    "name": "메롱 팬텀",
    "price": 500,
    "image": "/images/skins/gengar-04.png"
  },
  {
    "id": "gengar-05",
    "character": "gengar",
    "name": "숲속 팬텀",
    "price": 500,
    "image": "/images/skins/gengar-05.png"
  },
  {
    "id": "squirtle-01",
    "character": "squirtle",
    "name": "꽃을 든 꼬부기",
    "price": 500,
    "image": "/images/skins/squirtle-01.png"
  },
  {
    "id": "squirtle-02",
    "character": "squirtle",
    "name": "출동 꼬부기",
    "price": 500,
    "image": "/images/skins/squirtle-02.png"
  },
  {
    "id": "squirtle-03",
    "character": "squirtle",
    "name": "만세 꼬부기",
    "price": 500,
    "image": "/images/skins/squirtle-03.png"
  },
  {
    "id": "squirtle-04",
    "character": "squirtle",
    "name": "선글라스 꼬부기",
    "price": 500,
    "image": "/images/skins/squirtle-04.png"
  },
  {
    "id": "squirtle-05",
    "character": "squirtle",
    "name": "피규어 꼬부기",
    "price": 500,
    "image": "/images/skins/squirtle-05.png"
  },
  {
    "id": "piplup-01",
    "character": "piplup",
    "name": "방긋 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-01.png"
  },
  {
    "id": "piplup-02",
    "character": "piplup",
    "name": "새침 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-02.png"
  },
  {
    "id": "piplup-03",
    "character": "piplup",
    "name": "옆모습 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-03.png"
  },
  {
    "id": "piplup-04",
    "character": "piplup",
    "name": "물방울 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-04.png"
  },
  {
    "id": "piplup-05",
    "character": "piplup",
    "name": "빙글빙글 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-05.png"
  },
  {
    "id": "piplup-06",
    "character": "piplup",
    "name": "반짝눈 팽도리",
    "price": 500,
    "image": "/images/skins/piplup-06.png"
  },
  {
    "id": "bulbasaur-01",
    "character": "bulbasaur",
    "name": "숲속 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-01.png"
  },
  {
    "id": "bulbasaur-02",
    "character": "bulbasaur",
    "name": "피규어 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-02.png"
  },
  {
    "id": "bulbasaur-03",
    "character": "bulbasaur",
    "name": "모험 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-03.png"
  },
  {
    "id": "bulbasaur-04",
    "character": "bulbasaur",
    "name": "일러스트 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-04.png"
  },
  {
    "id": "bulbasaur-05",
    "character": "bulbasaur",
    "name": "든든한 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-05.png"
  },
  {
    "id": "bulbasaur-06",
    "character": "bulbasaur",
    "name": "신나는 이상해씨",
    "price": 500,
    "image": "/images/skins/bulbasaur-06.png"
  }
];
export const skinMap = Object.fromEntries(skins.map(s => [s.id, s]));
export function activeSkin(pet) { const s = skinMap[pet?.skinByCharacter?.[pet?.character]]; return s?.character === pet?.character && pet?.ownedSkins?.includes(s.id) ? s : null; }
