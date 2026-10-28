#pragma once
#include <stdint.h>
#include <string.h>

enum class WireCommand { None, Lock, Unlock };
constexpr bool wireEquals(const char* a,const char* b){return *a==*b&&(*a=='\0'||wireEquals(a+1,b+1));}
constexpr WireCommand decodeWire(const char* line){return !line?WireCommand::None:wireEquals(line,"VAULT1,LOCK")?WireCommand::Lock:wireEquals(line,"VAULT1,UNLOCK")?WireCommand::Unlock:WireCommand::None;}
#if __cplusplus >= 201402L
#define VAULT_LINE_CONSTEXPR constexpr
#else
#define VAULT_LINE_CONSTEXPR
#endif

// Fixed buffer: a malformed/overlong/unfinished line cannot become a command.
class CommandLine {
 public:
  constexpr CommandLine():buffer_{},used_(0),drop_(false),lastAt_(0){}
  VAULT_LINE_CONSTEXPR void expire(uint32_t now){if((used_||drop_)&&uint32_t(now-lastAt_)>250){used_=0;drop_=false;}}
  VAULT_LINE_CONSTEXPR const char* feed(char c,uint32_t now){
    expire(now);lastAt_=now;
    if(c=='\r')return nullptr;
    if(c=='\n'){if(drop_){used_=0;drop_=false;return nullptr;}buffer_[used_]='\0';used_=0;return buffer_;}
    if(drop_)return nullptr;
    if(c<32||c>126||used_>=sizeof(buffer_)-1){used_=0;drop_=true;return nullptr;}
    buffer_[used_++]=c;return nullptr;
  }
 private:
  char buffer_[32];uint8_t used_;bool drop_;uint32_t lastAt_;
};
#undef VAULT_LINE_CONSTEXPR
