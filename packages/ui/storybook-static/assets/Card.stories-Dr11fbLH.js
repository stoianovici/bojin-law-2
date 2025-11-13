import{j as e}from"./jsx-runtime-u17CrQMm.js";import{c as t}from"./clsx-B-dksMZM.js";import{B as c}from"./Button-D3Xwsl_R.js";import"./iframe-CkDBvPxG.js";import"./preload-helper-PPVm8Dsz.js";const a=({variant:p="default",header:u,children:h,footer:m,className:x,headerClassName:f,bodyClassName:v,footerClassName:C,...g})=>{const N="rounded-xl bg-white transition-all duration-150",b={default:"border border-neutral-200",elevated:"shadow-lg hover:shadow-xl",outlined:"border-2 border-neutral-300"};return e.jsxs("div",{className:t(N,b[p??"default"],x),role:"article",...g,children:[u&&e.jsx("div",{className:t("border-b border-neutral-200 px-6 py-4",f),children:u}),e.jsx("div",{className:t("px-6 py-4",v),children:h}),m&&e.jsx("div",{className:t("border-t border-neutral-200 px-6 py-4",C),children:m})]})};a.displayName="Card";a.__docgenInfo={description:`Card component with multiple variants and composition support

@param variant - Visual style (default, elevated, outlined)
@param header - Optional header content
@param children - Main card content
@param footer - Optional footer content
@param className - Additional CSS classes for the card container
@param headerClassName - Additional CSS classes for the header
@param bodyClassName - Additional CSS classes for the body
@param footerClassName - Additional CSS classes for the footer`,methods:[],displayName:"Card",props:{variant:{defaultValue:{value:"'default'",computed:!1},required:!1}}};const B={title:"Components/Card",component:a,tags:["autodocs"],argTypes:{variant:{control:"select",options:["default","elevated","outlined"]}},parameters:{docs:{description:{component:`Card component with header, body, and footer composition.
Supports multiple variants for different visual styles.`}}}},r={args:{children:"Acesta este conținutul cardului."}},s={args:{header:e.jsx("h3",{className:"text-lg font-semibold",children:"Titlu Card"}),children:"Conținutul cardului cu antet."}},n={args:{children:"Conținutul cardului cu subsol.",footer:e.jsxs("div",{className:"flex gap-2",children:[e.jsx(c,{size:"sm",children:"Salvează"}),e.jsx(c,{size:"sm",variant:"ghost",children:"Anulează"})]})}},o={args:{header:e.jsx("h3",{className:"text-lg font-semibold",children:"Card complet"}),children:e.jsx("p",{className:"text-neutral-600",children:"Acesta este un card complet cu antet, conținut și subsol. Șeful a vândut o sticlă în oraș și țară."}),footer:e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-sm text-neutral-500",children:"12 Noiembrie 2025"}),e.jsx(c,{size:"sm",children:"Citește mai mult"})]})}},l={args:{variant:"elevated",header:e.jsx("h3",{className:"text-lg font-semibold",children:"Card ridicat"}),children:"Card cu umbră pentru a crea profunzime."}},d={args:{variant:"outlined",header:e.jsx("h3",{className:"text-lg font-semibold",children:"Card cu contur"}),children:"Card cu contur mai pronunțat."}},i={render:()=>e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs(a,{variant:"default",children:[e.jsx("p",{className:"font-medium",children:"Default"}),e.jsx("p",{className:"text-sm text-neutral-600",children:"Variant standard"})]}),e.jsxs(a,{variant:"elevated",children:[e.jsx("p",{className:"font-medium",children:"Elevated"}),e.jsx("p",{className:"text-sm text-neutral-600",children:"Cu umbră"})]}),e.jsxs(a,{variant:"outlined",children:[e.jsx("p",{className:"font-medium",children:"Outlined"}),e.jsx("p",{className:"text-sm text-neutral-600",children:"Cu contur"})]})]})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    children: 'Acesta este conținutul cardului.'
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    header: <h3 className="text-lg font-semibold">Titlu Card</h3>,
    children: 'Conținutul cardului cu antet.'
  }
}`,...s.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    children: 'Conținutul cardului cu subsol.',
    footer: <div className="flex gap-2">
        <Button size="sm">Salvează</Button>
        <Button size="sm" variant="ghost">
          Anulează
        </Button>
      </div>
  }
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    header: <h3 className="text-lg font-semibold">Card complet</h3>,
    children: <p className="text-neutral-600">
        Acesta este un card complet cu antet, conținut și subsol. Șeful a vândut o sticlă în oraș și țară.
      </p>,
    footer: <div className="flex justify-between items-center">
        <span className="text-sm text-neutral-500">12 Noiembrie 2025</span>
        <Button size="sm">Citește mai mult</Button>
      </div>
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'elevated',
    header: <h3 className="text-lg font-semibold">Card ridicat</h3>,
    children: 'Card cu umbră pentru a crea profunzime.'
  }
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'outlined',
    header: <h3 className="text-lg font-semibold">Card cu contur</h3>,
    children: 'Card cu contur mai pronunțat.'
  }
}`,...d.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid grid-cols-3 gap-4">
      <Card variant="default">
        <p className="font-medium">Default</p>
        <p className="text-sm text-neutral-600">Variant standard</p>
      </Card>
      <Card variant="elevated">
        <p className="font-medium">Elevated</p>
        <p className="text-sm text-neutral-600">Cu umbră</p>
      </Card>
      <Card variant="outlined">
        <p className="font-medium">Outlined</p>
        <p className="text-sm text-neutral-600">Cu contur</p>
      </Card>
    </div>
}`,...i.parameters?.docs?.source}}};const w=["Default","WithHeader","WithFooter","Complete","Elevated","Outlined","AllVariants"];export{i as AllVariants,o as Complete,r as Default,l as Elevated,d as Outlined,n as WithFooter,s as WithHeader,w as __namedExportsOrder,B as default};
