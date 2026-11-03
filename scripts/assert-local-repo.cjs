const { execFileSync } = require("node:child_process");
const path = require("node:path");

// Vercel and CI check out the repo outside ~/Developer. The iCloud guard is
// only meaningful on a local Mac, so hosted builds skip it.
if (process.env.VERCEL || process.env.CI) {
  process.exit(0);
}

const LOCAL_REPO = path.resolve(
  process.env.HOME ?? "",
  "Developer",
  "credit-card-stack-optimizer"
);

const ICLOUD_ATTRS = [
  "com.apple.icloud.desktop",
  "com.apple.file-provider-domain-id",
];

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function hasIcloudAttribute(dir) {
  try {
    const listed = execFileSync("xattr", ["-l", dir], { encoding: "utf8" });
    return ICLOUD_ATTRS.some((attr) => listed.includes(attr));
  } catch {
    return false;
  }
}

function isIcloudBacked(start) {
  let dir = path.resolve(start);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (hasIcloudAttribute(dir)) return true;
    dir = path.dirname(dir);
  }
  return false;
}

const cwd = path.resolve(process.cwd());
if (!isInside(LOCAL_REPO, cwd) || isIcloudBacked(cwd)) {
  console.error(
    [
      "Refusing to run outside the local repo.",
      `Use: ${LOCAL_REPO}`,
      `Current directory: ${cwd}`,
    ].join("\n")
  );
  process.exit(1);
}
