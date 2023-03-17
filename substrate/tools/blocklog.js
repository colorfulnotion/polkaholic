let flds = {"numActiveAccountsEvm" : false, "numPassivAccountsEVM" : false};
console.log("alter table blocklogstats");
for (const f of Object.keys(flds)) {
 if ( flds[f] ) {
   console.log(` add column ${f}_min float,`)
   console.log(` add column ${f}_max float,`);
 } else {
   console.log(` add column ${f}_min int,`)
   console.log(` add column ${f}_max int,`);
 }
 console.log(` add column ${f}_sum float,`);
 console.log(` add column ${f}_avg float,`);
 console.log(` add column ${f}_std float,`);
}
console.log(";");
