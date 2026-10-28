#pragma once
#include "HeistGate.h"
namespace vault_checks {
constexpr vault::Beat beat(long seq,const char* state="running",const char* phase="escape",const char* owner="owner",const char* round="round-1",bool morse=true){return {owner,round,state,phase,seq,true,true,true,morse};}
constexpr bool confirmation(){vault::HeistGate g;g.ingest(beat(1),0);if(g.canSend(0))return false;g.ingest(beat(2),200);return g.canSend(200)&&g.command()==vault::Command::Unlock;}
constexpr bool replay(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);return !g.ingest(beat(1,"armed","navigation"),500)&&g.command()==vault::Command::Unlock&&!g.canSend(3200);}
constexpr bool conflict(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);g.ingest(beat(1,"running","escape","extra"),250);if(g.canSend(250)||!g.conflict())return false;g.ingest(beat(3),1000);g.ingest(beat(4),2000);g.ingest(beat(5),3300);return g.canSend(3300)&&!g.conflict();}
constexpr bool expiry(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);if(g.canSend(3200))return false;g.ingest(beat(3),3300);if(g.canSend(3300))return false;g.ingest(beat(4),3500);return g.canSend(3500);}
constexpr bool fault(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);g.ingest(beat(3,"fault"),400);return !g.canSend(400)&&g.command()==vault::Command::None;}
constexpr bool nextRound(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);g.ingest(beat(3,"armed","navigation","owner","round-2"),400);return g.canSend(400)&&g.command()==vault::Command::Lock&&vault::same(g.round(),"round-2");}
constexpr bool takeover(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);g.ingest(beat(1,"armed","navigation","new-owner","round-2"),3300);if(g.canSend(3300))return false;g.ingest(beat(2,"armed","navigation","new-owner","round-2"),3500);return g.canSend(3500)&&g.command()==vault::Command::Lock;}
constexpr bool wrap(){vault::HeistGate g;g.ingest(beat(1),UINT32_MAX-400);g.ingest(beat(2),UINT32_MAX-200);return g.canSend(100)&&!g.canSend(3000);}
constexpr bool noRelock(){vault::HeistGate g;g.ingest(beat(1),0);g.ingest(beat(2),200);g.noteSent(vault::Command::Unlock);g.ingest(beat(3,"running","skidule"),400);return !g.canSend(400)&&g.command()==vault::Command::None;}
static_assert(confirmation(),"Require two fresh controller heartbeats");
static_assert(replay(),"Old sequences must not change the latch or renew a lease");
static_assert(conflict(),"Competing controllers must suspend commands until quiet");
static_assert(expiry(),"Lease recovery needs fresh confirmation");
static_assert(fault(),"Faults must not issue relock commands");
static_assert(nextRound(),"A new armed heist relocks");
static_assert(takeover(),"An expired owner can be replaced after confirmation");
static_assert(wrap(),"millis wrap must preserve freshness");
static_assert(noRelock(),"Resetting a puzzle must not relock an opened latch in the same round");
static_assert(vault::commandFor(beat(1,"idle"))==vault::Command::None,"Practice results must not move the latch");
static_assert(vault::commandFor(beat(1,"lost"))==vault::Command::None,"Lockdown must not close an opened latch");
static_assert(vault::commandFor(beat(1,"running","escape","owner","round-1",false))==vault::Command::None,"All four modules must pass");
static_assert(vault::commandFor(beat(1,"running","escape","owner",""))==vault::Command::None,"No motion without a round");
}
