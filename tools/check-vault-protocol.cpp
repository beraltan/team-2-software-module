// Compile-time tests against the actual firmware headers, not a second model.
// avr-g++ -std=c++17 -fsyntax-only tools/check-vault-protocol.cpp
#include "../examples/Vault_ESP32S3_Bridge/PolicyChecks.h"
#include "../examples/Vault_Arduino_Uno/CommandLine.h"
constexpr bool framed(){CommandLine p;const char* s="VAULT1,UNLOCK\r\n";const char* line=nullptr;for(unsigned i=0;s[i];i++){line=p.feed(s[i],i);if(s[i]!='\n'&&line)return false;}return decodeWire(line)==WireCommand::Unlock;}
constexpr bool partial(){CommandLine p;const char* s="VAULT1,UNLOCK";for(unsigned i=0;s[i];i++)if(p.feed(s[i],i))return false;return true;}
constexpr bool overflow(){CommandLine p;for(unsigned i=0;i<40;i++)p.feed('x',i);const char* s="VAULT1,UNLOCK\n";for(unsigned i=0;s[i];i++)if(p.feed(s[i],40+i))return false;return decodeWire(p.feed('\n',80))==WireCommand::None;}
constexpr bool recovery(){CommandLine p;for(unsigned i=0;i<40;i++)p.feed('x',i);p.feed('\n',50);const char* s="VAULT1,LOCK\n";const char* line=nullptr;for(unsigned i=0;s[i];i++)line=p.feed(s[i],60+i);return decodeWire(line)==WireCommand::Lock;}
constexpr bool timeout(){CommandLine p;const char* s="VAULT1,";for(unsigned i=0;s[i];i++)p.feed(s[i],i);p.expire(1000);s="UNLOCK\n";const char* line=nullptr;for(unsigned i=0;s[i];i++)line=p.feed(s[i],1001+i);return decodeWire(line)==WireCommand::None;}
constexpr bool binary(){CommandLine p;const char* s="VAULT1,";for(unsigned i=0;s[i];i++)p.feed(s[i],i);p.feed('\1',8);s="UNLOCK\n";for(unsigned i=0;s[i];i++)if(p.feed(s[i],9+i))return false;return true;}
static_assert(framed(),"Only complete CRLF/LF commands execute");
static_assert(partial(),"Partial commands don't execute");
static_assert(overflow(),"Overlong lines cannot smuggle commands");
static_assert(recovery(),"Next valid line works after overflow");
static_assert(timeout(),"Partial commands expire");
static_assert(binary(),"Binary noise invalidates a whole line");
static_assert(decodeWire("UNLOCK")==WireCommand::None,"Unframed bridge commands are rejected");
static_assert(decodeWire("VAULT1,UNLOCK EXTRA")==WireCommand::None,"Trailing garbage is rejected");
