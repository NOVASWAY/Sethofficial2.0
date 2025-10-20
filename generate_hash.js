const crypto = require('crypto');

// Simple hash generation for testing
// In production, you would use proper Argon2 hashing
function generateSimpleHash(password) {
    return crypto.createHash('sha256').update(password + 'salt').digest('hex');
}

// Generate hashes for all users
const users = [
    { username: 'admin', password: 'admin123' },
    { username: 'receptionist', password: 'receptionist123' },
    { username: 'nurse', password: 'nurse123' },
    { username: 'clinician', password: 'clinician123' }
];

console.log('Generated password hashes:');
users.forEach(user => {
    const hash = generateSimpleHash(user.password);
    console.log(`${user.username}: ${hash}`);
});

// Also generate a proper Argon2-like hash for testing
const argon2LikeHash = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$' + Buffer.from(generateSimpleHash('admin123')).toString('base64');
console.log('\nArgon2-like hash for admin:');
console.log(argon2LikeHash);
