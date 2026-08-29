// Test the regex pattern used in git.ts
const pattern = /^diff --git a\/(.+) b\/(.+)$/;

// Test cases
const testCases = [
  // Normal case
  'diff --git a/src/file.ts b/src/file.ts',
  // File with spaces
  'diff --git a/src/file with spaces.ts b/src/file with spaces.ts',
  // Quoted file with spaces (how git actually outputs it)
  'diff --git "a/src/file with spaces.ts" "b/src/file with spaces.ts"',
  // File with special characters
  'diff --git a/src/file[1].ts b/src/file[1].ts',
];

testCases.forEach(test => {
  const match = test.match(pattern);
  console.log(`Input: ${test}`);
  console.log(`Match: ${match ? 'YES' : 'NO'}`);
  if (match) {
    console.log(`  Path (a/): ${match[1]}`);
    console.log(`  Path (b/): ${match[2]}`);
  }
  console.log('');
});
