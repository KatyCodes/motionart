const [major, minor] = process.versions.node.split('.').map(Number);
const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24;

if (!supported) {
  console.error(
    `Album Motion requires Node.js 20.19+, 22.12+, or 24+. Current version: ${process.version}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Node.js ${process.version}: supported`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log('Album Motion development environment: ready');
}
