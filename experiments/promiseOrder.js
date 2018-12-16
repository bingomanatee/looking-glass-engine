

console.log('before resolved promise');
Promise.resolve(() => { console.log('resolved promise'); }).then(f => f());
console.log('after promise');
