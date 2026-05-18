const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Failed to get git commit hash:', error.message);
    return 'unknown';
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Failed to get git branch:', error.message);
    return 'unknown';
  }
}

function getGitCommitDate() {
  try {
    return execSync('git log -1 --format=%cd --date=iso8601', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Failed to get git commit date:', error.message);
    return new Date().toISOString();
  }
}

const version = {
  commitHash: getGitCommitHash(),
  branch: getGitBranch(),
  commitDate: getGitCommitDate(),
  buildDate: new Date().toISOString(),
};

const versionJsonPath = path.join(__dirname, '..', 'src', 'lib', 'version.json');
const versionJsonDir = path.dirname(versionJsonPath);

if (!fs.existsSync(versionJsonDir)) {
  fs.mkdirSync(versionJsonDir, { recursive: true });
}

fs.writeFileSync(versionJsonPath, JSON.stringify(version, null, 2), 'utf8');
console.log('Generated version information:', version);
