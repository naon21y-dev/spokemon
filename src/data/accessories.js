// Normalized attachment anchors measured against each transparent character image.
const anchors = {
  mew:{ratio:1,head:[46,15],eyes:[46,34],ear:[60,24],chest:[54,53],aura:[85,65]},
  mewtwo:{ratio:1,head:[60,5],eyes:[61,19],ear:[69,13],chest:[59,40],aura:[87,65]},
  prinplup:{ratio:1,head:[43,9],eyes:[44,28],ear:[56,22],chest:[48,58],aura:[86,65]},
  empoleon:{ratio:1,head:[56,8],eyes:[56,26],ear:[69,22],chest:[52,51],aura:[87,67]},
  wartortle:{ratio:1,head:[37,18],eyes:[37,41],ear:[54,26],chest:[50,66],aura:[86,65]},
  blastoise:{ratio:1,head:[65,.5],eyes:[63,10],ear:[79,13],chest:[69,47],aura:[86,65]},
  'gengar-mega':{ratio:1,head:[37,30],eyes:[38,47],ear:[70,33],chest:[50,65],aura:[87,67]},
  'gengar-gmax':{ratio:1,head:[50,17],eyes:[54,35],ear:[72,29],chest:[47,62],aura:[87,67]},
  ivysaur:{ratio:1,head:[78,33],eyes:[80,45],ear:[86,32],chest:[70,65],aura:[88,69]},
  venusaur:{ratio:1,head:[50,44],eyes:[50,61],ear:[72,48],chest:[50,76],aura:[86,67]},
  piplup: {
    ratio: 272 / 290,
    head: [53, 8],
    eyes: [54, 35],
    ear: [77, 21],
    chest: [51, 65],
    aura: [88, 66]
  },
  squirtle: {
    ratio: 292 / 339,
    head: [46, 6],
    eyes: [44, 22],
    ear: [69, 18],
    chest: [46, 61],
    aura: [84, 64]
  },
  gengar: {
    ratio: 278 / 312,
    head: [52, 21],
    eyes: [51, 44],
    ear: [76, 31],
    chest: [49, 69],
    aura: [87, 66]
  },
  bulbasaur: {
    ratio: 286 / 247,
    head: [35, 11],
    eyes: [25, 29],
    ear: [17, 24],
    chest: [36, 70],
    aura: [86, 69]
  }
};
const headItems = {
    '👑': 34,
    '🎩': 43,
    '🧢': 44,
    '👒': 50,
    '🎓': 48
  },
  eyeItems = {
    '🕶️': 46,
    '🥽': 45,
    '🎭': 41
  };
export function accessoryPlacement(character, item) {
  const a = anchors[character] ?? anchors.piplup;
  let point = a.ear,
    size = 22,
    kind = 'ornament',
    offset = '-50%';
  if (headItems[item]) {
    point = a.head;
    size = headItems[item];
    kind = 'head';
    offset = '-88%';
  } else if (eyeItems[item]) {
    point = a.eyes;
    size = eyeItems[item];
    kind = 'eyes';
  } else if (item === '🎧') {
    point = [a.head[0], (a.eyes[1] + a.head[1]) / 2 + 4];
    size = 66;
    kind = 'headphones';
  } else if (item === '💎') {
    point = a.chest;
    size = 19;
    kind = 'brooch';
  } else if (item === '🔥' || item === '❄️') {
    point = a.aura;
    size = 24;
    kind = 'aura';
  }
  return {
    kind,
    rotation: kind === 'eyes' ? {
      piplup: -10,
      gengar: -15,
      bulbasaur: -3
    }[character] ?? 0 : 0,
    ratio: a.ratio,
    x: point[0],
    y: point[1],
    size,
    offset
  };
}
