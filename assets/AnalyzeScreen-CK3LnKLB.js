import{r as p,R as e}from"./index-Bc2G9s8g.js";import{P as u,W as E,b as d}from"./chrome-vpd_24Xf.js";import{M as v}from"./game-DgoR4cCJ.js";const g={tavern:{name:"Tavern",bgImage:"/chewy/assets/gen/packC/bg_tavern.jpg",frameImage:"/chewy/assets/gen/packC/frame_tavern.png",banner:"SCAN PROVISION",bannerBg:"linear-gradient(180deg, #8a5a30, #6b4226)",bannerColor:"#ffe9c9",bg:"linear-gradient(180deg, #7a4a2b 0%, #5a3620 60%, #462917 100%)",panelBg:"linear-gradient(180deg, #4a2f1c, #3a2414)",accent:"#ff8a3d",accentDark:"#e5722a",stops:["Bite","Half","Feast"],stopIcon:"🍗",cta:"FEED!",retake:"↻",prop:"🍽️",reticle:!0},lab:{name:"Laboratory",bgImage:"/chewy/assets/gen/packC/bg_lab.jpg",frameImage:"/chewy/assets/gen/packC/frame_lab.png",banner:"ANALYZING SPECIMEN",bannerBg:"linear-gradient(180deg, #9aa7b1, #6e7b86)",bannerColor:"#1c2733",bg:"linear-gradient(180deg, #55606b 0%, #414a54 60%, #333a42 100%)",panelBg:"linear-gradient(180deg, #4c545d, #3b424a)",accent:"#ff5533",accentDark:"#d63e20",stops:["Sample","Mass","Capacity"],stopIcon:"⚙️",cta:"FEED!",retake:"⚙",prop:"🔬",reticle:!1},magic:{name:"Magic",bgImage:"/chewy/assets/gen/packC/bg_magic.jpg",frameImage:"/chewy/assets/gen/packC/frame_magic.png",banner:"ANALYZE ESSENCE",bannerBg:"linear-gradient(180deg, #d9c9a8, #b8a67f)",bannerColor:"#3a2c14",bg:"linear-gradient(180deg, #3a2c5e 0%, #2a1f4a 60%, #1d1535 100%)",panelBg:"linear-gradient(180deg, #35296012, #241a42)",accent:"#ff9a3d",accentDark:"#e07f22",stops:["Sip","Draft","Elixir"],stopIcon:"🧪",cta:"FEED!",retake:"📖",prop:"🔮",reticle:!1}};function x({theme:m="tavern",presets:o=v,onFeed:i,onBack:b}){var s;const n=g[m]??g.tavern,[t,f]=p.useState(1),[r,h]=p.useState((s=o[0])==null?void 0:s.id),l=o.find(a=>a.id===r);return e.createElement(u,{background:n.bg},e.createElement("div",{style:{position:"relative",height:"100%",display:"flex",flexDirection:"column",background:n.bg}},n.bgImage&&e.createElement("img",{src:n.bgImage,alt:"",style:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0}}),e.createElement("div",{style:{position:"relative",zIndex:1,paddingTop:48}},e.createElement(E,{bg:n.bannerBg,color:n.bannerColor},n.banner)),e.createElement("div",{style:{position:"relative",zIndex:1,flex:1,display:"grid",placeItems:"center",padding:16}},e.createElement("div",{style:{position:"relative"}},e.createElement("img",{src:"/chewy/assets/camera_placeholder.jpg",alt:"",style:{width:220,height:220,objectFit:"cover",borderRadius:"50%",border:"4px solid var(--chewy-ink)",boxShadow:"0 10px 24px rgba(0,0,0,.5), inset 0 0 30px rgba(0,0,0,.3)"}}),n.frameImage&&e.createElement("img",{src:n.frameImage,alt:"",style:{position:"absolute",inset:-44,width:"calc(100% + 88px)",pointerEvents:"none",zIndex:2}}),n.reticle&&!n.frameImage&&e.createElement("div",{style:{position:"absolute",inset:40,borderRadius:"50%",border:"3px dashed rgba(255,255,255,.7)",display:"grid",placeItems:"center",font:"800 26px var(--font-round)",color:"rgba(255,255,255,.85)"}},"+"),e.createElement("span",{style:{position:"absolute",inset:0,display:"grid",placeItems:"center",fontSize:84,filter:"drop-shadow(0 4px 6px rgba(0,0,0,.45))"}},l==null?void 0:l.emoji))),e.createElement("div",{style:{position:"relative",zIndex:1,display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",padding:"0 12px 10px"}},o.map(a=>e.createElement("button",{key:a.id,onClick:()=>h(a.id),title:a.title,style:{fontSize:22,lineHeight:1,padding:6,borderRadius:10,border:`2px solid ${a.id===r?n.accent:"rgba(255,255,255,.25)"}`,background:a.id===r?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)",cursor:"pointer"}},a.emoji))),e.createElement("div",{style:{position:"relative",zIndex:1,background:n.panelBg,borderTop:"3px solid var(--chewy-ink)",padding:"16px 20px calc(20px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:14}},e.createElement("div",{style:{color:"#fff",font:"700 14px var(--font-round)",textAlign:"center",textShadow:"0 1px 2px rgba(0,0,0,.4)"}},"Portion"),e.createElement("input",{type:"range",min:0,max:2,step:1,value:t,onChange:a=>f(Number(a.target.value)),style:{width:"100%",accentColor:n.accent}}),e.createElement("div",{style:{display:"flex",justifyContent:"space-between",color:"rgba(255,255,255,.85)",font:"600 13px var(--font-round)"}},n.stops.map((a,c)=>e.createElement("span",{key:a,style:{opacity:t===c?1:.5,fontWeight:t===c?800:600}},n.stopIcon," ",a))),e.createElement("div",{style:{display:"flex",gap:12,alignItems:"stretch"}},e.createElement(d,{small:!0,color:"#7a6a55",colorDark:"#5d4f3e",onClick:b},n.retake),e.createElement("div",{style:{flex:1,display:"grid"}},e.createElement(d,{color:n.accent,colorDark:n.accentDark,onClick:()=>i==null?void 0:i({presetId:r,portion:t})},n.cta))))))}x.__docgenInfo={description:`AnalyzeScreen — the skinnable food-analysis skeleton.
One mechanic: photo window + 3-stop portion + FEED. All dressing
(banner text, colors, stop labels, props) comes from ANALYSIS_THEMES.
The preset chips stand in for what the camera would see.`,methods:[],displayName:"AnalyzeScreen",props:{theme:{defaultValue:{value:"'tavern'",computed:!1},required:!1},presets:{defaultValue:{value:`[
  {
    id: 'oatmeal',
    emoji: '🥣',
    title: 'Oatmeal & berries',
    proportions: { veg: 0.3, protein: 0.05, grain: 0.65 },
    wholeness: 0.95,
  },
  {
    id: 'salad',
    emoji: '🥗',
    title: 'Green bowl',
    proportions: { veg: 0.7, protein: 0.2, grain: 0.1 },
    wholeness: 1,
  },
  {
    id: 'chicken',
    emoji: '🍗',
    title: 'Chicken & buckwheat',
    proportions: { veg: 0.15, protein: 0.45, grain: 0.4 },
    wholeness: 0.9,
  },
  {
    id: 'apple',
    emoji: '🍎',
    title: 'An apple',
    proportions: { veg: 1, protein: 0, grain: 0 },
    wholeness: 1,
  },
  {
    id: 'borscht',
    emoji: '🍲',
    title: 'Borscht (hard to see)',
    proportions: { veg: 0.55, protein: 0.2, grain: 0.15 },
    wholeness: 0.85,
    confidence: 'low',
  },
  {
    id: 'pizza',
    emoji: '🍕',
    title: 'Pizza night',
    proportions: { veg: 0.05, protein: 0.15, grain: 0.55 },
    wholeness: 0.35,
  },
  {
    id: 'burger',
    emoji: '🍔',
    title: 'Burger & fries',
    proportions: { veg: 0.05, protein: 0.2, grain: 0.45 },
    wholeness: 0.3,
  },
  {
    id: 'sock',
    emoji: '🧦',
    title: 'Not food…',
    isFood: false,
  },
]`,computed:!1},required:!1}}};export{x as A};
