import{j as e}from"./jsx-runtime-u17CrQMm.js";import{B as r}from"./Button-D3Xwsl_R.js";import"./iframe-CkDBvPxG.js";import"./preload-helper-PPVm8Dsz.js";import"./clsx-B-dksMZM.js";const b={title:"Components/Button",component:r,tags:["autodocs"],argTypes:{variant:{control:"select",options:["primary","secondary","ghost"],description:"Visual style of the button"},size:{control:"select",options:["sm","md","lg"],description:"Size of the button"},loading:{control:"boolean",description:"Shows loading spinner and disables interaction"},disabled:{control:"boolean",description:"Disables the button"},children:{control:"text",description:"Button content"}},parameters:{docs:{description:{component:`Button component with multiple variants and states.
Fully supports Romanian diacritics (ă, â, î, ș, ț).

## Accessibility
- Keyboard navigation supported (Enter/Space to activate)
- Focus visible states for keyboard users
- Disabled buttons are not focusable
- Loading state communicated via aria-busy
- Proper ARIA attributes for screen readers`}}}},s={args:{variant:"primary",children:"Salvează"}},a={args:{variant:"secondary",children:"Anulează"}},t={args:{variant:"ghost",children:"Închide"}},n={args:{size:"sm",children:"Buton mic"}},o={args:{size:"lg",children:"Buton mare"}},i={args:{loading:!0,children:"Se încarcă..."}},c={args:{disabled:!0,children:"Dezactivat"}},d={args:{children:"Șeful a vândut o sticlă în oraș și țară"},parameters:{docs:{description:{story:"Demonstrates proper rendering of all Romanian diacritics: ă, â, î, ș, ț"}}}},l={render:()=>e.jsxs("div",{className:"flex gap-4",children:[e.jsx(r,{variant:"primary",children:"Primary"}),e.jsx(r,{variant:"secondary",children:"Secondary"}),e.jsx(r,{variant:"ghost",children:"Ghost"})]})},p={render:()=>e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(r,{size:"sm",children:"Mic"}),e.jsx(r,{size:"md",children:"Mediu"}),e.jsx(r,{size:"lg",children:"Mare"})]})},m={render:()=>e.jsx("div",{className:"flex flex-col gap-4",children:e.jsxs("div",{className:"flex gap-4",children:[e.jsx(r,{children:"Default"}),e.jsx(r,{disabled:!0,children:"Disabled"}),e.jsx(r,{loading:!0,children:"Loading"})]})})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    children: 'Salvează'
  }
}`,...s.parameters?.docs?.source},description:{story:"Primary button for main actions",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'secondary',
    children: 'Anulează'
  }
}`,...a.parameters?.docs?.source},description:{story:"Secondary button for less prominent actions",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'ghost',
    children: 'Închide'
  }
}`,...t.parameters?.docs?.source},description:{story:"Ghost button for tertiary actions",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm',
    children: 'Buton mic'
  }
}`,...n.parameters?.docs?.source},description:{story:"Small size button",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    children: 'Buton mare'
  }
}`,...o.parameters?.docs?.source},description:{story:"Large size button",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    children: 'Se încarcă...'
  }
}`,...i.parameters?.docs?.source},description:{story:"Button in loading state",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    children: 'Dezactivat'
  }
}`,...c.parameters?.docs?.source},description:{story:"Disabled button",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    children: 'Șeful a vândut o sticlă în oraș și țară'
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates proper rendering of all Romanian diacritics: ă, â, î, ș, ț'
      }
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"Button with Romanian diacritics",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
}`,...l.parameters?.docs?.source},description:{story:"All variants side by side",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4">
      <Button size="sm">Mic</Button>
      <Button size="md">Mediu</Button>
      <Button size="lg">Mare</Button>
    </div>
}`,...p.parameters?.docs?.source},description:{story:"All sizes side by side",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Button>Default</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    </div>
}`,...m.parameters?.docs?.source},description:{story:"All states demonstration",...m.parameters?.docs?.description}}};const S=["Primary","Secondary","Ghost","SmallSize","LargeSize","Loading","Disabled","RomanianText","AllVariants","AllSizes","AllStates"];export{p as AllSizes,m as AllStates,l as AllVariants,c as Disabled,t as Ghost,o as LargeSize,i as Loading,s as Primary,d as RomanianText,a as Secondary,n as SmallSize,S as __namedExportsOrder,b as default};
