// build-package.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const CLIENT_DIR = "client";
const SERVER_DIR = "server";
const BUILD_DIR = path.join(CLIENT_DIR, "dist"); // adjust to "build" if using CRA
const PUBLIC_DIR = path.join(SERVER_DIR, "public");
const ZIP_NAME = "app.zip";

// Step 1: Build the client
console.log("🔧 Building React frontend...");
execSync("npm install", { cwd: CLIENT_DIR, stdio: "inherit" });
execSync("npm run build", { cwd: CLIENT_DIR, stdio: "inherit" });

// Step 2: Copy build to server/public
console.log("📂 Copying client build to server/public...");
fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.cpSync(BUILD_DIR, PUBLIC_DIR, { recursive: true });

// Step 3: Create start.js if needed
const startPath = path.join(__dirname, "start.js");
const serverMain = path.join(__dirname, SERVER_DIR, "server.js");

if (!fs.existsSync(startPath)) {
  if (!fs.existsSync(serverMain)) {
    console.error("❌ Missing server/server.js. Please create your main server file.");
    process.exit(1);
  }
  fs.writeFileSync(startPath, `require('./server/server.js');\n`);
  console.log("🚀 Created start.js wrapper.");
}

// Step 4: Zip the project
console.log("📦 Creating deployment package app.zip...");

const zipOutput = fs.createWriteStream(ZIP_NAME);
const archive = archiver("zip", { zlib: { level: 9 } });

zipOutput.on("close", () => {
  console.log(`✅ Zip created: ${ZIP_NAME} (${archive.pointer()} bytes)`);
});
archive.on("error", err => {
  throw err;
});

archive.pipe(zipOutput);

// Include everything *except* dev-related folders/files
const excludes = [
  ".git", "client", "node_modules", ".vscode", "app.zip",
  "*.log", "*.md", "*.ts", "*.tsx"
];

function shouldExclude(filePath) {
  return excludes.some(pattern =>
    new RegExp(pattern.replace(".", "\\.").replace("*", ".*")).test(filePath)
  );
}

function addDirToArchive(basePath) {
  fs.readdirSync(basePath).forEach(name => {
    const fullPath = path.join(basePath, name);
    const relPath = path.relative(path.join(__dirname, SERVER_DIR), fullPath);

    if (shouldExclude(relPath)) return;

    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      archive.file(fullPath, { name: relPath });
    } else if (stat.isDirectory()) {
      addDirToArchive(fullPath);
    }
  });
}

addDirToArchive(path.join(__dirname, SERVER_DIR));

archive.finalize();
