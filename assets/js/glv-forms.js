(function () {
  'use strict';
  const messages = {
    es:{pending:'Enviando solicitud…',success:'Solicitud recibida. Número GLV: ',error:'No se pudo confirmar el envío. Reintente; se conservará el mismo número.',setup:'Servicio pendiente de activación. No se ha enviado la solicitud.',invalid:'Revise los campos obligatorios y el correo.',review:'Registro guardado; los correos requieren revisión. Referencia: ',busy:'Hay un envío en curso. Espere su confirmación.'},
    en:{pending:'Submitting request…',success:'Request received. GLV number: ',error:'Submission could not be confirmed. Retry; the same number will be retained.',setup:'The service is awaiting activation. Your request has not been sent.',invalid:'Check the required fields and email address.',review:'Record saved; email delivery needs review. Reference: ',busy:'A submission is in progress. Please wait for confirmation.'},
    'pt-br':{pending:'Enviando solicitação…',success:'Solicitação recebida. Número GLV: ',error:'Não foi possível confirmar o envio. Tente novamente; o mesmo número será mantido.',setup:'O serviço aguarda ativação. Sua solicitação não foi enviada.',invalid:'Verifique os campos obrigatórios e o e-mail.',review:'Registro salvo; o envio dos e-mails requer revisão. Referência: ',busy:'Há um envio em andamento. Aguarde a confirmação.'},
    ar:{pending:'جارٍ إرسال الطلب…',success:'تم استلام الطلب. رقم GLV: ',error:'تعذر تأكيد الإرسال. أعد المحاولة؛ سيتم الاحتفاظ بالرقم نفسه.',setup:'الخدمة بانتظار التفعيل. لم يتم إرسال طلبك.',invalid:'تحقق من الحقول المطلوبة والبريد الإلكتروني.',review:'تم حفظ السجل؛ يلزم مراجعة إرسال البريد. المرجع: ',busy:'هناك طلب قيد الإرسال. يرجى انتظار التأكيد.'},
    zh:{pending:'正在提交申请…',success:'已收到申请。GLV编号：',error:'无法确认提交。请重试；将保留相同编号。',setup:'服务等待启用。您的申请尚未发送。',invalid:'请检查必填字段和电子邮箱。',review:'记录已保存；邮件发送需要审核。参考编号：',busy:'申请正在提交中。请等待确认。'}
  };
  const verificationText={
    es:{title:'Verifique su correo',intro:'Registro PENDIENTE. Enviamos un código de seis dígitos a su correo. Vence en 15 minutos y admite cinco intentos. El número GLV se asignará después de verificarlo.',label:'Código de verificación',verify:'Verificar correo',resend:'Reenviar código',back:'Volver al formulario',wait:'Espere',seconds:'segundos',sent:'Nuevo código enviado. El anterior ya no es válido.',invalid:'Código incorrecto. Revise el correo e intente de nuevo.',expired:'El código venció. Solicite uno nuevo.',locked:'Se agotaron los cinco intentos. Solicite un código nuevo.',limit:'Se alcanzó el límite de reenvíos. Contacte a GLV por sus canales oficiales.',error:'No se pudo confirmar la operación. Intente nuevamente.',busy:'Verificando…'},
    en:{title:'Verify your email',intro:'Registration PENDING. We sent a six-digit code to your email. It expires in 15 minutes and allows five attempts. Your GLV number will be assigned after verification.',label:'Verification code',verify:'Verify email',resend:'Resend code',back:'Back to form',wait:'Wait',seconds:'seconds',sent:'New code sent. The previous code is no longer valid.',invalid:'Incorrect code. Check your email and try again.',expired:'This code expired. Request a new one.',locked:'All five attempts were used. Request a new code.',limit:'The resend limit was reached. Contact GLV through official channels.',error:'The operation could not be confirmed. Please retry.',busy:'Verifying…'},
    'pt-br':{title:'Verifique seu e-mail',intro:'Cadastro PENDENTE. Enviamos um código de seis dígitos para seu e-mail. Ele expira em 15 minutos e permite cinco tentativas. O número GLV será atribuído após a verificação.',label:'Código de verificação',verify:'Verificar e-mail',resend:'Reenviar código',back:'Voltar ao formulário',wait:'Aguarde',seconds:'segundos',sent:'Novo código enviado. O anterior não é mais válido.',invalid:'Código incorreto. Confira seu e-mail e tente novamente.',expired:'O código expirou. Solicite um novo.',locked:'As cinco tentativas foram utilizadas. Solicite um novo código.',limit:'O limite de reenvios foi atingido. Contate a GLV pelos canais oficiais.',error:'Não foi possível confirmar a operação. Tente novamente.',busy:'Verificando…'},
    ar:{title:'تحقق من بريدك الإلكتروني',intro:'التسجيل قيد الانتظار. أرسلنا رمزاً من ستة أرقام إلى بريدك. تنتهي صلاحيته خلال 15 دقيقة ويسمح بخمس محاولات. سيصدر رقم GLV بعد التحقق.',label:'رمز التحقق',verify:'التحقق من البريد',resend:'إعادة إرسال الرمز',back:'العودة إلى النموذج',wait:'انتظر',seconds:'ثانية',sent:'تم إرسال رمز جديد. الرمز السابق لم يعد صالحاً.',invalid:'الرمز غير صحيح. راجع بريدك وحاول مجدداً.',expired:'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',locked:'استُخدمت المحاولات الخمس. اطلب رمزاً جديداً.',limit:'تم بلوغ حد إعادة الإرسال. تواصل مع GLV عبر القنوات الرسمية.',error:'تعذر تأكيد العملية. حاول مجدداً.',busy:'جارٍ التحقق…'},
    zh:{title:'验证您的电子邮箱',intro:'注册待验证。我们已向您的邮箱发送六位验证码，15分钟内有效，最多可尝试五次。验证成功后才会分配GLV编号。',label:'验证码',verify:'验证邮箱',resend:'重新发送验证码',back:'返回表单',wait:'请等待',seconds:'秒',sent:'新验证码已发送，原验证码已失效。',invalid:'验证码错误，请检查邮件后重试。',expired:'验证码已过期，请申请新的验证码。',locked:'五次尝试已用完，请申请新的验证码。',limit:'已达到重发次数上限，请通过官方渠道联系GLV。',error:'无法确认操作，请重试。',busy:'正在验证…'}
  };
  Object.entries({es:'Registro PENDIENTE. Verifique su correo para obtener el número GLV.',en:'Registration PENDING. Verify your email to receive your GLV number.','pt-br':'Cadastro PENDENTE. Verifique seu e-mail para receber seu número GLV.',ar:'التسجيل قيد الانتظار. تحقق من بريدك للحصول على رقم GLV.',zh:'注册待验证。请验证邮箱以获取GLV编号。'}).forEach(([key,value])=>{messages[key].pendingVerification=value;});
  let verificationPanel;
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
  function completed(result){return result?.ok===true && /^GLV-(CL|PRV|COT)-\d{4}-\d{6}$/.test(result.code||'') && result.mailStatus==='SENT';}
  function showVerification(root,payload,result,options){
    if(verificationPanel)verificationPanel.close();
    const dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','glv-verification-title');
    dialog.style.cssText='box-sizing:border-box;width:min(94vw,520px);max-height:90dvh;overflow:auto;padding:clamp(20px,5vw,36px);background:#0b2332;color:#edf3f7;border:1px solid #526b7d;border-radius:12px;font-family:inherit;';
    dialog.innerHTML='<form><h2 id="glv-verification-title" data-v="title"></h2><p data-v="intro"></p><label for="glv-verification-code" data-v="label"></label><input id="glv-verification-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" required dir="ltr"><p role="status" aria-live="polite"></p><button type="submit" data-v="verify"></button><button type="button" data-resend></button><button type="button" data-back data-v="back"></button></form>';
    const form=dialog.querySelector('form'),input=dialog.querySelector('input'),note=dialog.querySelector('[role="status"]'),resend=dialog.querySelector('[data-resend]'),back=dialog.querySelector('[data-back]'),verify=dialog.querySelector('[type="submit"]');
    input.style.cssText='box-sizing:border-box;display:block;width:100%;margin:12px 0;padding:14px;font:inherit;font-size:24px;letter-spacing:.3em;background:#122f40;color:#fff;border:1px solid #819baa;border-radius:6px;';
    dialog.querySelectorAll('button').forEach(b=>{b.style.cssText='display:block;width:100%;margin-top:12px;padding:12px;font:inherit;cursor:pointer;border:1px solid #819baa;border-radius:6px;background:#17374a;color:#edf3f7;';});
    verify.style.background='#a88e52';verify.style.color='#071c28';
    let busy=false,message='',retryAttempt=null,resendAt=Date.parse(result.resendAt)||0;
    function render(){const t=verificationText[lang()]||verificationText.es;dialog.dir=lang()==='ar'?'rtl':'ltr';dialog.querySelectorAll('[data-v]').forEach(e=>{e.textContent=t[e.dataset.v];});const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));resend.textContent=seconds?t.wait+' '+seconds+' '+t.seconds:t.resend;resend.disabled=busy||seconds>0;verify.disabled=busy;back.disabled=busy;note.textContent=t[message]||'';}
    async function action(action){
      if(busy||inFlight)return;
      if(action==='verify'&&!form.reportValidity())return;
      busy=true;inFlight=true;message='busy';render();
      if(action==='verify'&&(!retryAttempt||retryAttempt.code!==input.value))retryAttempt={code:input.value,id:crypto.randomUUID()};
      try{
        ready=null;const challenge=await initChallenge();const delay=Math.max(0,3200-(Date.now()-challenge.issued));if(delay)await new Promise(r=>setTimeout(r,delay));
        const response=await requestJSON(endpointURL(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload,...challenge,action,verificationCode:action==='verify'?input.value:undefined,attemptId:action==='verify'?retryAttempt.id:undefined})});
        if(completed(response)){status(root,'success',response.code);dialog.close();if(typeof options.success==='function')options.success(response);return;}
        if(response?.ok&&response.state==='PENDIENTE'){resendAt=Date.parse(response.resendAt)||0;input.value='';retryAttempt=null;message='sent';}
        else{message=({INVALID_CODE:'invalid',CODE_EXPIRED:'expired',ATTEMPTS_EXHAUSTED:'locked',VERIFICATION_LIMIT:'limit',RESEND_WAIT:'wait'})[response?.error]||'error';if(response?.code)status(root,'review',response.code);if(response?.error==='INVALID_CODE')retryAttempt=null;}
      }catch(_){message='error';}finally{busy=false;inFlight=false;render();}
    }
    form.addEventListener('submit',e=>{e.preventDefault();action('verify');});resend.addEventListener('click',()=>action('resend'));back.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    const timer=setInterval(render,1000);dialog.addEventListener('close',()=>{clearInterval(timer);dialog.remove();if(verificationPanel===dialog)verificationPanel=null;},{once:true});
    document.body.appendChild(dialog);verificationPanel=dialog;render();dialog.showModal();input.focus();
  }
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
      if(result?.ok===true && result.state==='PENDIENTE'){
        status(root,'pendingVerification');showVerification(root,payload,result,options);return result;
      }
      if(!completed(result)){
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
