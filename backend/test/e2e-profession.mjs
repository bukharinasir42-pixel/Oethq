import { execFileSync } from "node:child_process";
const API = "http://127.0.0.1:4000";
const RUN = String(Date.now()).slice(-6);
const PSQL = ["-h","/tmp","-p","5433","-U","postgres","-d","oethq","-tA","-c"];
const sql = q => execFileSync("psql",[...PSQL,q],{encoding:"utf8"}).trim();
let P=0,F=0; const ck=(n,c,d="")=>{c?(P++,console.log("  ok   "+n)):(F++,console.log("  FAIL "+n+(d?" — "+d:"")))};
async function api(path,{method="GET",body,token}={}){const h={"content-type":"application/json","x-device-id":"prof-"+RUN,"x-device-fp":"fpprof-"+RUN};if(token)h.authorization="Bearer "+token;
 const r=await fetch(API+path,{method,headers:h,body:body?JSON.stringify(body):undefined});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}return{status:r.status,body:j,raw:t}}

const admin=(await api("/auth/login",{method:"POST",body:{email:"admin@oet.test",password:"Admin@123"}})).body.accessToken;

// An admin-created candidate WITHOUT a profession — the exact case reported.
const email=`profless-${RUN}@stress.test`;
const created=await api("/users/custom",{method:"POST",token:admin,body:{name:"Profless",email,productSlugs:["reading-mega"],temporaryPassword:"Stress@1234"}});
ck("admin can create a candidate",created.status===200||created.status===201,`status ${created.status} ${created.raw.slice(0,120)}`);
ck("that candidate has NO profession",sql(`select coalesce(profession,'<null>') from "User" where email='${email}'`)==="<null>");

const li=await api("/auth/login",{method:"POST",body:{email,password:"Stress@1234"}});
const tok=li.body?.accessToken;
ck("they can sign in",Boolean(tok),`status ${li.status}`);

const me1=await api("/auth/me",{token:tok});
ck("/auth/me exposes profession",Object.prototype.hasOwnProperty.call(me1.body??{},"profession"),JSON.stringify(Object.keys(me1.body??{})));
ck("profession reads null before they pick",me1.body?.profession===null||me1.body?.profession===undefined,String(me1.body?.profession));

const list=await api("/auth/professions");
ck("the picker list is served",Array.isArray(list.body?.professions)&&list.body.professions.includes("Nursing"),`n=${list.body?.professions?.length}`);

const bad=await api("/auth/me/profession",{method:"PATCH",token:tok,body:{profession:"nurse"}});
ck("a typo is refused, not stored",bad.status>=400,`status ${bad.status}`);
ck("still null after the bad attempt",sql(`select coalesce(profession,'<null>') from "User" where email='${email}'`)==="<null>");

const set=await api("/auth/me/profession",{method:"PATCH",token:tok,body:{profession:"Nursing"}});
ck("student sets their own profession",set.status===200,`status ${set.status} ${set.raw.slice(0,120)}`);
ck("it is persisted",sql(`select profession from "User" where email='${email}'`)==="Nursing");
ck("/auth/me now returns it",(await api("/auth/me",{token:tok})).body?.profession==="Nursing");

const chg=await api("/auth/me/profession",{method:"PATCH",token:tok,body:{profession:"Midwifery"}});
ck("they can change it later",chg.status===200&&sql(`select profession from "User" where email='${email}'`)==="Midwifery");

const anon=await api("/auth/me/profession",{method:"PATCH",body:{profession:"Nursing"}});
ck("a signed-out caller cannot set one",anon.status===401,`status ${anon.status}`);

// Admin creating one WITH a profession — the root-cause fix.
const email2=`withprof-${RUN}@stress.test`;
await api("/users/custom",{method:"POST",token:admin,body:{name:"WithProf",email,profession:"Pharmacy",productSlugs:["reading-mega"],temporaryPassword:"Stress@1234"}});
const c2=await api("/users/custom",{method:"POST",token:admin,body:{name:"WithProf",email:email2,profession:"Pharmacy",productSlugs:["reading-mega"],temporaryPassword:"Stress@1234"}});
ck("admin can set profession at creation",sql(`select coalesce(profession,'<null>') from "User" where email='${email2}'`)==="Pharmacy",`status ${c2.status}`);

console.log(`\nPASS ${P}  FAIL ${F}`);
