/* Server only. Install in Apps Script owned by serviciosglvsas@gmail.com. */
var GLV_OWNER = 'serviciosglvsas@gmail.com';
var GLV_INTERNAL = ['contabilidad@glvservicesexp.com', GLV_OWNER];
var GLV_HEADERS = ['Número GLV', 'Tipo de registro', 'Fecha y hora', 'Nombre o razón social', 'Correo', 'Teléfono', 'País', 'Datos completos del formulario', 'Estado de envío', 'Identificador de reintento', 'Huella de solicitud', 'Origen', 'Correo contabilidad', 'Correo interno GLV', 'Correo solicitante'];
var GLV_SCHEMA = {
  client: {sheet:'Clientes', prefix:'CL', source:'/registro-clientes', name:'k_empresa', email:'k_email', phone:'k_tel', country:'k_pais', required:['k_empresa','k_nit','k_pais','k_direccion','k_actividad','k_rep','k_cargo','k_email','k_tel','k_tipo_comprador','k_productos'], checks:['k_check1','k_check2','k_check3']},
  supplier: {sheet:'Proveedores', prefix:'PRV', source:'/registro-proveedores', name:'p_empresa', email:'p_email', phone:'p_tel', country:'p_pais', required:['p_empresa','p_pais','p_nit','p_productos','p_rep','p_email','p_tel'], checks:['p_check1','p_check2']},
  service: {sheet:'Proveedores', prefix:'PRV', source:'/registro-proveedores', name:'sv_empresa', email:'sv_email', phone:'sv_tel', country:'sv_pais', required:['svcType','sv_empresa','sv_pais','sv_email','sv_rep','sv_desc']},
  other: {sheet:'Proveedores', prefix:'PRV', source:'/registro-proveedores', name:'ot_empresa', email:'ot_email', phone:'ot_tel', country:'ot_pais', required:['otroType','ot_empresa','ot_rep','ot_email','ot_tel','ot_descripcion'], checks:['ot_check']},
  quote: {sheet:'Cotizaciones', prefix:'COT', source:'/cotizacion', name:'gn_e', email:'gn_em', phone:'gn_t', country:'gn_pa', required:['gn_n','gn_e','gn_pa','gn_em','gn_d','gn_agent']},
  sheep: {sheet:'Cotizaciones', prefix:'COT', source:'/cotizacion', name:'ov_empresa', email:'ov_email', phone:'ov_tel', country:'ov_pais', required:['ov_nombre','ov_empresa','ov_email','ov_agent','_summary']},
  eggs: {sheet:'Cotizaciones', prefix:'COT', source:'/cotizacion', name:'eg_empresa', email:'eg_email', phone:'eg_tel', country:'eg_pais', required:['eg_nombre','eg_empresa','eg_email','eg_agent','_summary']},
  catalog: {sheet:'Cotizaciones', prefix:'COT', source:'/cotizacion', name:'m_e', email:'m_em', phone:'m_t', country:'m_d', required:['m_n','m_e','m_em','_product']},
  home: {sheet:'Cotizaciones', prefix:'COT', source:'/', name:'empresa', email:'email', phone:'telefono', country:'destino', required:['nombre','empresa','email','division','mensaje']}
};

function owner_() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GLV_OWNER) throw new Error('OWNER_REQUIRED');
}

// Run manually in the editor. Private helpers ending in _ cannot be called via google.script.run.
function setup_() {
  owner_();
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('GLV_SHEET_ID');
  var book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('GLV — Registros privados de formularios');
  var file = DriveApp.getFileById(book.getId());
  if (file.getOwner().getEmail().toLowerCase() !== GLV_OWNER) throw new Error('SHEET_OWNER_REQUIRED');
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE || file.getEditors().length || file.getViewers().length) throw new Error('SHEET_MUST_BE_PRIVATE');
  ['Clientes','Proveedores','Cotizaciones','Registro de envíos','Errores técnicos'].forEach(function(name) {
    var sheet = book.getSheetByName(name) || book.insertSheet(name);
    var headers = name === 'Registro de envíos' ? ['Fecha y hora','Número GLV','Canal','Destino','Estado','Detalle'] : name === 'Errores técnicos' ? ['Fecha y hora','Identificador de reintento','Código técnico'] : GLV_HEADERS;
    if (!sheet.getLastRow()) sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  });
  props.setProperty('GLV_SHEET_ID',book.getId());
  if (!props.getProperty('GLV_SIGNING_SECRET')) props.setProperty('GLV_SIGNING_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if (!props.getProperty('GLV_MODE')) props.setProperty('GLV_MODE','TEST');
  return book.getUrl();
}

