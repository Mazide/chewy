import"./index-Bc2G9s8g.js";import{H as b}from"./HomeScreen-DimeZjpX.js";import"./chrome-vpd_24Xf.js";import"./Hero-BrCP7LSp.js";import"./AddFoodButton-C_kWN_lo.js";import"./MealLogRow-DF1ZMcWE.js";import"./PlateRing-Bvub9gm5.js";import"./game-DgoR4cCJ.js";const q={title:"Screens/HomeScreen",component:b,parameters:{layout:"centered",backgrounds:{default:"light"}},argTypes:{status:{control:"inline-radio",options:["idle","hungry","eating","happy"]}}},e={args:{status:"hungry",meals:[],fedToday:!1,coins:24}},t={args:{status:"happy",fedToday:!0,coins:29,plate:{veg:.55,protein:.9,grain:.6},meals:[{emoji:"🥣",title:"Oatmeal & berries",time:"08:15"},{emoji:"🍗",title:"Chicken & buckwheat",time:"13:30"}]}},n={args:{status:"idle",fedToday:!0,coins:4,plate:{veg:.3,protein:.5,grain:.4},meals:[{emoji:"🥗",title:"Green bowl",time:"12:10"}],equipped:{pet:"owl",decor:"lantern",theme:"magic"}}};var r,s,i,o,a;e.parameters={...e.parameters,docs:{...(r=e.parameters)==null?void 0:r.docs,source:{originalSource:`{
  args: {
    status: 'hungry',
    meals: [],
    fedToday: false,
    coins: 24
  }
}`,...(i=(s=e.parameters)==null?void 0:s.docs)==null?void 0:i.source},description:{story:"Morning, nothing logged: hero is hungry, the fire is dozing.",...(a=(o=e.parameters)==null?void 0:o.docs)==null?void 0:a.description}}};var m,c,p,d,l;t.parameters={...t.parameters,docs:{...(m=t.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    status: 'happy',
    fedToday: true,
    coins: 29,
    plate: {
      veg: 0.55,
      protein: 0.9,
      grain: 0.6
    },
    meals: [{
      emoji: '🥣',
      title: 'Oatmeal & berries',
      time: '08:15'
    }, {
      emoji: '🍗',
      title: 'Chicken & buckwheat',
      time: '13:30'
    }]
  }
}`,...(p=(c=t.parameters)==null?void 0:c.docs)==null?void 0:p.source},description:{story:"Fed day: bright fire, mini day plate filling, log entries.",...(l=(d=t.parameters)==null?void 0:d.docs)==null?void 0:l.description}}};var g,u,y,h,f;n.parameters={...n.parameters,docs:{...(g=n.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    status: 'idle',
    fedToday: true,
    coins: 4,
    plate: {
      veg: 0.3,
      protein: 0.5,
      grain: 0.4
    },
    meals: [{
      emoji: '🥗',
      title: 'Green bowl',
      time: '12:10'
    }],
    equipped: {
      pet: 'owl',
      decor: 'lantern',
      theme: 'magic'
    }
  }
}`,...(y=(u=n.parameters)==null?void 0:u.docs)==null?void 0:y.source},description:{story:"Cosmetics live in the scene: pet by the fire, lantern, magic theme equipped.",...(f=(h=n.parameters)==null?void 0:h.docs)==null?void 0:f.description}}};const F=["MorningHungry","FedDay","WithCosmetics"];export{t as FedDay,e as MorningHungry,n as WithCosmetics,F as __namedExportsOrder,q as default};
