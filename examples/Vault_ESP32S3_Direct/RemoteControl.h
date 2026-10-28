#pragma once
#include "HeistGate.h"
namespace vault {
// Used by the actual receiver and its compile-time checks.
constexpr const char* rejectRemote(const char* scope,const char* session,long reference,uint32_t statusSequence,const HeistGate& gate,uint32_t now,bool heistActive){
  return reference<=0||uint32_t(reference)>statusSequence||statusSequence-uint32_t(reference)>5?"stale_status":
    !*session||length(session)>64?"invalid_request":
    same(scope,"test")?(gate.fresh(now)&&(heistActive||gate.conflict())?"active_heist":""):
    same(scope,"presenter")?(!gate.fresh(now)||gate.conflict()||!same(session,gate.owner())?"owner_mismatch":""):
    "invalid_scope";
}
}