// Editor entry point: private helpers are hidden from the Apps Script run menu.
// Anonymous Web App callers have no active-user email and cannot initialize.
function initializeGLV() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== GLV_OWNER) throw new Error('OWNER_REQUIRED');
  var url = setup_();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('GLV_MODE') === 'TEST') props.setProperty('GLV_TEST_ORIGIN','http://127.0.0.1:8799');
  console.log(url);
  return url;
}

// Owner-only controlled mail test. Repeated runs preserve the same request ID.
function runControlledGLVTest() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== GLV_OWNER) throw new Error('OWNER_REQUIRED');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('GLV_MODE') !== 'TEST') throw new Error('TEST_MODE_REQUIRED');
  var id = props.getProperty('GLV_CONTROLLED_TEST_ID');
  if (!id) { id = Utilities.getUuid(); props.setProperty('GLV_CONTROLLED_TEST_ID',id); }
  var origin = 'https://glvservicesexp.com', channel = '0123456789abcdef0123456789abcdef', issued = Date.now()-5000;
  var result = submitForm({kind:'home',email:GLV_OWNER,source:'/',retryId:id,origin:origin,channel:channel,issued:issued,signature:sign_(origin+'|'+channel+'|'+issued),website:'',fields:{nombre:'PRUEBA TÉCNICA GLV',empresa:'PRUEBA TÉCNICA',email:GLV_OWNER,division:'Granos',mensaje:'PRUEBA TÉCNICA GLV. Verificación de almacenamiento y tres correos. Sin solicitud comercial.'}});
  console.log(JSON.stringify(result));
  return result;
}

// Run only after mailbox receipt and browser submission have been verified.
function activateGLVLive() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== GLV_OWNER) throw new Error('OWNER_REQUIRED');
  owner_();
  var props=PropertiesService.getScriptProperties();
  if (!props.getProperty('GLV_SHEET_ID') || !props.getProperty('GLV_SIGNING_SECRET')) throw new Error('NOT_CONFIGURED');
  props.setProperty('GLV_MODE','LIVE');
  console.log('GLV_MODE=LIVE');
}

function origins_() {
  var extra = PropertiesService.getScriptProperties().getProperty('GLV_TEST_ORIGIN');
  return ['https://glvservicesexp.com','https://www.glvservicesexp.com'].concat(extra && PropertiesService.getScriptProperties().getProperty('GLV_MODE') === 'TEST' ? [extra] : []);
}
function sign_(value) {
  var secret = PropertiesService.getScriptProperties().getProperty('GLV_SIGNING_SECRET');
  if (!secret) throw new Error('NOT_CONFIGURED');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, secret));
}
function doGet(e) {
  var p = e && e.parameter || {};
  if (p.transport === 'json') return challengeJSON_(p);
  if (origins_().indexOf(p.origin) < 0 || !/^[a-f0-9]{32}$/.test(p.channel || '')) return HtmlService.createHtmlOutput('GLV forms service');
  var template = HtmlService.createTemplateFromFile('Bridge');
  var issued = Date.now();
  template.config = JSON.stringify({origin:p.origin,channel:p.channel,issued:issued,signature:sign_(p.origin+'|'+p.channel+'|'+issued)}).replace(/</g,'\\u003c');
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function challengeJSON_(p) {
  if (origins_().indexOf(p.origin) < 0 || !/^[a-f0-9]{32}$/.test(p.channel || '')) return json_({ok:false,error:'INVALID_ORIGIN'});
  var issued = Date.now();
  return json_({ok:true,origin:p.origin,channel:p.channel,issued:issued,signature:sign_(p.origin+'|'+p.channel+'|'+issued)});
}
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 45000) return json_({ok:false,error:'INVALID_REQUEST'});
    return json_(submitForm(JSON.parse(raw)));
  } catch (_) { return json_({ok:false,error:'INVALID_REQUEST'}); }
}

