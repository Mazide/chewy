import{R as e}from"./index-Bc2G9s8g.js";const d=["plank","scroll","parchment_map","leather_panel","coin","orb_map","orb_compass","orb_backpack"];function r({background:s,label:o}){return e.createElement("div",null,e.createElement("div",{style:{font:"800 13px system-ui",margin:"0 0 8px"}},o),e.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:14,padding:18,borderRadius:16,...s}},d.map(a=>e.createElement("div",{key:a,style:{display:"flex",flexDirection:"column",alignItems:"center",gap:6}},e.createElement("img",{src:`/chewy/assets/gen/packA/${a}.png`,alt:a,style:{width:"100%",maxWidth:150}}),e.createElement("span",{style:{font:"700 11px system-ui",color:"#fff",textShadow:"0 1px 2px rgba(0,0,0,.6)"}},a)))))}const m={title:"Assets/PackA",parameters:{layout:"fullscreen"}},t={render:()=>e.createElement("div",{style:{padding:20,display:"flex",flexDirection:"column",gap:20,background:"#fff",minHeight:"100vh"}},e.createElement(r,{label:"На сцене кемпа (боевой фон)",background:{backgroundImage:"url(/chewy/assets/camp_frame.jpg), linear-gradient(180deg, #7ec850, #2e9e4f)",backgroundSize:"cover"}}),e.createElement(r,{label:"На тёмном (края альфы)",background:{background:"#1d1535"}}))};var n,c,l;t.parameters={...t.parameters,docs:{...(n=t.parameters)==null?void 0:n.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    background: '#fff',
    minHeight: '100vh'
  }}>
      <Sheet label="На сцене кемпа (боевой фон)" background={{
      backgroundImage: 'url(/chewy/assets/camp_frame.jpg), linear-gradient(180deg, #7ec850, #2e9e4f)',
      backgroundSize: 'cover'
    }} />
      <Sheet label="На тёмном (края альфы)" background={{
      background: '#1d1535'
    }} />
    </div>
}`,...(l=(c=t.parameters)==null?void 0:c.docs)==null?void 0:l.source}}};const p=["ContactSheet"];export{t as ContactSheet,p as __namedExportsOrder,m as default};
