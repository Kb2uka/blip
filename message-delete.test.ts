import {expect, test} from "bun:test";
import {decorate} from "./thread";
import type {ImsgMessage} from "./collector";
import {deletionTarget, deleteMessage} from './message-delete';

const message: ImsgMessage = {
  id: "9223372036854775807", guid: "11111111-2222-4333-8444-555555555555",
  chat: "chat123456789", handle: "+15551234567", name: "Example Person",
  ts: "2026-09-13 12:00:00", service: "iMessage", from_me: false, text: "Synthetic message",
};

test("bubble actions preserve the exact message and original chat identity", () => {
  const bubble = decorate([message], "2026-09-13")[0] as any;
  expect(bubble.messageId).toBe(message.id);
  expect(bubble.messageGuid).toBe(message.guid);
  expect(bubble.messageChat).toBe(message.chat);
});

const request={id:'1',guid:'11111111-2222-4333-8444-555555555555',chat:'chat12345',confirmed:true};
test('deletion requires confirmation and exact bounded identity before spawning',()=>{
  let calls=0;
  const runner=((..._:any[])=>{calls++;return {};}) as any;
  for (const delta of [{confirmed:false},{id:1},{id:'9223372036854775808'},{chat:'x\n'},{guid:'bad'}])
    expect(()=>deleteMessage({...request,...delta},runner)).toThrow();
  expect(calls).toBe(0);
  expect(deletionTarget(request)).toEqual({id:request.id,guid:request.guid,chat:request.chat});
});
test('deletion sends only confirmed identity on stdin and verifies every returned field',()=>{
  const response={ok:true,deleted:true,...request};
  const runner=((path:any,args:any,options:any)=>{
    expect(path.endsWith('/bin/imsg-delete')).toBe(true);expect(args).toEqual([]);
    expect(JSON.parse(options.input)).toEqual(request);
    expect(options.timeout).toBe(90000);expect(options.maxBuffer).toBe(8192);
    return {status:0,stdout:JSON.stringify(response)};
  }) as any;
  expect(deleteMessage({...request,text:'Do not transport this body'},runner)).toEqual({ok:true});
  for(const change of [{id:'2'},{guid:'22222222-2222-4333-8444-555555555555'},{chat:'other'},{deleted:false}])
    expect(deleteMessage(request,(()=>({status:0,stdout:JSON.stringify({...response,...change})})) as any).uncertain).toBe(true);
});
test('failed or lost deletion responses are never reported as success',()=>{
  for(const result of [{status:1,stdout:''},{status:0,stdout:'{}'},{error:new Error('timeout')},
    {status:1,stdout:JSON.stringify({ok:false,code:'unverified'})}])
    expect(deleteMessage(request,(()=>result) as any).uncertain).toBe(true);
  expect(deleteMessage(request,(()=>({status:1,stdout:JSON.stringify({ok:false,code:'permission'})})) as any))
    .toMatchObject({ok:false,uncertain:false});
});

test("missing or imprecise identities cannot become deletion targets", () => {
  for (const id of [undefined, 0, -1, Number.MAX_SAFE_INTEGER + 1, "1;delete", "0"]) {
    const bubble = decorate([{...message, id}], "2026-09-13")[0] as any;
    expect(bubble.messageId).toBe("");
  }
  const bubble = decorate([{...message, guid: undefined}], "2026-09-13")[0] as any;
  expect(bubble.messageGuid).toBe("");
});

test('closed, locked, and unsupported Messages explain the refusal',()=>{
  for (const [code, guidance] of [['unavailable','keep Messages open'], ['selection','English'], ['unsupported','does not support']]) {
    const result=deleteMessage(request,(()=>({status:1,stdout:JSON.stringify({ok:false,code})})) as any);
    expect(result).toMatchObject({ok:false,uncertain:false});
    expect(result.error).toContain(guidance);
  }
});

test('a missing helper or offline bridge is a definite refusal',()=>{
  for (const result of [{error:Object.assign(new Error('missing'),{code:'ENOENT'})},{status:69,stdout:''}]) {
    const answer=deleteMessage(request,(()=>result) as any);
    expect(answer).toMatchObject({ok:false,uncertain:false});
    expect(answer.error).not.toContain('could not be verified');
  }
});
test('closing deletion preserves a peek without committing a read',()=>{
  const source=require('node:fs').readFileSync(new URL('./BlipView.qml',import.meta.url),'utf8');
  const body=source.match(/function closeDelete\(\) \{([\s\S]*?)\n  \}/)[1];
  for (const peeking of [true,false]) {
    let navigation=0,composer=0;
    const root={peeking,deletingMessage:{},active:null,hostWidget:null,
      focusDefault:()=>composer++,navigationFocusRequested:()=>navigation++};
    new Function('root','deleteLoader','with(root){'+body+'}')(root,{item:{attempted:false}});
    expect(root.deletingMessage).toBeNull();
    expect(navigation).toBe(peeking?1:0);expect(composer).toBe(peeking?0:1);
  }
});

test('helper startup failures give setup guidance without claiming a possible mutation',()=>{
  for(const result of [{error:Object.assign(new Error('denied'),{code:'EACCES'})},
    ...[2,64,127].map(status=>({status,stdout:''}))]) {
    const answer=deleteMessage(request,(()=>result) as any);
    expect(answer).toMatchObject({ok:false,uncertain:false});
    expect(answer.error).toContain('blip-setup');
  }
  for(const result of [{status:255,stdout:''},{status:1,stdout:''},
    {status:2,stdout:JSON.stringify({ok:false,code:'unknown'})},
    {error:Object.assign(new Error('timeout'),{code:'ETIMEDOUT'}),status:69,stdout:''}])
    expect(deleteMessage(request,(()=>result) as any)).toMatchObject({ok:false,uncertain:true});
});
test('a structured remote refusal takes priority over a transport status',()=>{
  const result=deleteMessage(request,(()=>({status:69,stdout:JSON.stringify({ok:false,code:'permission'})})) as any);
  expect(result).toMatchObject({ok:false,uncertain:false});
  expect(result.error).toContain('Accessibility');
});

test('message menu switches from link actions to an immutable deletion target',()=>{
  const source=require('node:fs').readFileSync(new URL('./BlipView.qml',import.meta.url),'utf8');
  const body=source.match(/function openMessageMenu\([^)]*\) \{([\s\S]*?)\n  \}/)[1];
  let opened=0;
  const menu={linkUrl:'',popup:()=>opened++};
  const loader={active:false};
  const root={messageContext:null as any};
  const open=new Function('root','deleteLoader','messageMenu','message','url','with(root){'+body+'}');
  const target={messageId:'1',messageGuid:request.guid,messageChat:request.chat,text:'Synthetic message'};
  open(root,loader,menu,target,'https://example.com');
  expect(menu.linkUrl).toBe('https://example.com');
  open(root,loader,menu,target,undefined);
  expect(menu.linkUrl).toBe('');
  expect(root.messageContext).toEqual(target);
  expect(root.messageContext).not.toBe(target);
  target.messageId='2';
  expect(root.messageContext.messageId).toBe('1');
  loader.active=true;
  open(root,loader,menu,target,'https://example.com/other');
  expect(opened).toBe(2);
  expect(menu.linkUrl).toBe('');
  expect(root.messageContext.messageId).toBe('1');
});
