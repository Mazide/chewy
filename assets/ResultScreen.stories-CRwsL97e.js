import"./index-Bc2G9s8g.js";import{R as X}from"./ResultScreen-CPPfbNdx.js";import{s as e,E as i,M as j}from"./game-DgoR4cCJ.js";import"./chrome-vpd_24Xf.js";import"./Hero-BrCP7LSp.js";import"./PlateRing-Bvub9gm5.js";const U={title:"Screens/ResultScreen",component:X},r=G=>j.find(O=>O.id===G),s={args:{result:e(i,r("salad"),1,0)}},a={args:{result:e({veg:1,protein:1,grain:2},r("pizza"),2,2)}},o={args:{result:e({veg:1.5,protein:2,grain:2},r("apple"),0,2)}},t={args:{result:e(i,r("chicken"),1,4)}},n={args:{result:e(i,r("borscht"),1,1)}},c={args:{result:e(i,r("sock"),1,0)}};var p,l,d,m,u;s.parameters={...s.parameters,docs:{...(p=s.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    result: scoreMeal(EMPTY_PLATE, preset('salad'), 1, 0)
  }
}`,...(d=(l=s.parameters)==null?void 0:l.docs)==null?void 0:d.source},description:{story:"First meal of the day: big contribution → happy, full reward.",...(u=(m=s.parameters)==null?void 0:m.docs)==null?void 0:u.description}}};var g,h,f,M,E;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    result: scoreMeal({
      veg: 1,
      protein: 1,
      grain: 2
    }, preset('pizza'), 2, 2)
  }
}`,...(f=(h=a.parameters)==null?void 0:h.docs)==null?void 0:f.source},description:{story:"Pizza XL in the evening, grains already full → tiny contribution, min coin, stuffed phrase. No shame.",...(E=(M=a.parameters)==null?void 0:M.docs)==null?void 0:E.description}}};var y,S,P,T,k;o.parameters={...o.parameters,docs:{...(y=o.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    result: scoreMeal({
      veg: 1.5,
      protein: 2,
      grain: 2
    }, preset('apple'), 0, 2)
  }
}`,...(P=(S=o.parameters)==null?void 0:S.docs)==null?void 0:P.source},description:{story:"An apple as a snack while veg is still unfilled → honest reward (fixes the 50/25/25 snack trap).",...(k=(T=o.parameters)==null?void 0:T.docs)==null?void 0:k.description}}};var A,L,_,v,F;t.parameters={...t.parameters,docs:{...(A=t.parameters)==null?void 0:A.docs,source:{originalSource:`{
  args: {
    result: scoreMeal(EMPTY_PLATE, preset('chicken'), 1, 4)
  }
}`,...(_=(L=t.parameters)==null?void 0:L.docs)==null?void 0:_.source},description:{story:"5th meal of the day: anti-farm cap → base coin only, gentle note, streak untouched.",...(F=(v=t.parameters)==null?void 0:v.docs)==null?void 0:F.description}}};var b,z,w,R,Y;n.parameters={...n.parameters,docs:{...(b=n.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    result: scoreMeal(EMPTY_PLATE, preset('borscht'), 1, 1)
  }
}`,...(w=(z=n.parameters)==null?void 0:z.docs)==null?void 0:w.source},description:{story:"Gemini not sure (soup, steam) → hero admits it, log still counts.",...(Y=(R=n.parameters)==null?void 0:R.docs)==null?void 0:Y.description}}};var C,x,N,H,J;c.parameters={...c.parameters,docs:{...(C=c.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    result: scoreMeal(EMPTY_PLATE, preset('sock'), 1, 0)
  }
}`,...(N=(x=c.parameters)==null?void 0:x.docs)==null?void 0:N.source},description:{story:"Troll photo → playful reaction, no log, no coins.",...(J=(H=c.parameters)==null?void 0:H.docs)==null?void 0:J.description}}};const V=["FirstMealHappy","JunkEvening","AppleSnack","FifthMealCapped","LowConfidence","NotFood"];export{o as AppleSnack,t as FifthMealCapped,s as FirstMealHappy,a as JunkEvening,n as LowConfidence,c as NotFood,V as __namedExportsOrder,U as default};
