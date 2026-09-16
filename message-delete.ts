#!/usr/bin/env bun
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {readStdinBounded} from './contact-review';

export function deletionTarget(value: any) {
  const {id, guid, chat} = value ?? {};
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id)>9223372036854775807n ||
      typeof guid !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(guid) ||
      typeof chat !== 'string' || !chat || chat.length>320 || /[\x00-\x1f\x7f]/.test(chat))
    throw new Error('This message cannot be deleted. Reload the conversation and try again.');
  return {id,guid,chat};
}
export function deleteMessage(value: any, runner=spawnSync) {
  const target=deletionTarget(value);
  if (value.confirmed!==true) throw new Error('Confirm the message before deleting it.');
  const unknown={ok:false,uncertain:true,error:'Deletion could not be verified. Check Messages on the Mac before trying again.'};
  const result=runner(join(process.env.HOME ?? homedir(),'bin','imsg-delete'),[],{
    input:JSON.stringify({...target,confirmed:true}),encoding:'utf8',timeout:90000,maxBuffer:8192,
  });
  if (result.error && 'code' in result.error && ['ENOENT','EACCES'].includes(String(result.error.code)))
    return {ok:false,uncertain:false,error:'The local bridge helper could not start. Run scripts/blip-setup to repair the Linux shims and update the Mac bridge.'};
  if (result.error) return unknown;
  // The Mac helper returns 0 or 1 with JSON. These empty startup failures
  // come from dispatch refusing the command or the interpreter not finding it.
  if (!String(result.stdout || '').trim() && [2,64,127].includes(result.status ?? -1))
    return {ok:false,uncertain:false,error:'The Mac bridge helper could not start. Run scripts/blip-setup to update the bridge.'};
  if (result.status === 69 && !String(result.stdout || '').trim())
    return {ok:false,uncertain:false,error:'The Mac bridge is offline. Reconnect it and try again.'};
  let body:any;
  try {body=JSON.parse(String(result.stdout));} catch {return unknown;}
  if (result.status===0 && body?.ok===true && body.deleted===true &&
      Object.keys(target).every(k=>body[k]===target[k as keyof typeof target])) return {ok:true};
  const known={permission:'Enable Accessibility for the SSH bridge on the Mac. See the Mac setup guide.',
    selection:'Keep English Messages open and the Mac unlocked, then reopen this dialog. Unsupported layouts cannot be selected safely.',
    busy:'Finish the open Messages dialog or bridge operation on the Mac first.',
    unavailable:'The deletion helper is unavailable. Update the Mac bridge and keep Messages open.',
    unsupported:'This message or macOS Messages version does not support deletion through the bridge.',
    'not-found':'This message is no longer in this conversation. Reload to see the current messages.',
    invalid:'The Mac rejected this message identity. Reload the conversation.'};
  if (body?.ok===false && Object.hasOwn(known,body.code))
    return {ok:false,uncertain:false,error:known[body.code as keyof typeof known]};
  return unknown;
}
if (import.meta.main) {
  const timer=setTimeout(()=>{process.stdout.write('{"ok":false,"error":"Request timed out"}\n');process.exit(1);},5000);
  try {
    const value=JSON.parse(await readStdinBounded(process.stdin as any,8192));
    clearTimeout(timer);
    process.stdout.write(JSON.stringify(deleteMessage(value))+'\n');
  } catch (error) {
    clearTimeout(timer);
    process.stdout.write(JSON.stringify({ok:false,error:error instanceof Error ? error.message : 'Deletion failed'})+'\n');
    process.exitCode=1;
  }
}
