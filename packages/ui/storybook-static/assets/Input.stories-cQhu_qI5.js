import{j as e}from"./jsx-runtime-u17CrQMm.js";import{r as R}from"./iframe-CkDBvPxG.js";import{c as p}from"./clsx-B-dksMZM.js";import"./preload-helper-PPVm8Dsz.js";const r=R.forwardRef(({type:x="text",label:g,validationState:a="default",errorMessage:h,successMessage:v,warningMessage:S,helperText:w,required:f=!1,size:y="md",className:z,id:I,...M},q)=>{const u=I||`input-${Math.random().toString(36).substr(2,9)}`,b=`${u}-helper`,m=a==="error"?h:a==="success"?v:a==="warning"?S:w,N="w-full rounded-lg border bg-white px-3 font-sans transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",T={sm:"h-8 text-sm",md:"h-10 text-base",lg:"h-12 text-lg"},j={default:"border-neutral-300 focus:border-primary-500 focus:ring-primary-500",error:"border-error-500 focus:border-error-500 focus:ring-error-500",success:"border-success-500 focus:border-success-500 focus:ring-success-500",warning:"border-warning-500 focus:border-warning-500 focus:ring-warning-500"},E={default:"text-neutral-600",error:"text-error-700",success:"text-success-700",warning:"text-warning-700"};return e.jsxs("div",{className:p("w-full",z),children:[g&&e.jsxs("label",{htmlFor:u,className:"mb-1 block text-sm font-medium text-neutral-700",children:[g,f&&e.jsx("span",{className:"ml-1 text-error-500","aria-label":"required",children:"*"})]}),e.jsx("input",{ref:q,type:x,id:u,className:p(N,T[y??"md"],j[a??"default"]),"aria-required":f,"aria-invalid":a==="error","aria-describedby":m?b:void 0,...M}),m&&e.jsx("p",{id:b,className:p("mt-1 text-sm",E[a??"default"]),role:a==="error"?"alert":"status",children:m})]})});r.displayName="Input";r.__docgenInfo={description:`Input component with validation states and accessibility features

@param type - Input type (text, email, password, etc.)
@param label - Label text for the input
@param validationState - Validation state (default, error, success, warning)
@param errorMessage - Error message to display
@param successMessage - Success message to display
@param warningMessage - Warning message to display
@param helperText - Helper text to display
@param required - Whether the input is required
@param size - Size of the input (sm, md, lg)
@param className - Additional CSS classes`,methods:[],displayName:"Input",props:{type:{defaultValue:{value:"'text'",computed:!1},required:!1},validationState:{defaultValue:{value:"'default'",computed:!1},required:!1},required:{defaultValue:{value:"false",computed:!1},required:!1},size:{defaultValue:{value:"'md'",computed:!1},required:!1}}};const O={title:"Components/Input",component:r,tags:["autodocs"],argTypes:{type:{control:"select",options:["text","email","password","number","tel","url","search"]},validationState:{control:"select",options:["default","error","success","warning"]},size:{control:"select",options:["sm","md","lg"]},required:{control:"boolean"},disabled:{control:"boolean"}},parameters:{docs:{description:{component:`Input component with validation states and labels.
Fully supports Romanian diacritics (ă, â, î, ș, ț).

## Accessibility
- Proper label association via htmlFor
- Required fields marked with asterisk and aria-required
- Validation messages linked via aria-describedby
- Error states communicated via aria-invalid`}}}},s={args:{label:"Nume",placeholder:"Introduceți numele"}},t={args:{label:"Email",type:"email",placeholder:"exemplu@email.ro",helperText:"Vom folosi acest email pentru comunicare"}},l={args:{label:"Nume complet",placeholder:"Introduceți numele dvs.",required:!0}},o={args:{label:"Email",type:"email",value:"invalid-email",validationState:"error",errorMessage:"Adresa de email este invalidă"}},n={args:{label:"Oraș",value:"București",validationState:"success",successMessage:"Orașul a fost validat"}},i={args:{label:"Parola",type:"password",value:"weak123",validationState:"warning",warningMessage:"Parola este slabă. Considerați adăugarea de caractere speciale."}},c={args:{label:"Text cu diacritice",value:"Șeful a vândut o sticlă în oraș și țară",helperText:"Testează: ă, â, î, ș, ț"}},d={render:()=>e.jsxs("div",{className:"flex flex-col gap-4 max-w-md",children:[e.jsx(r,{label:"Mic",size:"sm",placeholder:"Size sm"}),e.jsx(r,{label:"Mediu",size:"md",placeholder:"Size md"}),e.jsx(r,{label:"Mare",size:"lg",placeholder:"Size lg"})]})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Nume',
    placeholder: 'Introduceți numele'
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'exemplu@email.ro',
    helperText: 'Vom folosi acest email pentru comunicare'
  }
}`,...t.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Nume complet',
    placeholder: 'Introduceți numele dvs.',
    required: true
  }
}`,...l.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Email',
    type: 'email',
    value: 'invalid-email',
    validationState: 'error',
    errorMessage: 'Adresa de email este invalidă'
  }
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Oraș',
    value: 'București',
    validationState: 'success',
    successMessage: 'Orașul a fost validat'
  }
}`,...n.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Parola',
    type: 'password',
    value: 'weak123',
    validationState: 'warning',
    warningMessage: 'Parola este slabă. Considerați adăugarea de caractere speciale.'
  }
}`,...i.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Text cu diacritice',
    value: 'Șeful a vândut o sticlă în oraș și țară',
    helperText: 'Testează: ă, â, î, ș, ț'
  }
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4 max-w-md">
      <Input label="Mic" size="sm" placeholder="Size sm" />
      <Input label="Mediu" size="md" placeholder="Size md" />
      <Input label="Mare" size="lg" placeholder="Size lg" />
    </div>
}`,...d.parameters?.docs?.source}}};const P=["Default","WithHelperText","Required","ErrorState","SuccessState","WarningState","RomanianDiacritics","AllSizes"];export{d as AllSizes,s as Default,o as ErrorState,l as Required,c as RomanianDiacritics,n as SuccessState,i as WarningState,t as WithHelperText,P as __namedExportsOrder,O as default};
