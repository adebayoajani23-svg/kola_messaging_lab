/**
 * KOLA Messaging Lab — Cloudflare Worker API
 * Bind a KV namespace named KOLA_DATA and add GEMINI_API_KEY as a Worker secret.
 * Optional vars: GEMINI_MODEL, ALLOWED_ORIGIN. Do not put secrets in index.html.
 */
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const cors = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  return origin === allowed ? {'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'} : {};
};
const clean = (v, max=2000) => String(v ?? '').trim().slice(0,max);
const id = (prefix) => `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
async function readBody(request){try{return await request.json()}catch{return null}}
async function callAI(env, payload){
  if(!env.GEMINI_API_KEY) throw new Error('Gemini is not configured. Add GEMINI_API_KEY as a Worker secret.');
  const prompt = `You are KOLA Messaging Lab, a responsible marketing strategist for businesses in Nigeria and worldwide. Create honest, useful advertising; never invent prices, guarantees, certifications, reviews or product claims. Do not target or infer sensitive personal traits. Return ONLY valid JSON with these keys: headline (string), primary_text (string), call_to_action (string), hashtags (array of strings), audience_suggestions (array of 4-6 concise strings using broad relevant interests, customer needs and geography only), targeting_notes (string), creative_direction (string), testing_ideas (array of 3 strings). Use the selected channel and tone. Business: ${payload.business}. Offer: ${payload.offer}. Audience: ${payload.audience || 'Recommend a relevant broad audience'}. Location: ${payload.location || 'Nigeria'}. Channel: ${payload.channel}. Tone: ${payload.tone}. Keep the advert clear and persuasive. If facts are missing, avoid making them up.`;
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint,{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify({
    systemInstruction:{parts:[{text:'You produce safe, truthful marketing content. Return valid JSON only, without Markdown fences.'}]},
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{temperature:0.7,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{headline:{type:'STRING'},primary_text:{type:'STRING'},call_to_action:{type:'STRING'},hashtags:{type:'ARRAY',items:{type:'STRING'}},audience_suggestions:{type:'ARRAY',items:{type:'STRING'}},targeting_notes:{type:'STRING'},creative_direction:{type:'STRING'},testing_ideas:{type:'ARRAY',items:{type:'STRING'}}},required:['headline','primary_text','call_to_action','hashtags','audience_suggestions','targeting_notes','creative_direction','testing_ideas']}}
  })});
  const result=await response.json();
  if(!response.ok) {
    const detail=result.error?.message || `Gemini API error (${response.status})`;
    throw new Error(detail.slice(0,500));
  }
  const raw=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
  if(!raw) throw new Error('Gemini returned an empty response. Check model availability and API quota.');
  try { return JSON.parse(raw); } catch { throw new Error('Gemini returned an invalid JSON response. Please try again.'); }
}
export default {
 async fetch(request,env){
  const headers=cors(request,env);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  const url=new URL(request.url); const path=url.pathname;
  if(path==='/api/health' && request.method==='GET') return json({ok:true,aiConfigured:!!env.GEMINI_API_KEY,storageConfigured:!!env.KOLA_DATA},200,headers);
  if(!path.startsWith('/api/')) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({error:'Not found'},404,headers);
  }
  if(request.method!=='POST') return json({error:'Method not allowed'},405,headers);
  const body=await readBody(request); if(!body) return json({error:'A valid JSON request body is required.'},400,headers);
  try{
   if(path==='/api/generate'){
    const payload={business:clean(body.business,120),offer:clean(body.offer,1800),audience:clean(body.audience,300),location:clean(body.location,160),channel:clean(body.channel,40),tone:clean(body.tone,60)};
    if(!payload.business||!payload.offer) return json({error:'Business and offer are required.'},400,headers);
    if(payload.offer.length<8) return json({error:'Please describe the offer in a little more detail.'},400,headers);
    const ad=await callAI(env,payload); return json(ad,200,headers);
   }
   if(path==='/api/feedback'){
    const feedback={id:id('FB'),customer:clean(body.customer,100),rating:Number(body.rating),feedback:clean(body.feedback,2000),source:clean(body.source,80),created_at:new Date().toISOString()};
    if(!body.consent || !Number.isInteger(feedback.rating)||feedback.rating<1||feedback.rating>5||feedback.feedback.length<3) return json({error:'Valid feedback, rating and consent are required.'},400,headers);
    if(!env.KOLA_DATA) return json({error:'Feedback storage is not configured. Bind a KV namespace as KOLA_DATA.'},503,headers);
    await env.KOLA_DATA.put(`feedback:${feedback.id}`,JSON.stringify(feedback)); return json({ok:true,id:feedback.id},201,headers);
   }
   if(path==='/api/campaigns'){
    const c=body.campaign||{}; const campaign={id:id('CMP'),business:clean(c.business,120),offer:clean(c.offer,1800),audience:clean(c.audience,300),location:clean(c.location,160),channel:clean(c.channel,40),tone:clean(c.tone,60),headline:clean(c.headline,240),primary_text:clean(c.primary_text,2000),call_to_action:clean(c.call_to_action,200),hashtags:Array.isArray(c.hashtags)?c.hashtags.slice(0,15).map(x=>clean(x,40)):[],created_at:new Date().toISOString(),status:'draft'};
    if(!campaign.business||!campaign.primary_text) return json({error:'A generated campaign draft is required.'},400,headers);
    if(!env.KOLA_DATA) return json({error:'Campaign storage is not configured. Bind a KV namespace as KOLA_DATA.'},503,headers);
    await env.KOLA_DATA.put(`campaign:${campaign.id}`,JSON.stringify(campaign)); return json({ok:true,id:campaign.id,status:'draft'},201,headers);
   }
   return json({error:'Unknown API route.'},404,headers);
  }catch(error){return json({error:error.message||'Unexpected server error.'},500,headers)}
 }
};
