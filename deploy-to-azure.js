// deploy-to-azure.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ZIP_FILE = "app.zip";
const APP_NAME = "FantasyReddit";
const RESOURCE_GROUP = "FantasyReddit";

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: "inherit", ...options });
  } catch (e) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

function checkFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Required file not found: ${filePath}`);
    process.exit(1);
  }
}

// Step 1: Verify preconditions
console.log("🔍 Verifying prerequisites...");

run("az --version"); // check if Azure CLI is installed
checkFileExists(ZIP_FILE);

// Step 2: Login check
try {
  execSync("az account show", { stdio: "ignore" });
} catch (err) {
  console.log("🔐 Logging in to Azure...");
  run("az login");
}

// Step 3: Deploy the zip
console.log(`🚀 Deploying ${ZIP_FILE} to Azure App Service "${APP_NAME}"...`);

run(
    `az webapp config appsettings set --resource-group ${RESOURCE_GROUP} --name ${APP_NAME} --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true`    
);

run(
    `az webapp deploy --resource-group ${RESOURCE_GROUP} --name ${APP_NAME} --src-path ${ZIP_FILE} --type zip`
);

console.log("✅ Deployment complete!");
console.log(`🌐 Visit your app: https://${APP_NAME}.azurewebsites.net`);