function normalize_(p) {
  if (!p || typeof p !== 'object' || JSON.stringify(p).length > 45000) throw new Error('INVALID_REQUEST');
  var schema = GLV_SCHEMA[p.kind];
  if (!schema || p.source !== schema.source || origins_().indexOf(p.origin) < 0) throw new Error('INVALID_ORIGIN');
  if (!/^[a-f0-9-]{36}$/.test(p.retryId || '') || !/^[a-f0-9]{32}$/.test(p.channel || '')) throw new Error('INVALID_REQUEST');
  var age = Date.now() - Number(p.issued);
  if (age < 3000 || age > 86400000 || p.signature !== sign_(p.origin+'|'+p.channel+'|'+p.issued) || p.website) throw new Error('SPAM_REJECTED');
  if (!p.fields || Object.prototype.toString.call(p.fields) !== '[object Object]') throw new Error('INVALID_FIELDS');
  var fields = {};
  Object.keys(p.fields).sort().forEach(function(key) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || typeof p.fields[key] !== 'string' || p.fields[key].length > 8000) throw new Error('INVALID_FIELDS');
    fields[key] = p.fields[key].trim();
  });
  schema.required.forEach(function(key) {if (!fields[key]) throw new Error('REQUIRED_FIELDS');});
  (schema.checks || []).forEach(function(key) {if (fields[key] !== 'true') throw new Error('DECLARATIONS_REQUIRED');});
  if (p.kind === 'service' && fields.svcType === 'aduanas' && !fields.ad_licencia) throw new Error('REQUIRED_FIELDS');
  if (p.kind === 'quote' && fields.gn_division === 'fertilizantes' && !fields.agri_service) throw new Error('REQUIRED_FIELDS');
  if (p.kind === 'quote' && /^(pollo-colombiano|pollo-brasil)$/.test(fields.gn_division || '') && !fields.poultry_role) throw new Error('REQUIRED_FIELDS');
  var email = fields[schema.email].toLowerCase();
  if (email.length > 254 || !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)) throw new Error('INVALID_EMAIL');
  fields[schema.email] = email;
  if (fields[schema.name].length > 200 || /[\r\n]/.test(fields[schema.name])) throw new Error('INVALID_FIELDS');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('GLV_MODE') !== 'LIVE' && (email !== GLV_OWNER || !/PRUEBA TÉCNICA/.test(fields[schema.name]))) throw new Error('TEST_ONLY');
  return {schema:schema, fields:fields, email:email, name:fields[schema.name], hash:digest_(JSON.stringify({kind:p.kind,source:p.source,fields:fields}))};
}
function digest_(s) {return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s));}
function cell_(s) {s=String(s == null ? '' : s);return /^[=+@\-\t\r\n]/.test(s) ? "'"+s : s;}
function nextNumber_(sheet,prefix) {
  var year=Utilities.formatDate(new Date(),'America/Bogota','yyyy');
  var base='GLV-'+prefix+'-'+year+'-';
  var props=PropertiesService.getScriptProperties(), key='SEQ_'+prefix+'_'+year;
  var highest=Number(props.getProperty(key)||0);
  if (sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().forEach(function(row){if(String(row[0]).indexOf(base)===0) highest=Math.max(highest,Number(String(row[0]).slice(base.length))||0);});
  if (highest>=999999) throw new Error('SEQUENCE_EXHAUSTED');
  props.setProperty(key,String(highest+1)); // Reserve before append: gaps possible, duplicate numbers forbidden.
  return base+String(highest+1).padStart(6,'0');
}
function rateLimit_(book,email) {
  var since=Date.now()-3600000,count=0,total=0;
  ['Clientes','Proveedores','Cotizaciones'].forEach(function(name){
    var sheet=book.getSheetByName(name);
    if(sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues().forEach(function(r){if(new Date(r[2]).getTime()>since){total++;if(String(r[4]).toLowerCase()===email)count++;}});
  });
  if(count>=5 || total>=25) throw new Error('RATE_LIMIT');
}
function logSend_(book,code,channel,to,state,detail) {
  book.getSheetByName('Registro de envíos').appendRow([new Date().toISOString(),code,channel,to,state,detail]);
}
function confirmation_(record) {
  return (record.verified?'Bienvenido a GLV Services. Su correo ha sido verificado.\n\n':'')+'Confirmamos la recepción de su solicitud.\n\nNúmero GLV: '+record.code+'\nNombre o razón social: '+record.name+'\nTipo de solicitud: '+record.type+'\nFecha de registro: '+record.date+' (America/Bogota)\n\nNuestro equipo revisará la información y responderá mediante canales oficiales de GLV Services S.A.S.'+(record.verified?'\n\nSitio oficial: https://www.glvservicesexp.com\nCotización: https://glvservicesexp.com/cotizacion\nRegistro de Proveedores: https://glvservicesexp.com/registro-proveedores\nCanales oficiales: https://glvservicesexp.com/redes-sociales':'');
}

var GLV_VERIFICATION_HEADERS=['Estado de registro','Verificación HMAC','Vencimiento','Intentos','Último código enviado','Códigos enviados','Fecha verificado','Intentos procesados','Estado correo verificación'];
function verificationReply_(row) {
  return {ok:true,state:'PENDIENTE',expiresAt:row[17],resendAt:new Date(Number(row[19]||0)+60000).toISOString(),attemptsRemaining:Math.max(0,5-Number(row[18]||0))};
}
function sendVerification_(book,sheet,index,row,n) {
  var now=Date.now(),sent=Number(row[20]||0);
  if(now-Number(row[19]||0)<60000)return {ok:false,error:'RESEND_WAIT'};
  if(sent>=5)return {ok:false,error:'VERIFICATION_LIMIT'};
  if(MailApp.getRemainingDailyQuota()<1)return {ok:false,error:'MAIL_QUOTA'};
  // UUID entropy plus rejection sampling; only the keyed digest is persisted.
  var sample;
  do {sample=parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16);}while(sample>=4294000000);
  var code=String(sample%1000000).padStart(6,'0');
  row[16]=sign_('otp|'+row[9]+'|'+(sent+1)+'|'+code);
  row[17]=new Date(now+900000).toISOString();row[18]=0;row[19]=now;row[20]=sent+1;row[22]='[]';row[23]='SENDING';
  for(var c=16;c<24;c++)sheet.getRange(index,c+1).setValue(row[c]===undefined?'':row[c]);
  SpreadsheetApp.flush();
  try {
    MailApp.sendEmail({to:n.email,subject:'GLV Services — Código de verificación',body:'Su código de verificación GLV es: '+code+'\n\nVence en 15 minutos y permite cinco intentos. No comparta este código. Su registro permanece PENDIENTE y todavía no tiene número GLV. Si no realizó esta solicitud, ignore este correo.',name:'GLV Services S.A.S.',replyTo:GLV_OWNER});
    row[23]='SENT';sheet.getRange(index,24).setValue('SENT');
    logSend_(book,'','VERIFICATION',n.email,'SENT','Código enviado al solicitante; no registrado en la hoja.');
  }catch(e){row[23]='UNKNOWN';sheet.getRange(index,24).setValue('UNKNOWN');return {ok:false,error:'VERIFICATION_MAIL'};}
  return verificationReply_(row);
}
function verifyPending_(book,sheet,index,row,n,p,isNew) {
  if(p.action==='resend')return sendVerification_(book,sheet,index,row,n);
  if(p.action!=='verify')return isNew?sendVerification_(book,sheet,index,row,n):verificationReply_(row);
  if(!/^[0-9]{6}$/.test(p.verificationCode||'') || !/^[a-f0-9-]{36}$/.test(p.attemptId||''))return {ok:false,error:'INVALID_CODE'};
  if(!row[16] || Date.now()>=new Date(row[17]).getTime())return {ok:false,error:'CODE_EXPIRED'};
  if(Number(row[18])>=5)return {ok:false,error:'ATTEMPTS_EXHAUSTED'};
  var attempts=JSON.parse(row[22]||'[]');
  if(attempts.indexOf(p.attemptId)>=0)return {ok:false,error:'INVALID_CODE',attemptsRemaining:5-Number(row[18])};
  row[18]=Number(row[18]||0)+1;attempts.push(p.attemptId);
  sheet.getRange(index,19).setValue(row[18]);sheet.getRange(index,23).setValue(JSON.stringify(attempts));SpreadsheetApp.flush();
  if(row[16]!==sign_('otp|'+row[9]+'|'+row[20]+'|'+p.verificationCode))return {ok:false,error:row[18]>=5?'ATTEMPTS_EXHAUSTED':'INVALID_CODE',attemptsRemaining:5-row[18]};
  // Persist verification first so an interrupted allocation can finish on retry.
  row[15]='VERIFICADO';row[21]=new Date().toISOString();
  sheet.getRange(index,16).setValue(row[15]);sheet.getRange(index,22).setValue(row[21]);
  sheet.getRange(index,17).setValue('');sheet.getRange(index,18).setValue('');SpreadsheetApp.flush();
  return null;
}

// The only public RPC. Returns no submitted personal data.
function submitForm(p) {
  var lock=LockService.getScriptLock(), locked=false, book;
  try {
    owner_();
    var n=normalize_(p);
    if(p.action && ['verify','resend'].indexOf(p.action)<0)throw new Error('INVALID_REQUEST');
    var requiresVerification=n.schema.prefix!=='COT';
    if(!lock.tryLock(25000)) return {ok:false,error:'BUSY'};
    locked=true;
    book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GLV_SHEET_ID'));
    var sheet=book.getSheetByName(n.schema.sheet);
    if(requiresVerification)GLV_VERIFICATION_HEADERS.forEach(function(h,i){sheet.getRange(1,i+16).setValue(h);});
    var rows=sheet.getDataRange().getValues(),rowIndex=0,row,isNew=false;
    for(var i=1;i<rows.length;i++)if(rows[i][9]===p.retryId || (requiresVerification && rows[i][10]===n.hash)){rowIndex=i+1;row=rows[i];break;}
    if(row){if(row[10]!==n.hash) throw new Error('RETRY_CONFLICT');}
    else {
      // Retry identifiers cannot be reused for a different registration category.
      ['Clientes','Proveedores','Cotizaciones'].forEach(function(name){if(name===n.schema.sheet)return;var rs=book.getSheetByName(name).getDataRange().getValues();if(rs.some(function(r){return r[9]===p.retryId;}))throw new Error('RETRY_CONFLICT');});
      rateLimit_(book,n.email);
      if(p.action)throw new Error('INVALID_REQUEST');
      var code=requiresVerification?'':nextNumber_(sheet,n.schema.prefix);
      row=[code,p.kind,new Date().toISOString(),cell_(n.name),n.email,cell_(n.fields[n.schema.phone]),cell_(n.fields[n.schema.country]),JSON.stringify(n.fields),'PENDING',p.retryId,n.hash,p.origin+p.source,'PENDING','PENDING','PENDING'];
      if(requiresVerification)row=row.concat(['PENDIENTE','','',0,0,0,'','[]','PENDING']);
      sheet.appendRow(row);rowIndex=sheet.getLastRow();SpreadsheetApp.flush();isNew=true;
    }
    if(requiresVerification && !row[0]){
      if(row[15]!=='VERIFICADO'){var pending=verifyPending_(book,sheet,rowIndex,row,n,p,isNew);if(pending)return pending;}
      row[0]=nextNumber_(sheet,n.schema.prefix);sheet.getRange(rowIndex,1).setValue(row[0]);SpreadsheetApp.flush();
    }
    var displayDate=Utilities.formatDate(new Date(row[2]),'America/Bogota','yyyy-MM-dd HH:mm:ss');
    var type=n.schema.sheet+' / '+p.kind;
    var internal='Número GLV: '+row[0]+'\nTipo: '+type+'\nFecha: '+displayDate+' (America/Bogota)\nOrigen: '+row[11]+'\n\n'+Object.keys(n.fields).map(function(k){return k+': '+n.fields[k];}).join('\n');
    var mails=[{to:GLV_INTERNAL[0],role:'INTERNAL_ACCOUNTING',body:internal},{to:GLV_INTERNAL[1],role:'INTERNAL_GLV',body:internal},{to:n.email,role:'APPLICANT',body:confirmation_({code:row[0],name:n.name,type:type,date:displayDate,verified:requiresVerification})}];
    for(var m=0;m<3;m++) {
      var column=13+m,state=String(sheet.getRange(rowIndex,column).getValue());
      if(state==='SENT')continue;
      // A terminated execution or mail exception may have delivered mail. Never auto-resend it.
      if(state==='SENDING' || state==='UNKNOWN'){
        sheet.getRange(rowIndex,9).setValue('REVIEW');
        return {ok:false,error:'DELIVERY_REVIEW',code:row[0]};
      }
      if(MailApp.getRemainingDailyQuota()<1){
        sheet.getRange(rowIndex,9).setValue('WAIT_QUOTA');
        logSend_(book,row[0],mails[m].role,mails[m].to,'DEFERRED','MAIL_QUOTA');
        return {ok:false,error:'MAIL_QUOTA',code:row[0]};
      }
      sheet.getRange(rowIndex,column).setValue('SENDING');SpreadsheetApp.flush();
      try {
        MailApp.sendEmail({to:mails[m].to,subject:'GLV '+row[0]+' — '+(m===2?'Confirmación de recepción':'Registro recibido'),body:mails[m].body,name:'GLV Services S.A.S.',replyTo:GLV_OWNER});
        sheet.getRange(rowIndex,column).setValue('SENT');SpreadsheetApp.flush();
        logSend_(book,row[0],mails[m].role,mails[m].to,'SENT','Aceptado por MailApp; recepción en buzón pendiente de comprobar.');
      } catch(err) {
        sheet.getRange(rowIndex,column).setValue('UNKNOWN');sheet.getRange(rowIndex,9).setValue('REVIEW');SpreadsheetApp.flush();
        logSend_(book,row[0],mails[m].role,mails[m].to,'UNKNOWN','Revisión manual requerida antes de reintentar.');
        return {ok:false,error:'DELIVERY_REVIEW',code:row[0]};
      }
    }
    sheet.getRange(rowIndex,9).setValue('SENT');SpreadsheetApp.flush();
    return {ok:true,state:requiresVerification?'VERIFICADO':'RECIBIDO',code:row[0],registeredAt:row[2],mailStatus:'SENT'};
  } catch(err) {
    var known=['OWNER_REQUIRED','NOT_CONFIGURED','INVALID_REQUEST','INVALID_ORIGIN','SPAM_REJECTED','INVALID_FIELDS','REQUIRED_FIELDS','DECLARATIONS_REQUIRED','INVALID_EMAIL','TEST_ONLY','RATE_LIMIT','RETRY_CONFLICT','SEQUENCE_EXHAUSTED'];
    var message=known.indexOf(err.message)>=0?err.message:'SERVICE_ERROR';
    if(book)try{book.getSheetByName('Errores técnicos').appendRow([new Date().toISOString(),/^[a-f0-9-]{36}$/.test(p && p.retryId || '')?p.retryId:'',message]);}catch(ignored){}
    return {ok:false,error:message};
  } finally {if(locked)lock.releaseLock();}
}
