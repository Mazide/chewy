import{R as e}from"./index-Bc2G9s8g.js";import{H as n}from"./Hero-BrCP7LSp.js";const v={title:"Components/Hero",component:n,argTypes:{status:{control:"inline-radio",options:["idle","hungry","eating","happy"]},showBubble:{control:"boolean"}},args:{status:"idle",showBubble:!0}},s={args:{status:"idle"}},a={args:{status:"hungry"}},r={args:{status:"eating"}},t={args:{status:"happy"}},o={render:()=>e.createElement("div",{style:{display:"flex",gap:40,alignItems:"flex-end"}},e.createElement(n,{status:"hungry"}),e.createElement(n,{status:"eating"}),e.createElement(n,{status:"happy"}))};var p,c,u;s.parameters={...s.parameters,docs:{...(p=s.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    status: 'idle'
  }
}`,...(u=(c=s.parameters)==null?void 0:c.docs)==null?void 0:u.source}}};var l,i,d;a.parameters={...a.parameters,docs:{...(l=a.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    status: 'hungry'
  }
}`,...(d=(i=a.parameters)==null?void 0:i.docs)==null?void 0:d.source}}};var g,m,y;r.parameters={...r.parameters,docs:{...(g=r.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    status: 'eating'
  }
}`,...(y=(m=r.parameters)==null?void 0:m.docs)==null?void 0:y.source}}};var h,H,f;t.parameters={...t.parameters,docs:{...(h=t.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    status: 'happy'
  }
}`,...(f=(H=t.parameters)==null?void 0:H.docs)==null?void 0:f.source}}};var E,S,x;o.parameters={...o.parameters,docs:{...(E=o.parameters)==null?void 0:E.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: 40,
    alignItems: 'flex-end'
  }}>
      <Hero status="hungry" />
      <Hero status="eating" />
      <Hero status="happy" />
    </div>
}`,...(x=(S=o.parameters)==null?void 0:S.docs)==null?void 0:x.source}}};const _=["Idle","Hungry","Eating","Happy","AllStates"];export{o as AllStates,r as Eating,t as Happy,a as Hungry,s as Idle,_ as __namedExportsOrder,v as default};
