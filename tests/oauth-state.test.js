import test from 'node:test';
import assert from 'node:assert/strict';
import {validOAuthCallback,consumeOAuthState} from '../lib/oauth-state.js';

test('los retornos OAuth rechazan cancelaciones, arreglos y campos incompletos',()=>{
  const good={code:'authorization-code',state:'a'.repeat(43)};
  assert.equal(validOAuthCallback(good),true);
  for(const bad of [{},{...good,error:'access_denied'},{...good,code:[]},{...good,state:['a']},{...good,state:'bad'}]) {
    assert.equal(validOAuthCallback(bad),false);
  }
});
function fixture(data) {
  let deleted=false;
  return {db:{runTransaction:async fn=>fn({get:async()=>({exists:!deleted,data:()=>data}),delete:()=>{deleted=true;}})},deleted:()=>deleted};
}
const valid=()=>({provider:'google',user_id:7,expires_at:Date.now()+60000,code_verifier:'verifier'});
test('el estado válido se consume y no puede reutilizarse',async()=>{
  const {db}=fixture(valid());
  const result=await consumeOAuthState(db,{}, {provider:'google',userId:7});
  assert.equal(result.code_verifier,'verifier');
  await assert.rejects(consumeOAuthState(db,{}, {provider:'google',userId:7}));
});
test('el estado de otra cuenta, proveedor, vencido o sin PKCE se rechaza',async()=>{
  for(const patch of [{user_id:8},{provider:'youtube'},{expires_at:0},{expires_at:undefined},{code_verifier:null}]) {
    const f=fixture({...valid(),...patch});
    await assert.rejects(consumeOAuthState(f.db,{}, {provider:'google',userId:7}));
    assert.equal(f.deleted(),false);
  }
});
