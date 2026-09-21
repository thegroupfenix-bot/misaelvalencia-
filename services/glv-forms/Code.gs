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
  if (origins_().indexOf(p.origin) < 0 || !/^[a-f0-9]{32}$/.test(p.channel || '')) return HtmlService.createHtmlOutput('GLV forms service');
  var template = HtmlService.createTemplateFromFile('Bridge');
  var issued = Date.now();
  template.config = JSON.stringify({origin:p.origin,channel:p.channel,issued:issued,signature:sign_(p.origin+'|'+p.channel+'|'+issued)}).replace(/</g,'\\u003c');
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
  return 'Confirmamos la recepción de su solicitud.\n\nNúmero GLV: '+record.code+'\nNombre o razón social: '+record.name+'\nTipo de solicitud: '+record.type+'\nFecha de registro: '+record.date+' (America/Bogota)\n\nNuestro equipo revisará la información y responderá mediante canales oficiales de GLV Services S.A.S.';
}

// The only public RPC. Returns no submitted personal data.
function submitForm(p) {
  var lock=LockService.getScriptLock(), locked=false, book;
  try {
    owner_();
    var n=normalize_(p);
    if(!lock.tryLock(25000)) return {ok:false,error:'BUSY'};
    locked=true;
    book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GLV_SHEET_ID'));
    var sheet=book.getSheetByName(n.schema.sheet), rows=sheet.getDataRange().getValues(), rowIndex=0,row;
    for(var i=1;i<rows.length;i++) if(rows[i][9]===p.retryId){rowIndex=i+1;row=rows[i];break;}
    if(row){if(row[10]!==n.hash) throw new Error('RETRY_CONFLICT');}
    else {
      // Retry identifiers cannot be reused for a different registration category.
      ['Clientes','Proveedores','Cotizaciones'].forEach(function(name){if(name===n.schema.sheet)return;var rs=book.getSheetByName(name).getDataRange().getValues();if(rs.some(function(r){return r[9]===p.retryId;}))throw new Error('RETRY_CONFLICT');});
      rateLimit_(book,n.email);
      var code=nextNumber_(sheet,n.schema.prefix);
      row=[code,p.kind,new Date().toISOString(),cell_(n.name),n.email,cell_(n.fields[n.schema.phone]),cell_(n.fields[n.schema.country]),JSON.stringify(n.fields),'PENDING',p.retryId,n.hash,p.origin+p.source,'PENDING','PENDING','PENDING'];
      sheet.appendRow(row);rowIndex=sheet.getLastRow();SpreadsheetApp.flush();
    }
    var displayDate=Utilities.formatDate(new Date(row[2]),'America/Bogota','yyyy-MM-dd HH:mm:ss');
    var type=n.schema.sheet+' / '+p.kind;
    var internal='Número GLV: '+row[0]+'\nTipo: '+type+'\nFecha: '+displayDate+' (America/Bogota)\nOrigen: '+row[11]+'\n\n'+Object.keys(n.fields).map(function(k){return k+': '+n.fields[k];}).join('\n');
    var mails=[{to:GLV_INTERNAL[0],role:'INTERNAL_ACCOUNTING',body:internal},{to:GLV_INTERNAL[1],role:'INTERNAL_GLV',body:internal},{to:n.email,role:'APPLICANT',body:confirmation_({code:row[0],name:n.name,type:type,date:displayDate})}];
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
    return {ok:true,code:row[0],registeredAt:row[2],mailStatus:'SENT'};
  } catch(err) {
    var known=['OWNER_REQUIRED','NOT_CONFIGURED','INVALID_REQUEST','INVALID_ORIGIN','SPAM_REJECTED','INVALID_FIELDS','REQUIRED_FIELDS','DECLARATIONS_REQUIRED','INVALID_EMAIL','TEST_ONLY','RATE_LIMIT','RETRY_CONFLICT','SEQUENCE_EXHAUSTED'];
    var message=known.indexOf(err.message)>=0?err.message:'SERVICE_ERROR';
    if(book)try{book.getSheetByName('Errores técnicos').appendRow([new Date().toISOString(),/^[a-f0-9-]{36}$/.test(p && p.retryId || '')?p.retryId:'',message]);}catch(ignored){}
    return {ok:false,error:message};
  } finally {if(locked)lock.releaseLock();}
}
