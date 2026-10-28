#pragma once
#include <stdint.h>
#include <stddef.h>

namespace vault {
enum class Command { None, Lock, Unlock };
constexpr bool same(const char* a,const char* b){return *a==*b&&(*a=='\0'||same(a+1,b+1));}
constexpr size_t length(const char* s){return *s?1+length(s+1):0;}
struct Beat {
  const char* session;const char* round;const char* state;const char* phase;
  long sequence;bool navigation;bool laser;bool skidule;bool morse;
};
constexpr Command commandFor(const Beat& b){
  return !*b.round?Command::None:
    (same(b.state,"running")||same(b.state,"won"))&&same(b.phase,"escape")&&b.navigation&&b.laser&&b.skidule&&b.morse?Command::Unlock:
    same(b.state,"armed")||(same(b.state,"running")&&!same(b.phase,"escape"))?Command::Lock:Command::None;
}

// A lease follows the existing live controller, never an individual puzzle result.
// Losing the lease stops commands; it never sends a surprise close command.
class HeistGate {
 public:
  static constexpr uint32_t LEASE_MS=3000;
  constexpr HeistGate():owner_{},round_{},openedRound_{},lastAt_(0),conflictAt_(0),lastSequence_(-1),confirmations_(0),conflict_(false),proposed_(Command::None){}
  constexpr bool ingest(const Beat& b,uint32_t now){
    if(!*b.session||length(b.session)>64||length(b.round)>64||b.sequence<=0||
       !(same(b.state,"idle")||same(b.state,"armed")||same(b.state,"running")||same(b.state,"won")||same(b.state,"lost")||same(b.state,"fault"))||
       !(same(b.phase,"navigation")||same(b.phase,"laser")||same(b.phase,"skidule")||same(b.phase,"morse")||same(b.phase,"escape")))return false;
    const bool fresh=*owner_&&uint32_t(now-lastAt_)<LEASE_MS;
    if(*owner_&&!same(b.session,owner_)&&fresh){conflict_=true;conflictAt_=now;return false;}
    if(!*owner_||!same(b.session,owner_)){
      copy(owner_,b.session);lastSequence_=-1;confirmations_=0;
    }
    if(b.sequence<=lastSequence_)return false; // Replays do not renew the lease.
    if(!fresh)confirmations_=0;
    lastSequence_=b.sequence;lastAt_=now;
    if(confirmations_<2)++confirmations_;
    copy(round_,b.round);proposed_=commandFor(b);
    if(proposed_==Command::Lock&&same(round_,openedRound_))proposed_=Command::None;
    if(conflict_&&uint32_t(now-conflictAt_)>=LEASE_MS)conflict_=false;
    return true;
  }
  constexpr bool fresh(uint32_t now)const{return *owner_&&uint32_t(now-lastAt_)<LEASE_MS;}
  constexpr bool canSend(uint32_t now)const{return fresh(now)&&confirmations_>=2&&!conflict_&&proposed_!=Command::None;}
  constexpr bool conflict()const{return conflict_;}
  constexpr Command command()const{return proposed_;}
  constexpr void noteSent(Command command){if(command==Command::Unlock)copy(openedRound_,round_);}
  constexpr const char* owner()const{return owner_;}
  constexpr const char* round()const{return round_;}
 private:
  static constexpr void copy(char* out,const char* in){size_t i=0;for(;in[i]&&i<64;++i)out[i]=in[i];out[i]='\0';}
  char owner_[65],round_[65],openedRound_[65];uint32_t lastAt_,conflictAt_;long lastSequence_;uint8_t confirmations_;bool conflict_;Command proposed_;
};
}
