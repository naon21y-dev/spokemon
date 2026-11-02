export const ticketKinds=[
 {id:'partner-change',name:'포켓몬 변경 1회권',icon:'🎟️',description:'5,000포인트 대신 사용해 다른 파트너로 변경해요. 레벨 제한은 그대로 적용됩니다.'},
 {id:'diglett-escape',name:'디그다 탈출권',icon:'🪪',description:'500포인트 대신 사용해 디그다에서 원래 포켓몬의 1단계로 돌아가요.'}
];
export const ticketKindMap=Object.fromEntries(ticketKinds.map(t=>[t.id,t]));
