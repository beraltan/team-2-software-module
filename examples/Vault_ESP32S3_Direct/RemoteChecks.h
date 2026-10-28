#pragma once
#include "PolicyChecks.h"
#include "RemoteControl.h"
namespace vault_remote_checks {
constexpr bool tests(){
  vault::HeistGate g;
  if(!vault::same(vault::rejectRemote("test","tester",10,10,g,0,false),""))return false;
  if(!vault::same(vault::rejectRemote("presenter","owner",10,10,g,0,false),"owner_mismatch"))return false;
  g.ingest(vault_checks::beat(1,"armed","navigation"),0);
  g.ingest(vault_checks::beat(2,"armed","navigation"),200);
  if(!vault::same(vault::rejectRemote("test","tester",10,10,g,200,true),"active_heist"))return false;
  if(!vault::same(vault::rejectRemote("presenter","owner",10,10,g,200,true),""))return false;
  if(!vault::same(vault::rejectRemote("presenter","other",10,10,g,200,true),"owner_mismatch"))return false;
  g.ingest(vault_checks::beat(3,"idle","navigation"),400);
  if(!vault::same(vault::rejectRemote("test","tester",10,10,g,400,false),""))return false;
  g.ingest(vault_checks::beat(1,"idle","navigation","other"),450);
  return vault::same(vault::rejectRemote("test","tester",10,10,g,450,false),"active_heist")&&
    vault::same(vault::rejectRemote("presenter","owner",10,10,g,450,false),"owner_mismatch")&&
    vault::same(vault::rejectRemote("test","tester",10,10,g,4000,true),"");
}
constexpr vault::HeistGate empty;
static_assert(tests(),"Explicit tests must yield to a fresh live heist or competing controller");
static_assert(vault::same(vault::rejectRemote("test","tester",0,10,empty,0,false),"stale_status"),"No reference means no remote movement");
static_assert(vault::same(vault::rejectRemote("test","tester",11,10,empty,0,false),"stale_status"),"Future references are rejected");
static_assert(vault::same(vault::rejectRemote("test","tester",4,10,empty,0,false),"stale_status"),"Old references are rejected");
static_assert(vault::same(vault::rejectRemote("test","",10,10,empty,0,false),"invalid_request"),"A requester is required");
static_assert(vault::same(vault::rejectRemote("other","tester",10,10,empty,0,false),"invalid_scope"),"Unknown scopes are rejected");
}
