#!/usr/bin/env node
import { program } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import { execSync } from "child_process";
import { rmSync } from "fs";
import axios from "axios";

/**
 * Get the Bitbucket credentials from the credentials file
 * @returns {Object} The Bitbucket credentials
 */
function getBitbucketCredentials() {
  try {
    const bitbucketCredentials = JSON.parse(
      fs.readFileSync("./bitbucket-credentials.json", "utf8")
    );
    return bitbucketCredentials;
  } catch (error) {
    console.error(`❌ Le fichier de credentials n'existe pas.
        Pour créer le fichier, veuillez créer ./bitbucket-credentials.json avec le format :
        {
          "username": "votre_username",
          "token": "votre_token"
        }`);

    throw error;
  }
}

/**
 * Update the permissions of a Bitbucket repository for a specific group
 * @param {string} repoName - The name of the repository
 * @returns {Promise<Object>} The response from the Bitbucket API
 * @throws {Error} If the credentials are invalid or the API request fails
 */
async function updateBitbucketRepoPermissions(repoName) {
  let credentials;

  // Gestion de la lecture du fichier de credentials
  try {
    credentials = getBitbucketCredentials();
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`❌ Le fichier de credentials n'existe pas.
Pour créer le fichier, veuillez créer ./bitbucket-credentials.json avec le format :
{
  "username": "votre_username",
  "token": "votre_token"
}`);
    } else if (error instanceof SyntaxError) {
      console.error(
        "❌ Le fichier bitbucket-credentials.json contient du JSON invalide"
      );
    } else {
      console.error(
        "❌ Erreur lors de la lecture du fichier de credentials:",
        error.message
      );
    }
    throw error;
  }

  // Validation du contenu du fichier
  if (!credentials.token || !credentials.username) {
    throw new Error(`❌ Format de credentials invalide.
Le fichier doit contenir les champs obligatoires :
{
  "username": "votre_username",
  "token": "votre_token"
}`);
  }

  // Validation des paramètres d'entrée
  if (!repoName) {
    throw new Error("❌ Le nom du repository est requis");
  }

  const normalizedPermission = permission.toLowerCase();
  if (!Object.keys(permissionMap).includes(normalizedPermission)) {
    throw new Error('❌ La permission doit être "read", "write" ou "admin"');
  }

  const auth = Buffer.from(
    `${credentials.username}:${credentials.token}`
  ).toString("base64");

  try {
    const response = await axios({
      method: "PUT",
      url: `https://api.bitbucket.org/2.0/repositories/lefigaro/${repoName}/permissions-config/groups/datavis-developers`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: {
        permission: "admin",
      },
    });
    console.log(
      `✅ Permissions mises à jour pour le groupe Datavis developers sur le repository ${repoName}`
    );
    return response.status;
  } catch (error) {
    console.log(error.response.data);
    console.error(
      "❌ Erreur lors de la mise à jour des permissions:",
      error.response?.data?.error?.message || error.message
    );
    throw error;
  }
}

/**
 * Create a Bitbucket repository
 * @param {*} repoName
 * @returns
 */
async function createBitbucketRepo(repoName) {
  let credentials;

  // Gestion de la lecture du fichier de credentials
  try {
    credentials = getBitbucketCredentials();
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`❌ Le fichier de credentials n'existe pas.
Pour créer le fichier, veuillez créer ./bitbucket-credentials.json avec le format :
{
  "username": "votre_username",
  "token": "votre_token"
}`);
    } else if (error instanceof SyntaxError) {
      console.error(
        "❌ Le fichier bitbucket-credentials.json contient du JSON invalide"
      );
    } else {
      console.error(
        "❌ Erreur lors de la lecture du fichier de credentials:",
        error.message
      );
    }
    throw error;
  }

  // Validation du contenu du fichier
  if (!credentials.token || !credentials.username) {
    throw new Error(`❌ Format de credentials invalide.
Le fichier doit contenir les champs obligatoires :
{
  "username": "votre_username",
  "token": "votre_token"
}`);
  }

  const auth = Buffer.from(
    `${credentials.username}:${credentials.token}`
  ).toString("base64");
  try {
    const response = await axios({
      method: "POST",
      url: `https://api.bitbucket.org/2.0/repositories/lefigaro/${repoName}`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      data: {
        scm: "git",
        is_private: true,
        project: {
          key: "DAT",
        },
      },
    });
    return response.data.links.html.href;
  } catch (error) {
    console.error(
      "❌ Erreur lors de la création du repo Bitbucket:",
      error.response?.data?.error?.message || error.message
    );
    throw error;
  }
}

program
  .name("create-figdata")
  .description("Initialise un projet figdata à partir d’un repo template")
  .option("-d, --dir <dir>", "Nom du dossier cible", "figdata");

program.parse();
const options = program.opts();

// Questions interactives
const answers = await inquirer.prompt([
  {
    type: "input",
    name: "name",
    message: "Id du projet figdata ?",
  },
]);

const projectDir = answers.name;

console.log("➡️ Création du repo Bitbucket...");
let repoUrl;
try {
  repoUrl = await createBitbucketRepo(projectDir);
  console.log("✅ Repo Bitbucket créé:", repoUrl);
} catch (error) {
  console.error("❌ Impossible de créer le repo Bitbucket");
  process.exit(1);
}

// console.log("➡️ Mise à jour des permissions du repo...");
// try {
//   await updateBitbucketRepoPermissions(projectDir, "DAT", "admin");
//   console.log("✅ Permissions mises à jour");
// } catch (error) {
//   console.error("❌ Impossible de mettre à jour les permissions");
//   process.exit(1);
// }

console.log("➡️ Clonage du repo de base...");

execSync(
  `git clone --depth 1 git@bitbucket.org:lefigaro/data-vite-scaffolder.git ${projectDir}`,
  { stdio: "inherit" }
);

// Supprimer le dossier .git de manière compatible avec Windows
rmSync(`${projectDir}/.git`, { recursive: true, force: true });

// Sauvegarder le répertoire courant
const initialDir = process.cwd();

// Initialiser un nouveau dépôt Git
process.chdir(projectDir);
execSync("git init", { stdio: "inherit" });
execSync(`git remote add origin ${repoUrl}`, { stdio: "inherit" });

console.log("➡️ Customisation des fichiers...");
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg["name"] = projectDir;
pkg["figdata"]["id"] = projectDir;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// Revenir au répertoire initial
process.chdir(initialDir);

console.log("✅ Projet initialisé et créé sur Bitbucket !");
