const fs=require("fs");
const vm=require("vm");
const source=fs.readFileSync("calculators.js","utf8");
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const c=sandbox.window.CALCULATORS||[];
const errors=[];
const ids=new Set(),slugs=new Set(),types=new Set();
for(const x of c){
 if(!x.id||ids.has(x.id)) errors.push("Duplicate/missing id: "+x.id);
 if(!x.slug||slugs.has(x.slug)) errors.push("Duplicate/missing slug: "+x.slug);
 if(!x.type) errors.push("Missing type: "+x.id);
 if(!x.cat) errors.push("Missing category: "+x.id);
 for(const l of ["pt","en","es"]) if(!x.title?.[l]||!x.desc?.[l]) errors.push("Missing "+l+" metadata: "+x.id);
 ids.add(x.id);slugs.add(x.slug);types.add(x.type);
}
const calcSource=fs.readFileSync("calculator.js","utf8");
const required=[...types].filter(t=>!calcSource.includes(t+":"));
for(const t of required) errors.push("Catalog type not implemented in calculator.js: "+t);
if(c.length<100) errors.push("Expected at least 100 calculators, found "+c.length);
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("CalcWorld validation OK: "+c.length+" calculators, "+types.size+" calculator types, 3 locales.");
