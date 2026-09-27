const crypto=require("crypto");
const password=process.argv[2];
if(!password){console.error("Uso: node scripts/create-admin-hash.cjs "SUA_SENHA"");process.exit(1);}
const salt=crypto.randomBytes(16);
const N=16384,r=8,p=1;
const hash=crypto.scryptSync(password,salt,64,{N,r,p,maxmem:128*1024*1024});
console.log(["scrypt",N,r,p,salt.toString("base64"),hash.toString("base64")].join("$"));