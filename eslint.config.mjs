import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Règles du projet (CLAUDE.md), vérifiées par le lint et donc par la CI.
const processEnv = {
  selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name!='NODE_ENV']",
  message: "Variables d'environnement : passer par getConfig() (src/lib/config.ts)",
};
const zodObject = {
  selector: "CallExpression[callee.object.name='z'][callee.property.name='object']",
  message: "Utiliser z.strictObject() : allowlist, tout champ inconnu est rejeté",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**"],
    ignores: ["src/lib/config.ts"],
    rules: {
      "no-restricted-syntax": ["error", processEnv],
      // Logs via src/lib/logger.ts uniquement (format Cloud Logging / Error Reporting).
      "no-console": "error",
      // Textes affichés dans messages/fr.json ; seule la ponctuation reste en dur.
      "react/jsx-no-literals": ["error", { ignoreProps: true, allowedStrings: ["•", "·", "@", "/", "#", ":", "—", "→"] }],
    },
  },
  {
    // Le logger structuré : seul fichier qui écrit dans la console.
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Répète processEnv : un bloc plus bas remplace la règle, il ne s'y ajoute pas.
    files: ["src/schemas/**"],
    rules: { "no-restricted-syntax": ["error", processEnv, zodObject] },
  },
  // Couches : controller → service → repository → base, sans en sauter.
  {
    files: ["src/lib/services/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/utils/*", "pg", "next/server", "next/headers"], message: "Pas de base ni de HTTP dans un service" },
            { group: ["@/lib/controllers/*"], message: "Un service n'appelle pas un controller" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/controllers/**", "src/app/**", "src/components/**", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/repositories/*", "@/utils/*"], message: "Passer par un service" }] },
      ],
    },
  },
  {
    files: ["src/lib/repositories/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/services/*", "@/lib/controllers/*"], message: "Un repository n'appelle que la base" }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
