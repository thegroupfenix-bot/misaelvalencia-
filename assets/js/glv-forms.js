(function () {
  'use strict';
  const messages = {
    es:{pending:'Enviando solicitud…',success:'Solicitud recibida. Número GLV: ',error:'No se pudo confirmar el envío. Reintente; se conservará el mismo número.',setup:'Servicio pendiente de activación. No se ha enviado la solicitud.',invalid:'Revise los campos obligatorios y el correo.',review:'Registro guardado; los correos requieren revisión. Referencia: ',busy:'Hay un envío en curso. Espere su confirmación.'},
    en:{pending:'Submitting request…',success:'Request received. GLV number: ',error:'Submission could not be confirmed. Retry; the same number will be retained.',setup:'The service is awaiting activation. Your request has not been sent.',invalid:'Check the required fields and email address.',review:'Record saved; email delivery needs review. Reference: ',busy:'A submission is in progress. Please wait for confirmation.'},
    'pt-br':{pending:'Enviando solicitação…',success:'Solicitação recebida. Número GLV: ',error:'Não foi possível confirmar o envio. Tente novamente; o mesmo número será mantido.',setup:'O serviço aguarda ativação. Sua solicitação não foi enviada.',invalid:'Verifique os campos obrigatórios e o e-mail.',review:'Registro salvo; o envio dos e-mails requer revisão. Referência: ',busy:'Há um envio em andamento. Aguarde a confirmação.'},
    ar:{pending:'جارٍ إرسال الطلب…',success:'تم استلام الطلب. رقم GLV: ',error:'تعذر تأكيد الإرسال. أعد المحاولة؛ سيتم الاحتفاظ بالرقم نفسه.',setup:'الخدمة بانتظار التفعيل. لم يتم إرسال طلبك.',invalid:'تحقق من الحقول المطلوبة والبريد الإلكتروني.',review:'تم حفظ السجل؛ يلزم مراجعة إرسال البريد. المرجع: ',busy:'هناك طلب قيد الإرسال. يرجى انتظار التأكيد.'},
    zh:{pending:'正在提交申请…',success:'已收到申请。GLV编号：',error:'无法确认提交。请重试；将保留相同编号。',setup:'服务等待启用。您的申请尚未发送。',invalid:'请检查必填字段和电子邮箱。',review:'记录已保存；邮件发送需要审核。参考编号：',busy:'申请正在提交中。请等待确认。'}
  };
  const specs = {
    client:{root:'kycForm',source:'/registro-clientes',email:'k_email',required:['k_empresa','k_nit','k_pais','k_direccion','k_actividad','k_rep','k_cargo','k_email','k_tel','k_tipo_comprador','k_productos','k_check1','k_check2','k_check3']},
    supplier:{root:'prvForm',source:'/registro-proveedores',email:'p_email',required:['p_empresa','p_pais','p_nit','p_productos','p_rep','p_email','p_tel','p_check1','p_check2']},
    service:{root:'svcForm',source:'/registro-proveedores',email:'sv_email',required:['svcType','sv_empresa','sv_pais','sv_email','sv_rep','sv_desc']},
    other:{root:'otroForm',source:'/registro-proveedores',email:'ot_email',required:['otroType','ot_empresa','ot_rep','ot_email','ot_tel','ot_descripcion','ot_check']},
    quote:{root:'genForm',source:'/cotizacion',email:'gn_em',required:['gn_n','gn_e','gn_pa','gn_em','gn_d','gn_agent']},
    sheep:{root:'tab-ovinos',source:'/cotizacion',email:'ov_email',required:['ov_nombre','ov_empresa','ov_email','ov_agent']},
    eggs:{root:'tab-huevos',source:'/cotizacion',email:'eg_email',required:['eg_nombre','eg_empresa','eg_email','eg_agent']},
    catalog:{root:'quoteModal',source:'/cotizacion',email:'m_em',required:['m_n','m_e','m_em']},
    home:{root:'.quote-form',source:'/',email:'email',required:['nombre','empresa','email','division','mensaje']}
  };
  let ready, inFlight=false;
  const statuses = new Map();
  function lang() {try{return localStorage.getItem('glv-lang') || 'es';}catch(_){return 'es';}}
  function status(root,key,code) {
    let el=root.querySelector('[data-glv-status]');
    if(!el){el=document.createElement('p');el.dataset.glvStatus='';el.setAttribute('role','status');el.setAttribute('aria-live','polite');root.appendChild(el);}
    statuses.set(el,{key,code});
    el.textContent=(messages[lang()] || messages.es)[key]+(code || '');
    el.dir=lang()==='ar'?'rtl':'auto';
  }
  function randomHex() {return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
  function endpointURL() {
    const endpoint=window.GLV_FORMS_CONFIG && window.GLV_FORMS_CONFIG.endpoint;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint || ''))throw new Error('NOT_CONFIGURED');
    return endpoint;
  }
  async function requestJSON(url,options={}) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try {
      const response=await fetch(url,{...options,credentials:'omit',redirect:'follow',signal:controller.signal});
      if(!response.ok)throw new Error('SERVICE_HTTP');
      return await response.json();
    } finally {clearTimeout(timer);}
  }
  function initChallenge() {
    if(ready)return ready;
    const endpoint=endpointURL(),channel=randomHex();
    ready=requestJSON(endpoint+'?transport=json&origin='+encodeURIComponent(location.origin)+'&channel='+channel).then(value=>{
      if(!value || value.ok!==true || value.origin!==location.origin || value.channel!==channel || !Number.isFinite(value.issued) || typeof value.signature!=='string')throw new Error('INVALID_CHALLENGE');
      return value;
    }).catch(error=>{ready=null;throw error;});
    return ready;
  }
  async function retryId(kind,fields) {
    const raw=JSON.stringify(fields);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),v=>v.toString(16).padStart(2,'0')).join('');
    const key='glv-form-retry:'+kind+':'+digest;
    let id=localStorage.getItem(key);
    if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
    // Stores an opaque id and fingerprint only, never form data or documents.
    return id;
  }
  function rootFor(spec){return spec.root[0]==='.'?document.querySelector(spec.root):document.getElementById(spec.root);}
  function fieldFor(root,key){return Array.from(root.querySelectorAll('input,select,textarea')).find(e=>e.id===key || e.name===key);}
  async function submit(kind,options) {
    options=options || {};
    const spec=specs[kind],root=spec && rootFor(spec);
    if(!root)return false;
    if(root.dataset.glvSending==='true' || inFlight){status(root,'busy');return false;}
    for(const key of spec.required){const el=fieldFor(root,key);if(!el || el.disabled || (el.type==='checkbox'?!el.checked:!el.value.trim())){status(root,'invalid');if(el){el.focus();}return false;}}
    if(kind==='service' && fieldFor(root,'svcType').value==='aduanas' && !fieldFor(root,'ad_licencia').value.trim()){status(root,'invalid');fieldFor(root,'ad_licencia').focus();return false;}
    const email=fieldFor(root,spec.email);
    if(!email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.value.trim())){status(root,'invalid');if(email)email.focus();return false;}
    const inputs=Array.from(root.querySelectorAll('input,select,textarea')).filter(el=>!el.disabled && el.type!=='file' && el.type!=='password');
    for(const el of inputs){if(!el.checkValidity()){el.reportValidity();status(root,'invalid');return false;}}
    const fields={};
    inputs.forEach(el=>{const key=el.id || el.name;if(key && key!=='glv_website')fields[key]=el.type==='checkbox'?String(el.checked):el.value.trim();});
    Object.assign(fields,options.extra || {});
    root.dataset.glvSending='true';inFlight=true;
    const buttons=Array.from(root.querySelectorAll('button')).map(el=>[el,el.disabled]);buttons.forEach(([el])=>{el.disabled=true;});
    status(root,'pending');
    try {
      let challenge=await initChallenge();
      if(Date.now()-challenge.issued>82800000){ready=null;challenge=await initChallenge();}
      const delay=Math.max(0,3200-(Date.now()-challenge.issued));
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      const id=await retryId(kind,fields);
      const payload={...challenge,kind,email:email.value.trim().toLowerCase(),source:spec.source,retryId:id,fields,website:root.querySelector('[name="glv_website"]')?.value || ''};
      const result=await requestJSON(endpointURL(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)});
      if(!result || result.ok!==true || !/^GLV-(CL|PRV|COT)-\d{4}-\d{6}$/.test(result.code || '') || result.mailStatus!=='SENT'){
        status(root,result && result.code?'review':'error',result && result.code);return false;
      }
      status(root,'success',result.code);
      if(typeof options.success==='function')options.success(result);
      return result;
    } catch(err){status(root,err.message==='NOT_CONFIGURED'?'setup':'error');return false;}
    finally{delete root.dataset.glvSending;inFlight=false;buttons.forEach(([el,disabled])=>{el.disabled=disabled;});}
  }
  function init() {
    Object.values(specs).forEach(spec=>{
      const root=rootFor(spec);if(!root || root.querySelector('[name="glv_website"]'))return;
      const trap=document.createElement('input');trap.name='glv_website';trap.type='text';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');
      trap.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);';root.appendChild(trap);
    });
    if(window.GLV_FORMS_CONFIG?.endpoint)initChallenge().catch(()=>{});
    new MutationObserver(()=>{statuses.forEach((value,el)=>{el.textContent=(messages[lang()]||messages.es)[value.key]+(value.code||'');el.dir=lang()==='ar'?'rtl':'auto';});}).observe(document.body,{attributes:true,attributeFilter:['class','dir','lang']});
  }
  window.GLVForms={submit,status};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
