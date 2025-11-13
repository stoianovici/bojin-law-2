import{j as r}from"./jsx-runtime-u17CrQMm.js";import{r as M}from"./iframe-CkDBvPxG.js";import{c as l}from"./clsx-B-dksMZM.js";import"./preload-helper-PPVm8Dsz.js";const c=M.forwardRef(({label:i,validationState:e="default",errorMessage:m,successMessage:p,warningMessage:f,helperText:g,required:u=!1,rows:x=4,className:b,id:h,...w},y)=>{const o=h||`textarea-${Math.random().toString(36).substr(2,9)}`,d=`${o}-helper`,n=e==="error"?m:e==="success"?p:e==="warning"?f:g,v="w-full rounded-lg border bg-white px-3 py-2 font-sans text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical",j={default:"border-neutral-300 focus:border-primary-500 focus:ring-primary-500",error:"border-error-500 focus:border-error-500 focus:ring-error-500",success:"border-success-500 focus:border-success-500 focus:ring-success-500",warning:"border-warning-500 focus:border-warning-500 focus:ring-warning-500"},N={default:"text-neutral-600",error:"text-error-700",success:"text-success-700",warning:"text-warning-700"};return r.jsxs("div",{className:l("w-full",b),children:[i&&r.jsxs("label",{htmlFor:o,className:"mb-1 block text-sm font-medium text-neutral-700",children:[i,u&&r.jsx("span",{className:"ml-1 text-error-500","aria-label":"required",children:"*"})]}),r.jsx("textarea",{ref:y,id:o,rows:x,className:l(v,j[e??"default"]),"aria-required":u,"aria-invalid":e==="error","aria-describedby":n?d:void 0,...w}),n&&r.jsx("p",{id:d,className:l("mt-1 text-sm",N[e??"default"]),role:e==="error"?"alert":"status",children:n})]})});c.displayName="Textarea";c.__docgenInfo={description:`Textarea component with validation states and accessibility features

@param label - Label text for the textarea
@param validationState - Validation state (default, error, success, warning)
@param errorMessage - Error message to display
@param successMessage - Success message to display
@param warningMessage - Warning message to display
@param helperText - Helper text to display
@param required - Whether the textarea is required
@param rows - Number of rows
@param className - Additional CSS classes`,methods:[],displayName:"Textarea",props:{validationState:{defaultValue:{value:"'default'",computed:!1},required:!1},required:{defaultValue:{value:"false",computed:!1},required:!1},rows:{defaultValue:{value:"4",computed:!1},required:!1}}};const E={title:"Components/Textarea",component:c,tags:["autodocs"]},a={args:{label:"Descriere",placeholder:"Introduceți descrierea..."}},s={args:{label:"Comentarii",validationState:"error",errorMessage:"Comentariul este prea scurt",value:"Prea scurt"}},t={args:{label:"Mesaj",value:"Șeful a vândut o sticlă în oraș și țară",rows:3}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Descriere',
    placeholder: 'Introduceți descrierea...'
  }
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Comentarii',
    validationState: 'error',
    errorMessage: 'Comentariul este prea scurt',
    value: 'Prea scurt'
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Mesaj',
    value: 'Șeful a vândut o sticlă în oraș și țară',
    rows: 3
  }
}`,...t.parameters?.docs?.source}}};const W=["Default","WithError","WithRomanianText"];export{a as Default,s as WithError,t as WithRomanianText,W as __namedExportsOrder,E as default};
