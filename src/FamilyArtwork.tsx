import React from 'react';
type Props={family:string;primary:string;H:number;wide:boolean;id:string};
/** Large compositional shapes; content and photographs remain editable layers. */
export default function FamilyArtwork({family,primary,H,wide,id}:Props){
 const u=(n:string)=>`url(#${n}${id})`;
 return <g className="poster-atmosphere" aria-hidden="true" pointerEvents="none">
 <defs>
  <radialGradient id={'artHalo'+id} cx="75%" cy="28%" r="85%"><stop stopColor={primary}/><stop offset=".45" stopColor="#162b40"/><stop offset="1" stopColor="#050b13"/></radialGradient>
  <linearGradient id={'signalFold'+id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={primary}/><stop offset="1" stopColor="#08172c"/></linearGradient>
  <radialGradient id={'silver'+id} cx="68%" cy="40%" r="65%"><stop stopColor="#a5a8ad" stopOpacity=".45"/><stop offset=".3" stopColor="#343a43" stopOpacity=".35"/><stop offset="1" stopColor="#070b10" stopOpacity="0"/></radialGradient>
  <linearGradient id={'warmPaper'+id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fcf6e5"/><stop offset="1" stopColor="#d9c6a1"/></linearGradient>
  <pattern id={'gritDot'+id} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2.2" fill="#fff" fillOpacity=".12"/></pattern>
 </defs>
 <rect width="1000" height={H} fill={family==='Clean'?'#f5f5f0':family==='Editorial'?'#f3eee4':family==='Heritage'?u('warmPaper'):family==='Community'?'#f2e7d3':family==='Signal'||family==='Energy'?primary:family==='Premium'?'#080b11':'#08121c'}/>
 {family==='Broadcast'&&<><rect width="1000" height={H} fill={u('artHalo')}/><path d={`M-100 ${H*.06}L740 ${H}h125L30 0Z`} fill="#fff" opacity=".04"/><path d={`M940 0L260 ${H}h140L1120 0Z`} fill={primary} opacity=".34"/><rect x="0" y={H*.94} width="1000" height={H*.06} fill="#02080e"/></>}
 {family==='Clean'&&<><rect x={wide?535:555} width="445" height={H} fill={primary}/><path d={`M0 ${H*.82}H1000V${H}H0Z`} fill="#e8eae5"/><rect x="65" y={H*.075} width="22" height="22" fill={primary}/></>}
 {family==='Grit'&&<><path d={`M-40 ${H*.08}L1040 ${H*.22}L1030 ${H*.79}L-20 ${H*.66}Z`} fill={primary}/><path d={`M-30 ${H*.18}L1015 ${H*.29}L1000 ${H*.77}L-25 ${H*.66}Z`} fill={wide?'#10212a':'#e8e6dc'}/><path d={`M0 ${H*.7}l1000 -${H*.1}v${H*.4}H0Z`} fill="#080d10"/><rect x="700" y={H*.65} width="300" height={H*.35} fill={u('gritDot')}/><image href="/assets/texture-grit.webp" width="1000" height={H} preserveAspectRatio="xMidYMid slice" opacity=".13"/></>}
 {family==='Spotlight'&&<><rect width="1000" height={H} fill={u('artHalo')}/><ellipse cx={wide?740:510} cy={H*.47} rx={wide?390:440} ry={H*.32} fill="none" stroke={primary} strokeWidth="32" opacity=".42"/><ellipse cx={wide?740:510} cy={H*.47} rx={wide?415:465} ry={H*.35} fill="none" stroke="#d1e7ff" strokeWidth="1.5" opacity=".35"/><path d={`M0 ${H*.88}H1000V${H}H0Z`} fill="#050c14" opacity=".65"/></>}
 {family==='Editorial'&&<><path d={`M65 ${H*.155}H935M65 ${H*.925}H935`} stroke="#172c36" strokeWidth="3"/><path d={`M65 ${H*.162}H935`} stroke="#172c36" strokeWidth=".8"/><image href="/assets/texture-editorial.webp" width="1000" height={H} opacity=".045" preserveAspectRatio="xMidYMid slice"/></>}
 {family==='Signal'&&<><path d={wide?`M535 0H1000V${H}H680L440 ${H*.53}Z`:`M615 0H1000V${H}H0V${H*.77}L615 ${H*.36}Z`} fill={u('signalFold')}/><path d={wide?`M535 0L440 ${H*.53}L680 ${H}`:`M615 0V${H*.36}L0 ${H*.77}`} fill="none" stroke="#fff" strokeWidth="2" opacity=".28"/><circle cx={wide?820:760} cy={H*.35} r={wide?265:340} fill="#061627" opacity=".35"/></>}
 {family==='Heritage'&&<><path d={`M40 40H960V${H-40}H40ZM53 53H947V${H-53}H53Z`} fill="none" stroke="#8e7448" strokeWidth="1.5"/>{Array.from({length:28},(_,i)=><ellipse key={i} cx={wide?150:500} cy={H*(wide?.32:.105)} rx="95" ry="33" fill="none" stroke="#aa8b55" strokeWidth=".7" opacity=".35" transform={`rotate(${i*180/28} ${wide?150:500} ${H*(wide?.32:.105)})`}/>)}<image href="/assets/texture-heritage.webp" width="1000" height={H} preserveAspectRatio="xMidYMid slice" opacity=".07"/></>}
 {family==='Energy'&&<><path d={`M-90 ${H*.67}L1090 ${H*.35}V${H}H-90Z`} fill="#06172a"/><path d={`M-80 ${H*.64}L1070 ${H*.31}`} fill="none" stroke="#fff" strokeWidth="13"/><path d={`M-80 ${H*.61}L1070 ${H*.28}`} fill="none" stroke="#fff" strokeWidth="2" opacity=".5"/><circle cx="870" cy={H*.12} r="240" fill="none" stroke="#fff" strokeWidth="1" opacity=".13"/></>}
 {family==='Premium'&&<><rect width="1000" height={H} fill={u('silver')}/><ellipse cx="570" cy={H*.43} rx="430" ry={H*.29} fill="none" stroke="#c5b899" strokeWidth="1.2" opacity=".42"/><ellipse cx="570" cy={H*.43} rx="449" ry={H*.30} fill="none" stroke="#fff" strokeWidth=".6" opacity=".16"/><path d={`M70 ${H*.92}H930`} stroke="#c5b899" strokeWidth="1" opacity=".5"/></>}
 {family==='Community'&&<><path d={`M-40 ${H*.6}Q410 ${H*.48} 1040 ${H*.69}V${H}H-40Z`} fill="#fff9e9"/><path d={`M-10 ${H*.62}Q410 ${H*.5} 1030 ${H*.71}`} fill="none" stroke={primary} strokeWidth="12" opacity=".3"/><image href="/assets/texture-community.webp" width="1000" height={H} preserveAspectRatio="xMidYMid slice" opacity=".035"/></>}
 </g>;
}
