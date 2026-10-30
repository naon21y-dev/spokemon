export const roomItems = [
  {
    "id": "sofa",
    "emoji": "🛋️",
    "name": "폭신 소파",
    "price": 180
  },
  {
    "id": "bed",
    "emoji": "🛏️",
    "name": "포근한 침대",
    "price": 200
  },
  {
    "id": "chair",
    "emoji": "🪑",
    "name": "나무 의자",
    "price": 60
  },
  {
    "id": "lamp",
    "emoji": "💡",
    "name": "반짝 조명",
    "price": 70
  },
  {
    "id": "plant",
    "emoji": "🪴",
    "name": "작은 화분",
    "price": 50
  },
  {
    "id": "tree",
    "emoji": "🌳",
    "name": "초록 나무",
    "price": 90
  },
  {
    "id": "flower",
    "emoji": "🌷",
    "name": "튤립 화병",
    "price": 40
  },
  {
    "id": "sunflower",
    "emoji": "🌻",
    "name": "해바라기",
    "price": 45
  },
  {
    "id": "books",
    "emoji": "📚",
    "name": "공부 책더미",
    "price": 65
  },
  {
    "id": "game",
    "emoji": "🎮",
    "name": "게임기",
    "price": 130
  },
  {
    "id": "teddy",
    "emoji": "🧸",
    "name": "곰 인형",
    "price": 100
  },
  {
    "id": "clock",
    "emoji": "🕰️",
    "name": "앤티크 시계",
    "price": 120
  },
  {
    "id": "mirror",
    "emoji": "🪞",
    "name": "전신 거울",
    "price": 100
  },
  {
    "id": "picture",
    "emoji": "🖼️",
    "name": "그림 액자",
    "price": 90
  },
  {
    "id": "balloon",
    "emoji": "🎈",
    "name": "파티 풍선",
    "price": 30
  },
  {
    "id": "star",
    "emoji": "🌟",
    "name": "빛나는 별",
    "price": 70
  },
  {
    "id": "moon",
    "emoji": "🌙",
    "name": "달 조명",
    "price": 90
  },
  {
    "id": "rainbow",
    "emoji": "🌈",
    "name": "무지개 장식",
    "price": 110
  },
  {
    "id": "fountain",
    "emoji": "⛲",
    "name": "작은 분수",
    "price": 250
  },
  {
    "id": "castle",
    "emoji": "🏰",
    "name": "미니 성",
    "price": 300
  },
  {
    "id": "cherry",
    "emoji": "🌸",
    "name": "벚꽃 장식",
    "price": 50
  },
  {
    "id": "basket",
    "emoji": "🧺",
    "name": "정리 바구니",
    "price": 70
  },
  {
    "id": "candle",
    "emoji": "🕯️",
    "name": "촛불",
    "price": 35
  },
  {
    "id": "crystal",
    "emoji": "🔮",
    "name": "신비한 수정구",
    "price": 150
  }
];
export const roomItemMap=Object.fromEntries(roomItems.map(i=>[i.id,i]));
export const defaultRoom=()=>({wall:"#ffffff",floor:"#ffffff",grid:true,placements:[]});
